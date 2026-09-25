import { NextResponse } from 'next/server';
import { sessionCookieSecure, setSessionCookie, signSession } from '@/lib/auth';
import { jsonError, requireUser } from '@/lib/api-guard';
import { getD1 } from '@/lib/d1';
import { changeUserPassword, hasUserStore } from '@/lib/user-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 修改当前用户密码：
 * - 校验旧密码 → 写入新 PBKDF2 哈希 → epoch+1（该用户全部旧会话立即失效）；
 * - 响应重签发当前会话 cookie，本设备无需重新登录；
 * - 主管理员（admin）无库内口令，需改部署配置 PASSWORD，返回 400 引导。
 */
export async function POST(req: Request) {
  const guarded = await requireUser(req);
  if (!guarded.ok) return guarded.response;

  let oldPassword = '';
  let newPassword = '';
  try {
    const body = (await req.json()) as { oldPassword?: string; newPassword?: string };
    oldPassword = String(body.oldPassword ?? '');
    newPassword = String(body.newPassword ?? '');
  } catch {
    return jsonError('请求格式错误', 400);
  }

  const { session } = guarded;
  if (session.role === 'admin') {
    return jsonError('主管理员请通过修改部署配置（PASSWORD 环境变量）变更密码', 400);
  }
  const db = await getD1();
  if (!db || !(await hasUserStore())) {
    return jsonError('当前部署未配置 D1 数据库', 501);
  }

  try {
    const { epoch } = await changeUserPassword(db, session.userId, oldPassword, newPassword);
    // 重签发本设备会话（epoch 已 +1，旧 cookie 全部失效）
    const { token, expiresAt } = signSession(session.userId, epoch);
    const res = NextResponse.json({ success: true });
    setSessionCookie(res, token, expiresAt, sessionCookieSecure(req));
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : '修改密码失败';
    const status = /长度|错误|禁用|不存在/.test(message) ? 400 : 500;
    if (status === 500) console.error('[LibreTV] 修改密码失败：', err);
    return jsonError(message, status);
  }
}
