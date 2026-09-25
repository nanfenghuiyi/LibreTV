import { NextResponse } from 'next/server';
import { requireAdminUser, jsonError } from '@/lib/api-guard';
import { getD1 } from '@/lib/d1';
import {
  createInviteCode,
  deleteInviteCode,
  listInviteCodes,
  type InviteCodeRow,
} from '@/lib/user-auth';
import type { AdminInviteRow } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 邀请码管理（仅管理员）：
 * GET    列出全部邀请码
 * POST   创建（可选有效期天数 / 使用次数 / 备注）
 * DELETE 作废邀请码（query 参数 code）
 * 无 D1 部署返回 available=false（前端据此隐藏管理面板）。
 */

function toAdminInviteRow(r: InviteCodeRow): AdminInviteRow {
  return {
    code: r.code,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    usedCount: r.used_count,
    maxUses: r.max_uses,
    note: r.note,
  };
}

export async function GET(req: Request) {
  const guard = await requireAdminUser(req);
  if (!guard.ok) return guard.response;
  const db = await getD1();
  if (!db) return NextResponse.json({ available: false, invites: [] });
  const invites = await listInviteCodes(db);
  return NextResponse.json({ available: true, invites: invites.map(toAdminInviteRow) });
}

export async function POST(req: Request) {
  const guard = await requireAdminUser(req);
  if (!guard.ok) return guard.response;
  const db = await getD1();
  if (!db) return jsonError('当前部署未配置 D1 数据库', 501);

  let body: { maxUses?: unknown; expiresInDays?: unknown; note?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonError('请求体不是合法 JSON', 400);
  }
  const opts: { maxUses?: number; expiresInDays?: number; note?: string } = {};
  if (body.maxUses !== undefined) {
    if (
      typeof body.maxUses !== 'number' ||
      !Number.isInteger(body.maxUses) ||
      body.maxUses < 1 ||
      body.maxUses > 999
    ) {
      return jsonError('maxUses 需为 1-999 的整数', 400);
    }
    opts.maxUses = body.maxUses;
  }
  if (body.expiresInDays !== undefined) {
    if (
      typeof body.expiresInDays !== 'number' ||
      !Number.isInteger(body.expiresInDays) ||
      body.expiresInDays < 1 ||
      body.expiresInDays > 3650
    ) {
      return jsonError('expiresInDays 需为 1-3650 的整数', 400);
    }
    opts.expiresInDays = body.expiresInDays;
  }
  if (body.note !== undefined) {
    if (typeof body.note !== 'string') return jsonError('note 必须是字符串', 400);
    const note = body.note.trim().slice(0, 100);
    if (note) opts.note = note;
  }

  try {
    const invite = await createInviteCode(db, opts);
    return NextResponse.json({ available: true, invite: toAdminInviteRow(invite) });
  } catch (err) {
    console.error('[LibreTV] 创建邀请码失败：', err);
    return jsonError(err instanceof Error ? err.message : '创建邀请码失败', 500);
  }
}

export async function DELETE(req: Request) {
  const guard = await requireAdminUser(req);
  if (!guard.ok) return guard.response;
  const db = await getD1();
  if (!db) return jsonError('当前部署未配置 D1 数据库', 501);

  const code = new URL(req.url).searchParams.get('code')?.trim() ?? '';
  if (!code) return jsonError('缺少 code 参数', 400);
  try {
    await deleteInviteCode(db, code);
    return NextResponse.json({ available: true });
  } catch (err) {
    console.error('[LibreTV] 删除邀请码失败：', err);
    return jsonError(err instanceof Error ? err.message : '删除邀请码失败', 500);
  }
}
