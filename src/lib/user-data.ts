import { ensureD1Table, type D1DatabaseLike, type D1PreparedStatementLike } from './d1';

/**
 * 用户个人数据云同步服务端（user_data 表）。
 *
 * 数据模型：每用户每类数据若干行，(user_id, type, k) 为主键。
 * - history：k = 记录 id；progress：k = 进度 key
 * - search_history / settings：整类单行（k 固定 'list' / 'snapshot'）
 *
 * 合并策略：LWW（last-write-wins）——服务端仅接受 updatedAt >= 库内值的行，
 * 乱序/重复推送幂等无害。删除与清空由 PUT 的 deletes/clears 字段承载。
 */

const USER_DATA_TABLE = 'user_data';

const USER_DATA_DDL = `CREATE TABLE IF NOT EXISTS ${USER_DATA_TABLE} (
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  k TEXT NOT NULL,
  v TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, type, k)
)`;

export async function ensureUserDataSchema(db: D1DatabaseLike): Promise<void> {
  await ensureD1Table(db, USER_DATA_TABLE, USER_DATA_DDL);
}

// —— 限额（防滥用写爆 D1） ——

/** 单次 PUT 最多 upsert 行数 */
export const MAX_PUT_ITEMS = 200;
/** 请求体字节上限（超限 413） */
export const MAX_BODY_BYTES = 256 * 1024;
/** 单条 v 载荷字节上限 */
export const MAX_VALUE_BYTES = 100 * 1024;
/** k（记录键）长度上限 */
export const MAX_KEY_LENGTH = 512;

/** 各 type 行数上限（history 本地保留 100 条，留余量） */
export const ROW_LIMITS: Record<string, number> = { history: 150 };
export const DEFAULT_ROW_LIMIT = 300;

/** 合法数据类型（与客户端同步引擎的云端命名对齐） */
export const DATA_TYPES = ['history', 'progress', 'search_history', 'settings'] as const;

export type UserDataType = (typeof DATA_TYPES)[number];

export interface UserDataItemInput {
  type: string;
  k: string;
  v: string;
  updatedAt: number;
}

export interface UserDataPutInput {
  items?: UserDataItemInput[];
  deletes?: { type: string; keys: string[] }[];
  clears?: string[];
}

/** 数据校验失败（返回 400 的可读错误） */
export class UserDataError extends Error {}

function rowLimit(type: string): number {
  return ROW_LIMITS[type] ?? DEFAULT_ROW_LIMIT;
}

function assertType(type: unknown): string {
  const t = String(type ?? '');
  if (!(DATA_TYPES as readonly string[]).includes(t)) {
    throw new UserDataError(`未知的数据类型：${t || '(空)'}`);
  }
  return t;
}

function byteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

/** 云端行（GET 响应中的 items 元素） */
export interface CloudUserDataItem {
  type: string;
  k: string;
  v: string;
  updatedAt: number;
}

/** 全量拉取某用户的云端数据（单用户行数有上限，无需分页） */
export async function getAllUserData(
  db: D1DatabaseLike,
  userId: string
): Promise<CloudUserDataItem[]> {
  await ensureUserDataSchema(db);
  const { results } = await db
    .prepare(
      `SELECT type, k, v, updated_at AS updatedAt
       FROM ${USER_DATA_TABLE} WHERE user_id = ?
       ORDER BY updated_at DESC`
    )
    .bind(userId)
    .all<CloudUserDataItem>();
  return results;
}

/**
 * 批量写入云端变更（LWW 合并）。
 * 返回实际写入行数；被 LWW 拒绝（updatedAt 早于库内）的行静默跳过。
 * 行数超出对应 type 上限时抛 UserDataError，整个 PUT 不生效。
 */
