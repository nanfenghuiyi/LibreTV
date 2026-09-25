import crypto from 'node:crypto';
import { ADMIN_USERNAME, type SessionRole } from './auth';
import { ensureD1Table, getD1, type D1DatabaseLike } from './d1';

/**
 * 用户体系服务端核心（Cloudflare D1 存储）：
 * - users 表存账号（PBKDF2 口令哈希 + epoch 密码代数 + 禁用标记）；
 * - invite_codes 表存一次性注册邀请码（open 模式无需邀请码）；
 * - 主密码登录映射为虚拟账号 admin（role=admin，password_hash 为占位符，
 *   校验走环境变量 PASSWORD，不查本表哈希）。
 *
 * Workers 免费版 CPU 限制约 10ms/请求：PBKDF2-SHA256 默认 25k 迭代
 * （PBKDF2_ITERATIONS 可调），是登录/注册等低频操作可承受的上限。
 */

// —— 表结构 ——

const USERS_TABLE = 'users';
const INVITES_TABLE = 'invite_codes';

export interface UserRow {
  username: string;
  password_hash: string;
  role: SessionRole;
  epoch: number;
  disabled: number;
  created_at: number;
  last_login_at: number | null;
}

export interface InviteCodeRow {
  code: string;
  created_at: number;
  expires_at: number | null;
  used_count: number;
  max_uses: number;
  note: string | null;
}

const USERS_DDL = `CREATE TABLE IF NOT EXISTS ${USERS_TABLE} (
  username TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  epoch INTEGER NOT NULL DEFAULT 0,
  disabled INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_login_at INTEGER
)`;

const INVITES_DDL = `CREATE TABLE IF NOT EXISTS ${INVITES_TABLE} (
  code TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  max_uses INTEGER NOT NULL DEFAULT 1,
  note TEXT
)`;

/** 确保用户体系三张表存在（幂等，模块级缓存内每张表只建一次） */
export async function ensureUserSchema(db: D1DatabaseLike): Promise<void> {
  await ensureD1Table(db, USERS_TABLE, USERS_DDL);
  await ensureD1Table(db, INVITES_TABLE, INVITES_DDL);
}

/** 当前部署是否具备用户体系存储（Workers + D1 绑定） */
export async function hasUserStore(): Promise<boolean> {
  return (await getD1()) !== null;
}

// —— 注册模式与容量 ——

export type RegistrationMode = 'invite' | 'open' | 'off';

export function getRegistrationMode(): RegistrationMode {
  const v = (process.env.USER_REGISTRATION || 'invite').trim().toLowerCase();
  return v === 'open' || v === 'off' ? (v as RegistrationMode) : 'invite';
}

/** 用户数量上限（个人/小圈子部署防滥用） */
export const MAX_USERS = 50;
/** 每个用户可建邀请码上限（未使用/未过期的有效码数） */
export const MAX_ACTIVE_INVITES_PER_ADMIN = 20;

// —— 用户名与口令校验 ——

const USERNAME_RE = /^[a-zA-Z][a-zA-Z0-9_-]{1,19}$/;

export function validateUsername(username: string): string | null {
  if (!USERNAME_RE.test(username)) return null;
  if (username === ADMIN_USERNAME) return null;
  return username;
}

export function validatePassword(password: string): boolean {
  return password.length >= 6 && password.length <= 128;
}

// —— 口令哈希（PBKDF2-SHA256 + 站点级 pepper） ——

function getIterations(): number {
  const n = Number.parseInt(process.env.PBKDF2_ITERATIONS || '', 10);
  // 下限 10k 防误配成极弱值；上限 200k 防误配导致 Workers CPU 超时
  if (Number.isFinite(n) && n >= 10_000 && n <= 200_000) return n;
  return 25_000;
}

