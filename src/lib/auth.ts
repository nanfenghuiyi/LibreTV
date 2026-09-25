import crypto from 'node:crypto';
import type { NextResponse } from 'next/server';

/**
 * 会话鉴权：httpOnly cookie + HMAC 签名。
 *
 * 相比旧版的改进：
 * - 页面源码不再下发 sha256(password)，前端拿不到任何可重放的凭证；
 * - 兼容模式「哈希即凭证」被彻底移除；
 * - 登录接口只接受 POST body，不再把明文密码放 query。
 */

export const SESSION_COOKIE = 'ltv_session';
const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 天

/** 内置管理员账号名（主密码登录即为此身份；注册用户不可占用） */
export const ADMIN_USERNAME = 'admin';

export type SessionRole = 'admin' | 'user';

/** 解析后的会话身份 */
export interface Session {
  userId: string;
  role: SessionRole;
  /** 密码代数：改密递增，token 内嵌的 epoch 低于库中值即视为已撤销 */
  epoch: number;
  expiresAt: number;
}

export function getPassword(): string {
  return process.env.PASSWORD || '';
}

export function isPasswordConfigured(): boolean {
  return getPassword().length > 0;
}

function getSecret(): string {
  if (process.env.PROXY_SECRET) return process.env.PROXY_SECRET;
  return crypto.createHash('sha256').update(getPassword() + ':libretv::session-salt').digest('hex');
}

function hmac(payload: string): string {
  return crypto.createHmac('sha256', getSecret()).update(payload).digest('hex');
}

/**
 * 生成签名会话 token。
 *
 * v2 四段格式：`<userId>.<expiresAtMs>.<epoch>.<hmac>`——身份信息内嵌于 token，
 * 签名验证零数据库读（HLS 分片热路径每分片都要过一次校验）。
 * 旧版两段格式 `<expiresAtMs>.<hmac>`（expiresAt 是纯数字、无 userId）兼容解析为
 * 主管理员身份，存量 cookie 在有效期内自然过渡。
 *
 * epoch（密码代数）：改密时库中 epoch+1，敏感路径（数据同步/管理面板）会复查
 * 库中 epoch 并拒绝过期 token；代理播放等高频路径保持零 DB 读不复查，
 * 已撤销会话最多在播放面残留至 token 过期——可接受的已知限制。
 */
export function signSession(
  userId: string = ADMIN_USERNAME,
  epoch = 0
): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `${userId}.${expiresAt}.${epoch}`;
  return { token: `${payload}.${hmac(payload)}`, expiresAt };
}

/** 校验会话 token 的签名与有效期，返回身份信息；无效返回 null */
export function parseSession(token: string | undefined | null): Session | null {
  if (!token) return null;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = hmac(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  // 旧版两段格式：payload 是纯数字 expiresAt → 视为主管理员（epoch 0）
  if (/^\d+$/.test(payload)) {
    const expiresAt = parseInt(payload, 10);
    if (Date.now() >= expiresAt) return null;
    return { userId: ADMIN_USERNAME, role: 'admin', epoch: 0, expiresAt };
  }
  // v2 四段格式：userId.expiresAt.epoch
  const parts = payload.split('.');
  if (parts.length !== 3) return null;
  const [userId, expStr, epochStr] = parts;
  // userId 字符集在注册时约束为字母/数字/下划线/连字符，不含点，段数解析无歧义
  if (!userId || !/^\d+$/.test(expStr) || !/^\d+$/.test(epochStr)) return null;
  const expiresAt = Number.parseInt(expStr, 10);
  const epoch = Number.parseInt(epochStr, 10);
  if (Date.now() >= expiresAt) return null;
  return { userId, role: userId === ADMIN_USERNAME ? 'admin' : 'user', epoch, expiresAt };
}

/** 校验会话 token 是否有效（布尔便捷封装） */
export function verifySession(token: string | undefined | null): boolean {
  return parseSession(token) !== null;
}

/** 恒定时间比较密码（比较 sha256 摘要避免长度泄漏） */
export function checkPassword(input: string): boolean {
  const password = getPassword();
  if (!password) return false;
  const a = crypto.createHash('sha256').update(input).digest();
  const b = crypto.createHash('sha256').update(password).digest();
  return crypto.timingSafeEqual(a, b);
}

/** 从请求 Cookie 中解析会话（无效返回 null，有效返回身份信息） */
export function sessionFromCookieHeader(cookieHeader: string | null): Session | null {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';');
  for (const c of cookies) {
    const eq = c.indexOf('=');
    if (eq === -1) continue;
    const name = c.slice(0, eq).trim();
    if (name === SESSION_COOKIE) {
      return parseSession(decodeURIComponent(c.slice(eq + 1).trim()));
    }
  }
  return null;
}

// —— 登录速率限制（内存实现，单实例部署足够；多实例可换 Redis） ——
const attemptMap = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 10 * 60 * 1000;

export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = attemptMap.get(ip);
  if (!entry || now > entry.resetAt) {
    attemptMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_ATTEMPTS) return false;
  entry.count += 1;
  return true;
}

export function clearRateLimit(ip: string): void {
  attemptMap.delete(ip);
}

// 定期清理过期限流记录，避免长期运行下 Map 膨胀
if (typeof setInterval === 'function') {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of attemptMap) {
      if (now > entry.resetAt) attemptMap.delete(ip);
    }
  }, 60 * 1000);
  // 不阻止 Node 进程退出
  if (typeof timer.unref === 'function') timer.unref();
}

// —— 会话 Cookie 写入（登录/注册/改密重签发共用） ——

/**
 * Cookie Secure 策略：COOKIE_SECURE 环境变量显式覆盖；否则按 x-forwarded-proto 推导。
 * 不能依赖 req.url——Next.js Route Handler 中它是内部转发地址，并非用户侧的原始协议。
 */
export function sessionCookieSecure(req: Request): boolean {
  if (process.env.COOKIE_SECURE === 'true') return true;
  if (process.env.COOKIE_SECURE === 'false') return false;
  return (req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ?? 'http') === 'https';
}

export function setSessionCookie(
  res: NextResponse,
  token: string,
  expiresAt: number,
  secure: boolean
): void {
  res.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: Math.max(1, Math.floor((expiresAt - Date.now()) / 1000)),
    path: '/',
  });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set({ name: SESSION_COOKIE, value: '', httpOnly: true, maxAge: 0, path: '/' });
}
