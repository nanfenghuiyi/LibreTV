import { NextResponse } from 'next/server';
import { requireUser, requireAdminUser, jsonError } from '@/lib/api-guard';
import { getD1 } from '@/lib/d1';
import {
  getSharedSources,
  saveSharedSources,
} from '@/lib/shared-config';
import { getUserSources } from '@/lib/user-sources';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 站点级共享源配置（存于 Cloudflare D1）。
 * GET：登录访客读取站点共享源及本人的管理员分配源
 *   （有分配时前端进入替换模式，仅呈现分配源；无 D1 时 available=false，前端隐藏站点源功能）。
 * PUT：仅管理员可覆盖保存（用户体系可用时 D1 复查；所有访客生效）。
 */
export async function GET(req: Request) {
  const guard = await requireUser(req);
  if (!guard.ok) return guard.response;

  const db = await getD1();
  if (!db) {
    return NextResponse.json({ available: false, config: null, assigned: null });
  }
  try {
    const [config, assigned] = await Promise.all([
      getSharedSources(),
      getUserSources(db, guard.session.userId),
    ]);
    return NextResponse.json({ available: true, config, assigned });
  } catch (err) {
    console.error('[LibreTV] 读取共享源失败：', err);
    return jsonError('读取共享源失败', 500);
  }
}

export async function PUT(req: Request) {
  const guard = await requireAdminUser(req);
  if (!guard.ok) return guard.response;

  const db = await getD1();
  if (!db) {
    return jsonError('当前部署未配置 D1 数据库，无法使用站点共享源', 501);
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError('请求体不是合法 JSON', 400);
  }
  try {
    const config = await saveSharedSources(
      (body ?? {}) as { sources?: unknown; liveSources?: unknown; subscriptions?: unknown }
    );
    return NextResponse.json({ available: true, config });
  } catch (err) {
    const message = err instanceof Error ? err.message : '保存共享源失败';
    const status = /必须是数组|不是对象|缺少|必须以|超出上限/.test(message) ? 400 : 500;
    if (status === 500) console.error('[LibreTV] 保存共享源失败：', err);
    return jsonError(message, status);
  }
}
