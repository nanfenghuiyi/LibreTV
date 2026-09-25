/**
 * 共用 D1 访问层（Workers + Cloudflare D1 绑定，绑定名 DB）。
 *
 * 所有需要 D1 的模块（shared-config / user-auth / user-data）统一从这里获取连接：
 * - 动态 import @opennextjs/cloudflare：该包是 devDependency，next build（Docker）会把
 *   它打进 standalone 产物，运行时加载不失败；非 Workers 环境调用
 *   getCloudflareContext() 抛错，走 catch 降级为 null。
 * - Promise 级缓存：探测只执行一次，isolate 生命周期内复用。
 *
 * 采用最小结构类型（duck typing），避免依赖 @cloudflare/workers-types，
 * Node / 测试环境也能通过 tsc 编译。
 */

export interface D1PreparedStatementLike {
  bind(...values: (string | number | null)[]): D1PreparedStatementLike;
  first<T = unknown>(): Promise<T | null>;
  /** 多行查询（真实 D1 返回 { results: T[] }，测试 mock 按同结构实现） */
  all<T = unknown>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}

export interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatementLike;
  batch(statements: D1PreparedStatementLike[]): Promise<unknown>;
}

let d1Promise: Promise<D1DatabaseLike | null> | null = null;

/** 获取 D1 绑定；非 Workers 部署（Docker/Node）或未绑定 DB 时返回 null */
export function getD1(): Promise<D1DatabaseLike | null> {
  if (!d1Promise) {
    d1Promise = (async () => {
      try {
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

// —— 建表辅助（模块级一次性缓存，isolate 生命周期内每张表只建一次） ——

const schemaReadyTables = new Set<string>();

/** CREATE TABLE IF NOT EXISTS 兜底（首次调用执行，之后命中内存缓存直接跳过） */
export async function ensureD1Table(db: D1DatabaseLike, table: string, ddl: string): Promise<void> {
  if (schemaReadyTables.has(table)) return;
  await db.prepare(ddl).run();
  schemaReadyTables.add(table);
}

/** 测试专用：清空建表缓存（供注入 mock D1 后强制重建） */
export function __resetD1SchemaCache(): void {
  schemaReadyTables.clear();
}