export async function putUserData(
  db: D1DatabaseLike,
  userId: string,
  input: UserDataPutInput
): Promise<{ updated: number }> {
  await ensureUserDataSchema(db);

  const items = Array.isArray(input?.items) ? input.items : [];
  const deletes = Array.isArray(input?.deletes) ? input.deletes : [];
  const clears = Array.isArray(input?.clears) ? input.clears : [];

  if (items.length > MAX_PUT_ITEMS) {
    throw new UserDataError(`单次最多推送 ${MAX_PUT_ITEMS} 条数据`);
  }
  if (items.length === 0 && deletes.length === 0 && clears.length === 0) {
    throw new UserDataError('请求缺少 items / deletes / clears 任一字段');
  }

  // 校验 items 结构
  for (const it of items) {
    assertType(it.type);
    const k = String(it.k ?? '');
    if (!k || k.length > MAX_KEY_LENGTH) throw new UserDataError('数据键 k 非法或过长');
    if (typeof it.v !== 'string' || byteLength(it.v) > MAX_VALUE_BYTES) {
      throw new UserDataError('单条数据载荷超过 100KB 上限');
    }
    const t = Number(it.updatedAt);
    if (!Number.isFinite(t) || t < 0) throw new UserDataError('updatedAt 非法');
  }
  for (const d of deletes) {
    assertType(d.type);
    if (!Array.isArray(d.keys) || d.keys.length === 0) throw new UserDataError('deletes.keys 不能为空');
  }
  for (const c of clears) assertType(c);

  // 拉全量现有元数据（不含 v，单用户 <1000 行）做 LWW 与行数上限判断
  const existing = await db
    .prepare(`SELECT type, k, updated_at FROM ${USER_DATA_TABLE} WHERE user_id = ?`)
    .bind(userId)
    .all<{ type: string; k: string; updated_at: number }>();
  const meta = new Map<string, number>();
  const countByType = new Map<string, number>();
  for (const row of existing.results) {
    meta.set(`${row.type}|${row.k}`, row.updated_at);
    countByType.set(row.type, (countByType.get(row.type) ?? 0) + 1);
  }

  // LWW 过滤：仅接受 updatedAt >= 库内值的行
  const accepted: UserDataItemInput[] = [];
  for (const it of items) {
    const prev = meta.get(`${it.type}|${it.k}`);
    if (prev !== undefined && Number(it.updatedAt) < prev) continue;
    accepted.push(it);
  }

  // 行数上限：受影响 type 的最终行数 = 现有 - 删除 - 清空 + 新增
  const touched = new Map<string, number>(); // type -> 净新增行数
  const clearSet = new Set(clears);
  const deletedKeys = new Map<string, Set<string>>(); // type -> keys
  for (const d of deletes) {
    if (clearSet.has(d.type)) continue; // clear 已覆盖整类
    let set = deletedKeys.get(d.type);
    if (!set) deletedKeys.set(d.type, (set = new Set()));
    for (const key of d.keys) set.add(String(key));
  }
  for (const type of new Set([...clearSet, ...deletedKeys.keys(), ...accepted.map((i) => i.type)])) {
    const removed = clearSet.has(type)
      ? countByType.get(type) ?? 0
      : [...(deletedKeys.get(type) ?? [])].filter((k) => meta.has(`${type}|${k}`)).length;
    const added = accepted.filter((i) => i.type === type).length;
    touched.set(type, added - removed);
  }
  for (const [type, delta] of touched) {
    const final = (countByType.get(type) ?? 0) + delta;
    if (final > rowLimit(type)) {
      throw new UserDataError(`「${type}」数据行数超出上限（${rowLimit(type)}），请先清理旧数据`);
    }
  }

  // 组装 batch：删除（清空 + 按键）与 upsert 一起在事务内执行
  const stmts: D1PreparedStatementLike[] = [];
  for (const type of clearSet) {
    stmts.push(
      db.prepare(`DELETE FROM ${USER_DATA_TABLE} WHERE user_id = ? AND type = ?`).bind(userId, type)
    );
  }
  for (const [type, keys] of deletedKeys) {
    const placeholders = [...keys].map(() => '?').join(', ');
    stmts.push(
      db
        .prepare(
          `DELETE FROM ${USER_DATA_TABLE}
           WHERE user_id = ? AND type = ? AND k IN (${placeholders})`
        )
        .bind(userId, type, ...keys)
    );
  }
  for (const it of accepted) {
    stmts.push(
      db
        .prepare(
          `INSERT INTO ${USER_DATA_TABLE} (user_id, type, k, v, updated_at) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(user_id, type, k)
           DO UPDATE SET v = excluded.v, updated_at = excluded.updated_at`
        )
        .bind(userId, String(it.type), String(it.k), it.v, Number(it.updatedAt))
    );
  }
  if (stmts.length > 0) await db.batch(stmts);

  return { updated: accepted.length };
}
