import { NextResponse } from 'next/server';
import { requireAdminUser, jsonError } from '@/lib/api-guard';
import { getD1 } from '@/lib/d1';
import { getUser } from '@/lib/user-auth';
import {
  deleteUserSources,
  getUserSources,
  saveUserSources,
} from '@/lib/user-sources';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 用户专属数据源管理（仅管理员）：
 * GET    ?username= 读取该用户的分配源（未分配时 assigned=null）
 * PUT    ?username= 全量覆盖保存分配源（采集/直播/订阅三类）
 * DELETE ?username= 清除该用户的分配配置（用户恢复看到内置/共享源）
 * 目标用户必须存在且非管理员（管理员本就看到全部源）。
 */

async function resolveTarget(
  req: Request,
  usernameParam: string
): Promise<{ db: NonNullable<Awaited<ReturnType<typeof getD1>>>; username: string } | { response: NextResponse }> {
  const db = await getD1();
  if (!db) return { response: jsonError('当前部署未配置 D1 数据库', 501) };
  const username = usernameParam.trim();
  if (!username) return { response: jsonError('缺少 username 参数', 400) };
  const user = await getUser(db, username);
  if (!user) return { response: jsonError('用户不存在', 404) };
  if (user.role === 'admin') return { response: jsonError('无需为管理员分配数据源', 400) };
  return { db, username };
}

export async function GET(req: Request) {
  const guard = await requireAdminUser(req);
  if (!guard.ok) return guard.response;
  const usernameParam = new URL(req.url).searchParams.get('username') ?? '';
  const target = await resolveTarget(req, usernameParam);
  if ('response' in target) return target.response;
  try {
    const assigned = await getUserSources(target.db, target.username);
    return NextResponse.json({ available: true, assigned });
  } catch (err) {
    console.error('[LibreTV] 读取用户分配源失败：', err);
    return jsonError('读取用户分配源失败', 500);
  }
}

export async function PUT(req: Request) {
  const guard = await requireAdminUser(req);
  if (!guard.ok) return guard.response;
  const usernameParam = new URL(req.url).searchParams.get('username') ?? '';
  const target = await resolveTarget(req, usernameParam);
  if ('response' in target) return target.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError('请求体不是合法 JSON', 400);
  }
  try {
    const assigned = await saveUserSources(
      target.db,
      target.username,
      (body ?? {}) as { sources?: unknown; liveSources?: unknown; subscriptions?: unknown }
    );
    return NextResponse.json({ available: true, assigned });
  } catch (err) {
    const message = err instanceof Error ? err.message : '保存用户分配源失败';
    const status = /必须是数组|不是对象|缺少|必须以|超出上限/.test(message) ? 400 : 500;
    if (status === 500) console.error('[LibreTV] 保存用户分配源失败：', err);
    return jsonError(message, status);
  }
}

export async function DELETE(req: Request) {
  const guard = await requireAdminUser(req);
  if (!guard.ok) return guard.response;
  const usernameParam = new URL(req.url).searchParams.get('username') ?? '';
  const target = await resolveTarget(req, usernameParam);
  if ('response' in target) return target.response;
  try {
    await deleteUserSources(target.db, target.username);
    return NextResponse.json({ available: true });
  } catch (err) {
    console.error('[LibreTV] 清除用户分配源失败：', err);
    return jsonError('清除用户分配源失败', 500);
  }
}
