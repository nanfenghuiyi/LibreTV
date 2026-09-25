import type {
  LiveSourceConfig,
  SharedSourcesPayload,
  SourceConfig,
  SubscriptionEntry,
} from './types';
import { ensureD1Table, getD1, type D1DatabaseLike } from './d1';

/**
 * 站点级共享源配置（D1 存储）：
 * 管理员凭 PASSWORD 通过 /api/shared/sources 编辑，登录访客均可读取使用。
 * 采用单行 KV 模式（k='sources'/'subs', v=JSON），首次写入时自动建表；
 * 采集/直播与订阅分两行存储，保存时未传入的字段保留原值。
 * Docker/Node 部署无 D1 绑定，相关函数返回 null / 抛出明确错误，调用方据此降级。
 */

const TABLE = 'shared_config';
const SOURCES_ROW_KEY = 'sources';
const SUBS_ROW_KEY = 'subs';
/** 防滥用上限：单站点共享源与直播源的最大数量 */
export const MAX_SHARED_SOURCES = 200;
export const MAX_SHARED_LIVE_SOURCES = 100;
export const MAX_SHARED_SUBSCRIPTIONS = 50;

// —— D1 绑定探测已抽离至 ./d1（与用户体系共用同一连接与降级逻辑） ——

/** 当前部署是否具备共享源存储（Workers + D1 绑定） */
export async function hasSharedStore(): Promise<boolean> {
  return (await getD1()) !== null;
}

// —— 建表（模块级一次性，isolate 生命周期内只跑一次） ——

async function ensureSchema(db: D1DatabaseLike): Promise<void> {
  await ensureD1Table(
    db,
    TABLE,
    `CREATE TABLE IF NOT EXISTS ${TABLE} (
      k TEXT PRIMARY KEY,
      v TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )`
  );
}

// —— 稳定 key：基于 url+name 哈希，重排序/重读不改变 key，客户端勾选状态得以保留 ——

export function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** key 前缀区分来源体系：shared_vod/shared_live（站点共享）、assign_vod/assign_live（用户分配） */
function makeKey(prefix: string, url: string, name: string): string {
  return `${prefix}_${fnv1a(`${url}|${name}`).toString(36)}`;
}

// —— 输入校验与规范化 ——

export function normalizeSharedSources(input: {
  sources?: unknown;
  liveSources?: unknown;
  subscriptions?: unknown;
}): { sources: SourceConfig[]; liveSources: LiveSourceConfig[]; subscriptions: SubscriptionEntry[] } {
  return {
    sources: normalizeVodSources(input.sources),
    liveSources: normalizeLiveSources(input.liveSources),
    subscriptions: normalizeSubscriptions(input.subscriptions),
  };
}

/**
 * 规范化点播源列表（key 前缀参数化，供共享源与用户分配源复用）。
 * name 非空、url 必须 http(s)；key 基于去尾斜杠后的 url+name 生成，
 * 同一地址因尾斜杠差异不应生成两个 key。
 */
export function normalizeVodSources(
  raw: unknown,
  keyPrefix = 'shared_vod',
  label = '采集站'
): SourceConfig[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new Error(`${label}必须是数组`);
  if (raw.length > MAX_SHARED_SOURCES) {
    throw new Error(`${label}数量超出上限（${raw.length} > ${MAX_SHARED_SOURCES}）`);
  }
  return raw.map((item, i) => {
    if (typeof item !== 'object' || item === null) throw new Error(`${label}第 ${i + 1} 项不是对象`);
    const { name, url, detail, isAdult } = item as Record<string, unknown>;
    if (typeof name !== 'string' || !name.trim()) throw new Error(`${label}第 ${i + 1} 项缺少 name`);
    if (typeof url !== 'string' || !/^https?:\/\//.test(url.trim())) {
      throw new Error(`${label}第 ${i + 1} 项的 url 必须以 http:// 或 https:// 开头`);
    }
    const cleanUrl = url.trim().replace(/\/+$/, '');
    return {
      key: makeKey(keyPrefix, cleanUrl, name.trim()),
      name: name.trim(),
      url: cleanUrl,
      detail: typeof detail === 'string' && detail.trim() ? detail.trim() : undefined,
      isAdult: isAdult === true,
    };
  });
}

/** 规范化直播源列表（key 前缀参数化，供共享源与用户分配源复用） */
export function normalizeLiveSources(
  raw: unknown,
  keyPrefix = 'shared_live',
  label = '直播源'
): LiveSourceConfig[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new Error(`${label}必须是数组`);
  if (raw.length > MAX_SHARED_LIVE_SOURCES) {
    throw new Error(`${label}数量超出上限（${raw.length} > ${MAX_SHARED_LIVE_SOURCES}）`);
  }
  return raw.map((item, i) => {
    if (typeof item !== 'object' || item === null) throw new Error(`${label}第 ${i + 1} 项不是对象`);
    const { name, url, epg } = item as Record<string, unknown>;
    if (typeof name !== 'string' || !name.trim()) throw new Error(`${label}第 ${i + 1} 项缺少 name`);
    if (typeof url !== 'string' || !/^https?:\/\//.test(url.trim())) {
      throw new Error(`${label}第 ${i + 1} 项的 url 必须以 http:// 或 https:// 开头`);
    }
    const cleanUrl = url.trim().replace(/\/+$/, '');
    return {
      key: makeKey(keyPrefix, cleanUrl, name.trim()),
      name: name.trim(),
      url: cleanUrl,
      epg: typeof epg === 'string' && epg.trim() ? epg.trim() : undefined,
    };
  });
}

