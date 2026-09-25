import { NextResponse } from 'next/server';
import { requireAdminUser, jsonError } from '@/lib/api-guard';
import { getD1 } from '@/lib/d1';
import { adminDeleteUser, adminUpdateUser, listUsers, type UserRow } from '@/lib/user-auth';
import { deleteUserSources, listAssignedUsernames } from '@/lib/user-sources';
import type { AdminUserRow } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 用户管理（仅管理员）：
 * GET    列出全部用户（不含口令哈希）
 * PATCH  启用/禁用、踢下线（bumpEpoch 使已签发会话失效）
 * DELETE 删除用户及其云端数据
 * 无 D1 部署返回 available=false（前端据此隐藏管理面板）。
 */

function toAdminUserRow(r: UserRow): AdminUserRow {
  return {
    username: r.username,
    role: r.role,
    disabled: r.disabled === 1,
    epoch: r.epoch,
    createdAt: r.created_at,
    lastLoginAt: r.last_login_at,
  };
}

export async function GET(req: Request) {
  const guard = await requireAdminUser(req);
  if (!guard.ok) return guard.response;
  const db = await getD1();
  if (!db) return NextResponse.json({ available: false, users: [] });
  const users = await listUsers(db);
  const assignedNames = await listAssignedUsernames(db);
  return NextResponse.json({
    available: true,
    users: users.map((u) => ({ ...toAdminUserRow(u), sourceAssigned: assignedNames.has(u.username) })),
  });
}

export async function PATCH(req: Request) {
  const guard = await requireAdminUser(req);
  if (!guard.ok) return guard.response;
  const db = await getD1();
  if (!db) return jsonError('当前部署未配置 D1 数据库', 501);

  let body: { username?: unknown; disabled?: unknown; bumpEpoch?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonError('请求体不是合法 JSON', 400);
  }
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  if (!username) return jsonError('缺少 username', 400);
  const patch: { username: string; disabled?: boolean; bumpEpoch?: boolean } = { username };
  if (body.disabled !== undefined) {
    if (typeof body.disabled !== 'boolean') return jsonError('disabled 必须是布尔值', 400);
    patch.disabled = body.disabled;
  }
  if (body.bumpEpoch !== undefined) {
    if (typeof body.bumpEpoch !== 'boolean') return jsonError('bumpEpoch 必须是布尔值', 400);
    patch.bumpEpoch = body.bumpEpoch;
  }

  try {
    const row = await adminUpdateUser(db, patch);
    if (!row) return jsonError('用户不存在', 404);
    return NextResponse.json({ available: true, user: toAdminUserRow(row) });
  } catch (err) {
    const message = err instanceof Error ? err.message : '更新用户失败';
    const status = /不允许/.test(message) ? 400 : 500;
    if (status === 500) console.error('[LibreTV] 更新用户失败：', err);
    return jsonError(message, status);
  }
}

export async function DELETE(req: Request) {
  const guard = await requireAdminUser(req);
  if (!guard.ok) return guard.response;
  const db = await getD1();
  if (!db) return jsonError('当前部署未配置 D1 数据库', 501);

  const username = new URL(req.url).searchParams.get('username')?.trim() ?? '';
  if (!username) return jsonError('缺少 username 参数', 400);
  try {
    const ok = await adminDeleteUser(db, username);
    if (!ok) return jsonError('用户不存在', 404);
    await deleteUserSources(db, username).catch(() => {}); // 顺带清理分配源，失败不影响删除
    return NextResponse.json({ available: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : '删除用户失败';
    const status = /不允许/.test(message) ? 400 : 500;
    if (status === 500) console.error('[LibreTV] 删除用户失败：', err);
    return jsonError(message, status);
  }
}
