import { NextResponse } from 'next/server';
import { jsonError, requireUser } from '@/lib/api-guard';
import { getD1 } from '@/lib/d1';
import { MAX_BODY_BYTES, UserDataError, type UserDataPutInput, getAllUserData, putUserData } from '@/lib/user-data';

export const runtime = 'nodejs';

/**
 * 个人数据云同步（仅本人数据）。
 * 未配置 D1 时返回 available:false（客户端据此禁用云同步，不视为错误）。
 */
export async function GET(req: Request) {
  const guard = await requireUser(req);
  if (!guard.ok) return guard.response;

  const db = await getD1();
  if (!db) return NextResponse.json({ available: false, items: [] });

  const items = await getAllUserData(db, guard.session.userId);
  return NextResponse.json({ available: true, items });
}

export async function PUT(req: Request) {
  const guard = await requireUser(req);
  if (!guard.ok) return guard.response;

  const db = await getD1();
  if (!db) return NextResponse.json({ available: false, updated: 0 });

  // 请求体大小限制（Content-Length 不可靠，直接量文本字节）
  const text = await req.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    return jsonError('请求数据超过 256KB 上限', 413);
  }

  let body: UserDataPutInput;
  try {
    body = JSON.parse(text) as UserDataPutInput;
  } catch {
    return jsonError('请求格式错误', 400);
  }

  try {
    const { updated } = await putUserData(db, guard.session.userId, body);
    return NextResponse.json({ available: true, updated });
  } catch (err) {
    if (err instanceof UserDataError) return jsonError(err.message, 400);
    console.error('[LibreTV] 用户数据写入失败：', err);
    return jsonError('数据写入失败', 500);
  }
}