/** 规范化订阅列表：url 归一化（trim + 去尾斜杠）并去重，name 可选 */
export function normalizeSubscriptions(raw: unknown, label = '订阅'): SubscriptionEntry[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new Error(`${label}必须是数组`);
  if (raw.length > MAX_SHARED_SUBSCRIPTIONS) {
    throw new Error(`${label}数量超出上限（${raw.length} > ${MAX_SHARED_SUBSCRIPTIONS}）`);
  }
  const seen = new Set<string>();
  const out: SubscriptionEntry[] = [];
  raw.forEach((item, i) => {
    if (typeof item !== 'object' || item === null) throw new Error(`${label}第 ${i + 1} 项不是对象`);
    const { url, name } = item as Record<string, unknown>;
    if (typeof url !== 'string' || !/^https?:\/\//.test(url.trim())) {
      throw new Error(`${label}第 ${i + 1} 项的 url 必须以 http:// 或 https:// 开头`);
    }
    const cleanUrl = url.trim().replace(/\/+$/, '');
    if (seen.has(cleanUrl)) return;
    seen.add(cleanUrl);
    out.push({
      url: cleanUrl,
      name: typeof name === 'string' && name.trim() ? name.trim() : undefined,
    });
  });
  return out;
}

// —— 读写 ——

/** 读取单行 JSON 并反序列化；行不存在或数据损坏时返回 null（损坏仅告警不抛错） */
async function readRow<T>(
  db: D1DatabaseLike,
  rowKey: string,
  what: string
): Promise<(T & { updatedAt: number }) | null> {
  const row = await db
    .prepare(`SELECT v, updated_at FROM ${TABLE} WHERE k = ?`)
    .bind(rowKey)
    .first<{ v: string; updated_at: number }>();
  if (!row) return null;
  try {
    return { ...(JSON.parse(row.v) as T), updatedAt: row.updated_at };
  } catch (err) {
    console.warn(`[LibreTV] ${what}数据损坏，已忽略：`, err instanceof Error ? err.message : err);
    return null;
  }
}

/** 读取共享源配置；无 D1、表未建或未配置过时返回 null */
export async function getSharedSources(): Promise<SharedSourcesPayload | null> {
  const db = await getD1();
  if (!db) return null;
  await ensureSchema(db);
  const sourcesRow = await readRow<{ sources: SourceConfig[]; liveSources: LiveSourceConfig[] }>(
    db,
    SOURCES_ROW_KEY,
    '共享源配置'
  );
  const subsRow = await readRow<{ subscriptions: SubscriptionEntry[] }>(db, SUBS_ROW_KEY, '共享订阅配置');
  if (!sourcesRow && !subsRow) return null;
  // 旧行数据（订阅功能上线前）缺 subscriptions 字段，normalize 补齐为空数组
  const normalized = normalizeSharedSources({
    sources: sourcesRow?.sources,
    liveSources: sourcesRow?.liveSources,
    subscriptions: subsRow?.subscriptions,
  });
  const updatedAt = Math.max(sourcesRow?.updatedAt ?? 0, subsRow?.updatedAt ?? 0);
  return { ...normalized, updatedAt: updatedAt || undefined };
}

/** 覆盖保存共享源配置（自动建表），返回保存后的完整配置；未传入的字段保留原值 */
export async function saveSharedSources(input: {
  sources?: unknown;
  liveSources?: unknown;
  subscriptions?: unknown;
}): Promise<SharedSourcesPayload> {
  const db = await getD1();
  if (!db) throw new Error('当前部署未配置 D1 数据库，无法使用站点共享源');
  await ensureSchema(db);

  // sources/liveSources/subs 三行独立 UPSERT：请求未携带的字段保留原值，
  // 便于后续扩展更多配置区块而不必整包提交
  const sourcesRow = await readRow<{ sources: SourceConfig[]; liveSources: LiveSourceConfig[] }>(
    db,
    SOURCES_ROW_KEY,
    '共享源配置'
  );
  const subsRow = await readRow<{ subscriptions: SubscriptionEntry[] }>(db, SUBS_ROW_KEY, '共享订阅配置');

  const upsert = async (rowKey: string, value: unknown) => {
    await db
      .prepare(
        `INSERT INTO ${TABLE} (k, v, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(k) DO UPDATE SET v = excluded.v, updated_at = excluded.updated_at`
      )
      .bind(rowKey, JSON.stringify(value), Date.now())
      .run();
  };

  let sources: SourceConfig[];
  let liveSources: LiveSourceConfig[];
  if (input.sources !== undefined || input.liveSources !== undefined) {
    sources = normalizeVodSources(input.sources);
    liveSources = normalizeLiveSources(input.liveSources);
    await upsert(SOURCES_ROW_KEY, { sources, liveSources });
  } else {
    const normalized = normalizeSharedSources({
      sources: sourcesRow?.sources,
      liveSources: sourcesRow?.liveSources,
    });
    sources = normalized.sources;
    liveSources = normalized.liveSources;
  }

  let subscriptions: SubscriptionEntry[];
  if (input.subscriptions !== undefined) {
    subscriptions = normalizeSubscriptions(input.subscriptions);
    await upsert(SUBS_ROW_KEY, { subscriptions });
  } else {
    subscriptions = normalizeSubscriptions(subsRow?.subscriptions);
  }

  return { sources, liveSources, subscriptions, updatedAt: Date.now() };
}