function b64(buf: Buffer): string {
  return buf.toString('base64');
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

/**
 * pepper 存于 D1 shared_config（k='user_pepper'），首次使用时生成。
 * 与 PASSWORD 解耦：修改主密码不影响用户口令校验。
 * 模块级缓存，isolate 生命周期内只读一次库。
 */
let pepperPromise: Promise<string | null> | null = null;

function getPepper(db: D1DatabaseLike): Promise<string | null> {
  if (!pepperPromise) {
    pepperPromise = (async () => {
      try {
        await ensureD1Table(
          db,
          'shared_config',
          `CREATE TABLE IF NOT EXISTS shared_config (
            k TEXT PRIMARY KEY,
            v TEXT NOT NULL,
            updated_at INTEGER NOT NULL
          )`
        );
        const row = await db
          .prepare('SELECT v FROM shared_config WHERE k = ?')
          .bind('user_pepper')
          .first<{ v: string }>();
        if (row?.v) return row.v;
        const pepper = crypto.randomBytes(32).toString('base64');
        await db
          .prepare(
            `INSERT INTO shared_config (k, v, updated_at) VALUES (?, ?, ?)
             ON CONFLICT(k) DO NOTHING`
          )
          .bind('user_pepper', pepper, Date.now())
          .run();
        return pepper;
      } catch (err) {
        console.error('[LibreTV] 读取口令 pepper 失败：', err);
        pepperPromise = null; // 允许下次重试
        return null;
      }
    })();
  }
  return pepperPromise;
}

/** 生成口令哈希：`pbkdf2$<iter>$<salt_b64>$<hash_b64>` */
export async function hashPassword(password: string, db: D1DatabaseLike): Promise<string> {
  const pepper = await getPepper(db);
  const iterations = getIterations();
  const saltB64 = crypto.randomBytes(16).toString('base64');
  const derived = await pbkdf2Async(password, saltB64, iterations, pepper);
  return `pbkdf2$${iterations}$${saltB64}$${b64(derived)}`;
}

function pbkdf2Async(
  password: string,
  saltB64: string,
  iterations: number,
  pepper: string | null
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(
      password,
      (pepper ?? '') + saltB64,
      iterations,
      32,
      'sha256',
      (err, derived) => (err ? reject(err) : resolve(derived))
    );
  });
}

/** 校验口令（异步：需要 pepper）。与 hashPassword 使用相同密钥材料拼接规则 */
export async function verifyPassword(
  stored: string,
  password: string,
  db: D1DatabaseLike
): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = Number.parseInt(parts[1], 10);
  const saltB64 = parts[2];
  const expected = Buffer.from(parts[3], 'base64');
  if (!Number.isFinite(iterations) || iterations < 1 || expected.length !== 32) return false;
  const pepper = await getPepper(db);
  const derived = await pbkdf2Async(password, saltB64, iterations, pepper);
  return timingSafeEqualStr(derived.toString('base64'), parts[3]);
}

// —— 用户 CRUD ——

/** 创建用户（含邀请码消费）；失败时抛出带可读信息的错误 */
export async function createUser(
  db: D1DatabaseLike,
  input: { username: string; password: string; inviteCode?: string; mode: RegistrationMode }
): Promise<UserRow> {
  await ensureUserSchema(db);
  const username = validateUsername(input.username);
  if (!username) {
    throw new Error('用户名需以字母开头，2-20 位字母/数字/下划线/连字符，且不能占用保留名');
  }
  if (!validatePassword(input.password)) {
    throw new Error('密码长度需在 6-128 位之间');
  }
  if (input.mode === 'off') {
    throw new Error('本站未开放注册');
  }

  // 用户数上限（一次性 COUNT，50 上限内查询开销可忽略）
  const countRow = await db.prepare('SELECT COUNT(*) AS c FROM users').first<{ c: number }>();
  if ((countRow?.c ?? 0) >= MAX_USERS) {
    throw new Error('用户数量已达上限，请联系管理员');
  }

  // 消费邀请码（invite 模式必须给有效码；open 模式忽略）
  if (input.mode === 'invite') {
    if (!input.inviteCode?.trim()) throw new Error('需要邀请码才能注册');
    const consumed = await consumeInviteCode(db, input.inviteCode.trim());
    if (!consumed) throw new Error('邀请码无效、已使用或已过期');
  }

  const now = Date.now();
  const passwordHash = await hashPassword(input.password, db);
  try {
    await db
      .prepare(
        `INSERT INTO ${USERS_TABLE} (username, password_hash, role, epoch, disabled, created_at)
         VALUES (?, ?, 'user', 0, 0, ?)`
      )
      .bind(username, passwordHash, now)
      .run();
  } catch (err) {
    // 主键冲突 = 用户名已存在（邀请码已被消费，属可接受损耗）
    if (/UNIQUE|PRIMARY KEY/i.test(String(err))) throw new Error('用户名已被占用');
    throw err;
  }
  return {
    username,
    password_hash: passwordHash,
    role: 'user',
    epoch: 0,
    disabled: 0,
    created_at: now,
    last_login_at: null,
  };
}

