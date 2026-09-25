import { NextResponse } from 'next/server';
import {
  ADMIN_USERNAME,
  SESSION_COOKIE,
  checkRateLimit,
  clearRateLimit,
  isPasswordConfigured,
  sessionCookieSecure,
  sessionFromCookieHeader,
  setSessionCookie,
  signSession,
  checkPassword,
} from '@/lib/auth';
import { getD1 } from '@/lib/d1';
import { ensureAdminRow, getUser, verifyUserCredentials } from '@/lib/user-auth';

export const runtime = 'nodejs';

/**
 * 登录（两种身份）：
 * - body 无 username（或为 'admin'）：主密码登录 → 虚拟管理员账号 admin；
 *   D1 可用时 ensure admin 行（用户管理列表可见），签发 admin 会话。
 * - body 带 username：用户名登录 → D1 校验 PBKDF2 口令，签发用户会话。
 * 成功均设置 httpOnly 会话 cookie（90 天，token 内嵌 userId/epoch）。
 */
export async function POST(req: Request) {
  if (!isPasswordConfigured()) {
    return NextResponse.json(
      { success: false, error: '服务器未设置 PASSWORD 环境变量，请联系管理员配置' },
      { status: 503 }
    );
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { success: false, error: '尝试次数过多，请 10 分钟后再试' },
      { status: 429 }
    );
  }

  let username = '';
  let password = '';
  try {
    const body = (await req.json()) as { username?: string; password?: string };
    username = String(body.username ?? '').trim();
    password = String(body.password ?? '');
  } catch {
    return NextResponse.json({ success: false, error: '请求格式错误' }, { status: 400 });
  }

  if (username && username !== ADMIN_USERNAME) {
    // —— 用户名登录 ——
    const db = await getD1();
    if (!db) {
      return NextResponse.json(
        { success: false, error: '当前部署未配置 D1 数据库，仅支持主密码登录' },
        { status: 501 }
      );
    }
    const user = await verifyUserCredentials(db, username, password);
    if (!user) {
      return NextResponse.json({ success: false, error: '用户名或密码错误' }, { status: 401 });
    }
    clearRateLimit(ip);
    const { token, expiresAt } = signSession(user.username, user.epoch);
    const res = NextResponse.json({ success: true, user: { username: user.username, role: 'user' } });
    setSessionCookie(res, token, expiresAt, sessionCookieSecure(req));
    return res;
  }

  // —— 主密码登录（虚拟管理员） ——
  if (!checkPassword(password)) {
    return NextResponse.json({ success: false, error: '密码错误' }, { status: 401 });
  }
  clearRateLimit(ip);
  // D1 可用时确保 admin 行存在（保持已有 epoch/disabled），失败不阻塞登录
  const db = await getD1();
  let epoch = 0;
  if (db) {
    try {
      await ensureAdminRow(db);
      const admin = await getUser(db, ADMIN_USERNAME);
      if (admin?.disabled === 1) {
        return NextResponse.json({ success: false, error: '管理员账号已被禁用' }, { status: 401 });
      }
      epoch = admin?.epoch ?? 0;
    } catch (err) {
      console.warn('[LibreTV] 管理员账号行同步失败（不影响登录）：', err instanceof Error ? err.message : err);
    }
  }
  const { token, expiresAt } = signSession(ADMIN_USERNAME, epoch);
  const res = NextResponse.json({ success: true, user: { username: ADMIN_USERNAME, role: 'admin' } });
  setSessionCookie(res, token, expiresAt, sessionCookieSecure(req));
  return res;
}

/** GET：查询当前会话状态与身份 */
export async function GET(req: Request) {
  const session = sessionFromCookieHeader(req.headers.get('cookie'));
  return NextResponse.json({
    success: true,
    verified: session !== null,
    user: session ? { username: session.userId, role: session.role } : null,
  });
}

/** DELETE：登出 */
export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, maxAge: 0, path: '/' });
  return res;
}
