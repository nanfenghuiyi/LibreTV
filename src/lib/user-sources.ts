import type { AssignedSourcesPayload } from './types';
import { ensureD1Table, type D1DatabaseLike } from './d1';
import {
  normalizeLiveSources,
  normalizeSubscriptions,
  normalizeVodSources,
} from './shared-config';

/**
 * 用户专属数据源（D1 存储）：
 * 管理员在 /api/admin/user-sources 为指定用户分配采集源/直播源/订阅。
 * 该用户登录后进入「替换模式」：内置默认源与站点共享源不再下发，
 * 仅呈现管理员分配的源；用户本地自定义源不受影响。
 * 单行 KV 模式（username 主键，v=JSON），首次写入自动建表；
 * Docker/Node 部署无 D1 绑定，相关函数返回 null / 抛出明确错误，调用方据此降级。
 */

const TABLE = 'user_sources';

const DDL = `CREATE TABLE IF NOT EXISTS ${TABLE} (
  username TEXT PRIMARY KEY,
  v TEXT NOT NULL,
  updated_at INTEGER NOT NULL
)`;

async function ensureSchema(db: D1DatabaseLike): Promise<void> {
  await ensureD1Table(db, TABLE, DDL);
}

// —— 读写 ——

/** 读取指定用户的分配源；无 D1、表未建或未分配过时返回 null */
export async function getUserSources(
  db: D1DatabaseLike,
  username: string
): Promise<AssignedSourcesPayload | null> {
  await ensureSchema(db);
  const row = await db
    .prepare(`SELECT v, updated_at FROM ${TABLE} WHERE username = ?`)
    .bind(username)
    .first<{ v: string; updated_at: number }>();
  if (!row) return null;
  let raw: { sources?: unknown; liveSources?: unknown; subscriptions?: unknown };
  try {
    raw = JSON.parse(row.v) as typeof raw;
  } catch (err) {
    console.warn('[LibreTV] 用户分配源数据损坏，已忽略：', err instanceof Error ? err.message : err);
    return null;
  }
  const sources = normalizeVodSources(raw.sources, 'assign_vod', '分配采集站');
  const liveSources = normalizeLiveSources(raw.liveSources, 'assign_live', '分配直播源');
  const subscriptions = normalizeSubscriptions(raw.subscriptions, '分配订阅');
  // 三类全为空视为未分配（管理员保存过空配置），等同 null
  if (!sources.length && !liveSources.length && !subscriptions.length) return null;
  return { sources, liveSources, subscriptions, updatedAt: row.updated_at };
}

/**
 * 全量覆盖保存指定用户的分配源（自动建表），返回保存后的完整配置。
 * 未传入的字段按空数组覆盖——「清除分配」即 PUT 三个空数组。
 */
export async function saveUserSources(
  db: D1DatabaseLike,
  username: string,
  input: { sources?: unknown; liveSources?: unknown; subscriptions?: unknown }
): Promise<AssignedSourcesPayload> {
  await ensureSchema(db);
  const sources = normalizeVodSources(input.sources, 'assign_vod', '分配采集站');
  const liveSources = normalizeLiveSources(input.liveSources, 'assign_live', '分配直播源');
  const subscriptions = normalizeSubscriptions(input.subscriptions, '分配订阅');
  const updatedAt = Date.now();
  await db
    .prepare(
      `INSERT INTO ${TABLE} (username, v, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(username) DO UPDATE SET v = excluded.v, updated_at = excluded.updated_at`
    )
    .bind(username, JSON.stringify({ sources, liveSources, subscriptions }), updatedAt)
    .run();
  return { sources, liveSources, subscriptions, updatedAt };
}

/** 删除指定用户的分配配置；返回是否存在过该行 */
export async function deleteUserSources(
  db: D1DatabaseLike,
  username: string
): Promise<boolean> {
  await ensureSchema(db);
  const result = (await db
    .prepare(`DELETE FROM ${TABLE} WHERE username = ?`)
    .bind(username)
    .run()) as { meta?: { changes?: number } };
  return (result.meta?.changes ?? 0) > 0;
}

/** 列出已被分配专属源的用户名集合（管理面板徽标用） */
export async function listAssignedUsernames(db: D1DatabaseLike): Promise<Set<string>> {
  await ensureSchema(db);
  const { results } = await db.prepare(`SELECT username FROM ${TABLE}`).all<{ username: string }>();
  return new Set((results ?? []).map((r) => r.username));
}
