import { NextResponse } from 'next/server';
import {
  checkRateLimit,
  isPasswordConfigured,
  sessionCookieSecure,
  setSessionCookie,
  signSession,
} from '@/lib/auth';
import { getD1 } from '@/lib/d1';
import { createUser, getRegistrationMode, hasUserStore } from '@/lib/user-auth';

export const runtime = 'nodejs';

/**
 * 用户注册（USER_REGISTRATION 控制模式：invite 需邀请码 / open 开放 / off 关闭）。
 * 成功后自动登录（直接签发用户会话 cookie）。
 */
export async function POST(req: Request) {
  if (!isPasswordConfigured()) {
    return NextResponse.json({ success: false, error: '服务器未设置 PASSWORD 环境变量' }, { status: 503 });
  }
  if (!(await hasUserStore())) {
    return NextResponse.json(
      { success: false, error: '当前部署未配置 D1 数据库，注册功能不可用' },
      { status: 501 }
    );
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { success: false, error: '尝试次数过多，请 10 分钟后再试' },
      { status: 429 }
    );
  }

  const mode = getRegistrationMode();
  let username = '';
  let password = '';
  let inviteCode = '';
  try {
    const body = (await req.json()) as { username?: string; password?: string; inviteCode?: string };
    username = String(body.username ?? '').trim();
    password = String(body.password ?? '');
    inviteCode = String(body.inviteCode ?? '').trim();
  } catch {
    return NextResponse.json({ success: false, error: '请求格式错误' }, { status: 400 });
  }

  const db = await getD1();
  if (!db) return NextResponse.json({ success: false, error: '数据库不可用' }, { status: 501 });

  try {
    const user = await createUser(db, { username, password, inviteCode, mode });
    // 注册成功自动登录
    const { token, expiresAt } = signSession(user.username, user.epoch);
    const res = NextResponse.json({ success: true, user: { username: user.username, role: 'user' } });
    setSessionCookie(res, token, expiresAt, sessionCookieSecure(req));
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : '注册失败';
    const status = /必须是|需要|长度|占用|上限|无效|未开放|格式/.test(message) ? 400 : 500;
    if (status === 500) console.error('[LibreTV] 注册失败：', err);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
