import { NextResponse } from 'next/server';
import { guardRequest, jsonError } from '@/lib/api-guard';
import {
  getSharedSources,
  hasSharedStore,
  saveSharedSources,
} from '@/lib/shared-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 站点级共享源配置（存于 Cloudflare D1）。
 * GET：登录访客读取（无 D1 时 available=false，前端隐藏站点源功能）。
 * PUT：凭 PASSWORD 会话覆盖保存，所有访客生效。
 */
export async function GET(req: Request) {
  const guarded = guardRequest(req);
  if (guarded) return guarded;

  if (!(await hasSharedStore())) {
    return NextResponse.json({ available: false, config: null });
  }
  try {
    return NextResponse.json({ available: true, config: await getSharedSources() });
  } catch (err) {
    console.error('[LibreTV] 读取共享源失败：', err);
    return jsonError('读取共享源失败', 500);
  }
}

export async function PUT(req: Request) {
  const guarded = guardRequest(req);
  if (guarded) return guarded;

  if (!(await hasSharedStore())) {
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
      (body ?? {}) as { sources?: unknown; liveSources?: unknown }
    );
    return NextResponse.json({ available: true, config });
  } catch (err) {
    const message = err instanceof Error ? err.message : '保存共享源失败';
    const status = /必须是数组|不是对象|缺少|必须以|超出上限/.test(message) ? 400 : 500;
    if (status === 500) console.error('[LibreTV] 保存共享源失败：', err);
    return jsonError(message, status);
  }
}
