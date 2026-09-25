import { NextResponse } from 'next/server';
import { isPasswordConfigured, sessionFromCookieHeader, type Session } from './auth';
import { getD1 } from './d1';
import { checkSessionAlive, hasUserStore } from './user-auth';

/**
 * API Route 守卫分两层：
 *
 * - guardRequest：同步、零 DB 读，仅验证 token 签名与有效期。供包括
 *   /api/proxy（HLS 分片，每个分片都会执行）在内的全部现有路由使用，
 *   签名与行为保持不变。
 * - requireUser / requireAdminUser：异步，在签名校验之外再查一次 D1
 *   （禁用标记 + epoch 密码代数）。供数据同步、管理面板、写共享源等
 *   低频敏感路径使用——改密/禁用立即生效。无 D1 部署（Docker）时
 *   自动退化为纯签名校验。
 */

export function guardRequest(req: Request): NextResponse | null {
  if (!isPasswordConfigured()) {
    return NextResponse.json(
      { error: '服务器未设置 PASSWORD 环境变量' },
      { status: 503 }
    );
  }
  if (!sessionFromCookieHeader(req.headers.get('cookie'))) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }
  return null;
}

/** 纯 token 解析（不查库），供需要身份信息的路径使用（如 /api/status 的 me 字段） */
export function resolveSession(req: Request): Session | null {
  return sessionFromCookieHeader(req.headers.get('cookie'));
}

export type GuardResult =
  | { ok: true; session: Session }
  | { ok: false; response: NextResponse };

/** 敏感路径守卫：登录 + D1 复查（禁用/epoch）。未配置 D1 时退化为 guardRequest 语义 */
export async function requireUser(req: Request): Promise<GuardResult> {
  if (!isPasswordConfigured()) {
    return {
      ok: false,
      response: NextResponse.json({ error: '服务器未设置 PASSWORD 环境变量' }, { status: 503 }),
    };
  }
  const session = sessionFromCookieHeader(req.headers.get('cookie'));
  if (!session) {
    return { ok: false, response: NextResponse.json({ error: '未登录' }, { status: 401 }) };
  }
  // D1 可用时复查用户状态；无 D1（Docker 部署）只有主密码会话，无需复查
  if (await hasUserStore()) {
    const db = await getD1();
    const alive = db
      ? await checkSessionAlive(db, session.userId, session.role, session.epoch)
      : true;
    if (!alive) {
      return {
        ok: false,
        response: NextResponse.json({ error: '会话已失效，请重新登录' }, { status: 401 }),
      };
    }
  }
  return { ok: true, session };
}

/** 管理员守卫：requireUser 之上再要求 admin 角色 */
export async function requireAdminUser(req: Request): Promise<GuardResult> {
  const guarded = await requireUser(req);
  if (!guarded.ok) return guarded;
  if (guarded.session.role !== 'admin') {
    return { ok: false, response: NextResponse.json({ error: '需要管理员权限' }, { status: 403 }) };
  }
  return guarded;
}

export function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}