/** 校验用户名口令；成功时顺带更新 last_login_at。失败一律返回 null（不区分原因） */
export async function verifyUserCredentials(
  db: D1DatabaseLike,
  username: string,
  password: string
): Promise<UserRow | null> {
  await ensureUserSchema(db);
  const row = await db
    .prepare(`SELECT * FROM ${USERS_TABLE} WHERE username = ?`)
    .bind(username)
    .first<UserRow>();
  if (!row || row.disabled === 1 || row.role !== 'user') return null;
  const ok = await verifyPassword(row.password_hash, password, db);
  if (!ok) return null;
  void db
    .prepare(`UPDATE ${USERS_TABLE} SET last_login_at = ? WHERE username = ?`)
    .bind(Date.now(), username)
    .run()
    .catch(() => {});
  return row;
}

/** 按 username 读取用户 */
export async function getUser(db: D1DatabaseLike, username: string): Promise<UserRow | null> {
  return db.prepare(`SELECT * FROM ${USERS_TABLE} WHERE username = ?`).bind(username).first<UserRow>();
}

/**
 * 会话有效性复查（敏感路径用）：用户必须存在、未禁用、epoch 不低于 token 内嵌值。
 * admin 虚拟账号行不存在时放行（纯主密码部署未登录过 D1 的过渡状态）。
 */
export async function checkSessionAlive(
  db: D1DatabaseLike,
  userId: string,
  role: SessionRole,
  epoch: number
): Promise<boolean> {
  if (role === 'admin' && userId === ADMIN_USERNAME) {
    const admin = await getUser(db, ADMIN_USERNAME);
    // admin 行存在时同样受 epoch/disabled 约束（管理员可被另一管理员踢下线/禁用）
    if (!admin) return true;
    return admin.disabled !== 1 && epoch >= admin.epoch;
  }
  const row = await getUser(db, userId);
  if (!row || row.disabled === 1) return false;
  return epoch >= row.epoch;
}

/** 修改用户密码：校验旧密码 → 写入新哈希 → epoch+1（使所有旧会话失效） */
export async function changeUserPassword(
  db: D1DatabaseLike,
  username: string,
  oldPassword: string,
  newPassword: string
): Promise<{ epoch: number }> {
  await ensureUserSchema(db);
  if (!validatePassword(newPassword)) {
    throw new Error('新密码长度需在 6-128 位之间');
  }
  const row = await getUser(db, username);
  if (!row || row.disabled === 1) throw new Error('用户不存在或已被禁用');
  if (row.role === 'admin') throw new Error('主管理员请通过修改部署配置（PASSWORD 环境变量）变更密码');
  const ok = await verifyPassword(row.password_hash, oldPassword, db);
  if (!ok) throw new Error('当前密码错误');
  const passwordHash = await hashPassword(newPassword, db);
  const epoch = row.epoch + 1;
  await db
    .prepare(`UPDATE ${USERS_TABLE} SET password_hash = ?, epoch = ? WHERE username = ?`)
    .bind(passwordHash, epoch, username)
    .run();
  return { epoch };
}

// —— 管理员操作 ——

/** 管理员用户列表（创建时间倒序） */
export async function listUsers(db: D1DatabaseLike): Promise<UserRow[]> {
  await ensureUserSchema(db);
  const { results } = await db
    .prepare(`SELECT * FROM ${USERS_TABLE} ORDER BY created_at DESC`)
    .all<UserRow>();
  return results;
}

/** 管理员确保 admin 虚拟账号行存在（主密码登录成功时调用；epoch 保持已有值） */
export async function ensureAdminRow(db: D1DatabaseLike): Promise<void> {
  await ensureUserSchema(db);
  await db
    .prepare(
      `INSERT INTO ${USERS_TABLE} (username, password_hash, role, epoch, disabled, created_at)
       VALUES (?, 'admin-master', 'admin', 0, 0, ?)
       ON CONFLICT(username) DO NOTHING`
    )
    .bind(ADMIN_USERNAME, Date.now())
    .run();
}

