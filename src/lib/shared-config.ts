import type { LiveSourceConfig, SourceConfig, SharedSourcesPayload } from './types';

/**
 * 站点级共享源配置（D1 存储）：
 * 管理员凭 PASSWORD 通过 /api/shared/sources 编辑，登录访客均可读取使用。
 * 采用单行 KV 模式（k='sources', v=JSON），首次写入时自动建表。
 * Docker/Node 部署无 D1 绑定，相关函数返回 null / 抛出明确错误，调用方据此降级。
 */

// —— 最小 D1 结构类型（避免依赖 @cloudflare/workers-types，Node/测试环境也能编译） ——

interface D1PreparedStatementLike {
  bind(...values: (string | number | null)[]): D1PreparedStatementLike;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<unknown>;
}
interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatementLike;
  batch(statements: D1PreparedStatementLike[]): Promise<unknown>;
}

const TABLE = 'shared_config';
const ROW_KEY = 'sources';
/** 防滥用上限：单站点共享源与直播源的最大数量 */
export const MAX_SHARED_SOURCES = 200;
export const MAX_SHARED_LIVE_SOURCES = 100;

// —— D1 绑定探测（Workers 有 DB 绑定，其余环境降级为 null） ——

let d1Promise: Promise<D1DatabaseLike | null> | null = null;

async function getD1(): Promise<D1DatabaseLike | null> {
  if (!d1Promise) {
    d1Promise = (async () => {
      try {
        // 动态 import：@opennextjs/cloudflare 为 devDependency，
        // next build（Docker）会将其打进 standalone 产物，运行时加载不失败；
        // 非 Workers 环境调用 getCloudflareContext() 抛错，走 catch 降级。
        const mod = await import('@opennextjs/cloudflare');
        const { env } = mod.getCloudflareContext();
        const db = (env as Record<string, unknown>).DB;
        return isD1(db) ? db : null;
      } catch {
        return null;
      }
    })();
  }
  return d1Promise;
}

function isD1(value: unknown): value is D1DatabaseLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as D1DatabaseLike).prepare === 'function'
  );
}

/** 当前部署是否具备共享源存储（Workers + D1 绑定） */
export async function hasSharedStore(): Promise<boolean> {
  return (await getD1()) !== null;
}

// —— 建表（模块级一次性，isolate 生命周期内只跑一次） ——

let schemaReady = false;

async function ensureSchema(db: D1DatabaseLike): Promise<void> {
  if (schemaReady) return;
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS ${TABLE} (
        k TEXT PRIMARY KEY,
        v TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )`
    )
    .run();
  schemaReady = true;
}

// —— 稳定 key：基于 url+name 哈希，重排序/重读不改变 key，客户端勾选状态得以保留 ——

function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function makeKey(prefix: 'shared_vod' | 'shared_live', url: string, name: string): string {
  return `${prefix}_${fnv1a(`${url}|${name}`).toString(36)}`;
}

// —— 输入校验与规范化 ——

export function normalizeSharedSources(input: {
  sources?: unknown;
  liveSources?: unknown;
}): { sources: SourceConfig[]; liveSources: LiveSourceConfig[] } {
  const sources = normalizeVodSources(input.sources);
  const liveSources = normalizeLiveSources(input.liveSources);
  return { sources, liveSources };
}

function normalizeVodSources(raw: unknown): SourceConfig[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new Error('sources 必须是数组');
  if (raw.length > MAX_SHARED_SOURCES) {
    throw new Error(`采集站数量超出上限（${raw.length} > ${MAX_SHARED_SOURCES}）`);
  }
  return raw.map((item, i) => {
    if (typeof item !== 'object' || item === null) throw new Error(`采集站第 ${i + 1} 项不是对象`);
    const { name, url, detail, isAdult } = item as Record<string, unknown>;
    if (typeof name !== 'string' || !name.trim()) throw new Error(`采集站第 ${i + 1} 项缺少 name`);
    if (typeof url !== 'string' || !/^https?:\/\//.test(url.trim())) {
      throw new Error(`采集站第 ${i + 1} 项的 url 必须以 http:// 或 https:// 开头`);
    }
    // key 基于去尾斜杠后的 url：同一地址因尾斜杠差异不应生成两个 key
    const cleanUrl = url.trim().replace(/\/+$/, '');
    return {
      key: makeKey('shared_vod', cleanUrl, name.trim()),
      name: name.trim(),
      url: cleanUrl,
      detail: typeof detail === 'string' && detail.trim() ? detail.trim() : undefined,
      isAdult: isAdult === true,
    };
  });
}

function normalizeLiveSources(raw: unknown): LiveSourceConfig[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new Error('liveSources 必须是数组');
  if (raw.length > MAX_SHARED_LIVE_SOURCES) {
    throw new Error(`直播源数量超出上限（${raw.length} > ${MAX_SHARED_LIVE_SOURCES}）`);
  }
  return raw.map((item, i) => {
    if (typeof item !== 'object' || item === null) throw new Error(`直播源第 ${i + 1} 项不是对象`);
    const { name, url, epg } = item as Record<string, unknown>;
    if (typeof name !== 'string' || !name.trim()) throw new Error(`直播源第 ${i + 1} 项缺少 name`);
    if (typeof url !== 'string' || !/^https?:\/\//.test(url.trim())) {
      throw new Error(`直播源第 ${i + 1} 项的 url 必须以 http:// 或 https:// 开头`);
    }
    const cleanUrl = url.trim().replace(/\/+$/, '');
    return {
      key: makeKey('shared_live', cleanUrl, name.trim()),
      name: name.trim(),
      url: cleanUrl,
      epg: typeof epg === 'string' && epg.trim() ? epg.trim() : undefined,
    };
  });
}

// —— 读写 ——

/** 读取共享源配置；无 D1、表未建或未配置过时返回 null */
export async function getSharedSources(): Promise<SharedSourcesPayload | null> {
  const db = await getD1();
  if (!db) return null;
  await ensureSchema(db);
  const row = await db
    .prepare(`SELECT v, updated_at FROM ${TABLE} WHERE k = ?`)
    .bind(ROW_KEY)
    .first<{ v: string; updated_at: number }>();
  if (!row) return null;
  try {
    const parsed = normalizeSharedSources(JSON.parse(row.v));
    return { ...parsed, updatedAt: row.updated_at };
  } catch (err) {
    console.warn('[LibreTV] 共享源配置数据损坏，已忽略：', err instanceof Error ? err.message : err);
    return null;
  }
}

/** 覆盖保存共享源配置（自动建表），返回保存后的完整配置 */
export async function saveSharedSources(input: {
  sources?: unknown;
  liveSources?: unknown;
}): Promise<SharedSourcesPayload> {
  const db = await getD1();
  if (!db) throw new Error('当前部署未配置 D1 数据库，无法使用站点共享源');
  await ensureSchema(db);
  const normalized = normalizeSharedSources(input);
  const updatedAt = Date.now();
  await db
    .prepare(
      `INSERT INTO ${TABLE} (k, v, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(k) DO UPDATE SET v = excluded.v, updated_at = excluded.updated_at`
    )
    .bind(ROW_KEY, JSON.stringify(normalized), updatedAt)
    .run();
  return { ...normalized, updatedAt };
}