/** 启用/禁用用户与踢下线（epoch+1）；admin 账号不允许被禁用 */
export async function adminUpdateUser(
  db: D1DatabaseLike,
  input: { username: string; disabled?: boolean; bumpEpoch?: boolean }
): Promise<UserRow | null> {
  await ensureUserSchema(db);
  if (input.username === ADMIN_USERNAME && input.disabled === true) {
    throw new Error('内置管理员不允许禁用');
  }
  const row = await getUser(db, input.username);
  if (!row) return null;
  const epoch = input.bumpEpoch ? row.epoch + 1 : row.epoch;
  const disabled = input.disabled === undefined ? row.disabled : input.disabled ? 1 : 0;
  await db
    .prepare(`UPDATE ${USERS_TABLE} SET disabled = ?, epoch = ? WHERE username = ?`)
    .bind(disabled, epoch, input.username)
    .run();
  return { ...row, disabled, epoch };
}

/** 删除用户及其全部数据（用户数据由调用方一并清理或依赖外键级联——此处直接两表同删） */
export async function adminDeleteUser(db: D1DatabaseLike, username: string): Promise<boolean> {
  await ensureUserSchema(db);
  if (username === ADMIN_USERNAME) throw new Error('内置管理员不允许删除');
  await db.batch([
    db.prepare('DELETE FROM users WHERE username = ? AND role = ?').bind(username, 'user'),
    db.prepare('DELETE FROM user_data WHERE user_id = ?').bind(username),
  ]);
  return (await getUser(db, username)) === null;
}

// —— 邀请码 ——

function generateCode(): string {
  // 格式 LTV-XXXXX-XXXXX（Crockford 风格字母表，去掉易混淆字符）
  const alphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  const pick = (n: number) =>
    Array.from(crypto.randomBytes(n))
      .map((b) => alphabet[b % alphabet.length])
      .join('');
  return `LTV-${pick(5)}-${pick(5)}`;
}

export async function createInviteCode(
  db: D1DatabaseLike,
  opts?: { maxUses?: number; expiresInDays?: number; note?: string }
): Promise<InviteCodeRow> {
  await ensureUserSchema(db);
  const now = Date.now();
  const code = generateCode();
  const expiresAt =
    opts?.expiresInDays && opts.expiresInDays > 0 ? now + opts.expiresInDays * 86_400_000 : null;
  const maxUses = opts?.maxUses && opts.maxUses > 0 ? Math.min(999, Math.floor(opts.maxUses)) : 1;
  const note = opts?.note?.trim() || null;
  await db
    .prepare(
      `INSERT INTO ${INVITES_TABLE} (code, created_at, expires_at, used_count, max_uses, note)
       VALUES (?, ?, ?, 0, ?, ?)`
    )
    .bind(code, now, expiresAt, maxUses, note)
    .run();
  return { code, created_at: now, expires_at: expiresAt, used_count: 0, max_uses: maxUses, note };
}

export async function listInviteCodes(db: D1DatabaseLike): Promise<InviteCodeRow[]> {
  await ensureUserSchema(db);
  const { results } = await db
    .prepare(`SELECT * FROM ${INVITES_TABLE} ORDER BY created_at DESC`)
    .all<InviteCodeRow>();
  return results;
}

/** 尝试消费邀请码（used_count < max_uses 且未过期）；成功返回 true */
export async function consumeInviteCode(db: D1DatabaseLike, code: string): Promise<boolean> {
  await ensureUserSchema(db);
  const now = Date.now();
  const row = await db
    .prepare(`SELECT * FROM ${INVITES_TABLE} WHERE code = ?`)
    .bind(code)
    .first<InviteCodeRow>();
  if (!row) return false;
  if (row.used_count >= row.max_uses) return false;
  if (row.expires_at !== null && row.expires_at < now) return false;
  // 条件更新防并发双花：仅当 used_count 仍为读取值时 +1
  await db
    .prepare(
      `UPDATE ${INVITES_TABLE}
       SET used_count = used_count + 1
       WHERE code = ? AND used_count = ? AND used_count < max_uses
         AND (expires_at IS NULL OR expires_at > ?)`
    )
    .bind(code, row.used_count, now)
    .run();
  const after = await db
    .prepare('SELECT used_count FROM invite_codes WHERE code = ?')
    .bind(code)
    .first<{ used_count: number }>();
  return after?.used_count === row.used_count + 1;
}

export async function deleteInviteCode(db: D1DatabaseLike, code: string): Promise<void> {
  await ensureUserSchema(db);
  await db.prepare('DELETE FROM invite_codes WHERE code = ?').bind(code).run();
}
