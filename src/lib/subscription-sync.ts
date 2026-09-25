'use client';

import { api } from './client-api';
import { normalizeSubscriptionUrl } from './source-list';
import { useAppStore } from './store';
import { describeParseStats } from './tvbox-parser';
import type { AuthStatusResponse, SubscriptionParseStats } from './types';

/**
 * 数据源订阅同步核心逻辑，供两处复用：
 * - source-manager：用户在设置抽屉中手动添加/重新同步（UI 层加 toast 反馈）；
 * - bootstrapSources：预置/站点/分配三类托管订阅在启动或登录后的自动导入与静默重同步。
 *
 * 订阅内容由服务端自动识别格式（LibreTV-SourceList JSON 或 TVBOX 配置 JSON），
 * applySubscriptionSources / applySubscriptionLive 均按订阅前缀整体替换且保留
 * 用户勾选状态，同步失败时不调用即无副作用——旧数据自动保留。
 */
export interface SubscriptionSyncResult {
  name?: string;
  vodCount: number;
  liveCount: number;
  /** 解析统计（识别格式、跳过与截断条目），用于导入结果提示 */
  stats?: SubscriptionParseStats;
}

export async function syncSourceSubscription(rawUrl: string): Promise<SubscriptionSyncResult> {
  // 统一归一化（trim + 去尾斜杠）：与 DEFAULT_SUBSCRIPTIONS 预置地址保持同一形态，
  // 避免同一订阅地址因尾斜杠差异被存成两条订阅
  const url = normalizeSubscriptionUrl(rawUrl);
  try {
    const { name, sources, liveSources, stats } = await api.fetchSourceList(url);
    if (sources.length === 0 && liveSources.length === 0) {
      throw new Error('订阅内容为空');
    }
    const store = useAppStore.getState();
    const vodCount = store.applySubscriptionSources(url, sources);
    const liveCount = store.applySubscriptionLive(url, liveSources);
    // 仅对本订阅引用的直播源记录同步时间（多归属：共享源也会被标记为新鲜，
    // 但名称/EPG 由 store 的「首次导入为准、缺失补齐」语义保护，不会被本订阅覆盖）
    const importedLiveUrls = new Set(
      useAppStore.getState().liveSubscriptions
        .filter((s) => s.fromSubscriptions.includes(url))
        .map((s) => s.url)
    );
    for (const s of liveSources) {
      if (importedLiveUrls.has(s.url)) store.markLiveSynced(s.url, s.name, s.epg);
    }
    store.addSubscription(url, name);
    store.markSubscriptionSynced(url, name, { vod: vodCount, live: liveCount });
    return { name, vodCount, liveCount, stats };
  } catch (err) {
    // 记录失败状态供订阅列表展示（首次添加未成功时不产生条目）；已导入的旧数据保持不动
    const message = err instanceof Error ? err.message : '订阅同步失败';
    useAppStore.getState().markSubscriptionFailed(url, message);
    throw err instanceof Error ? err : new Error(message);
  }
}

/** 托管订阅超过该间隔未同步时，启动阶段静默刷新一次 */
const MANAGED_SUB_RESYNC_MS = 24 * 60 * 60 * 1000;

/** 三类托管订阅各自的 seen 集合字段（互不相干，用户删除其一不影响其余） */
type ManagedBucket = 'env' | 'site' | 'assigned';

const SEEN_FIELD: Record<ManagedBucket, 'envSubsSeen' | 'siteSubsSeen' | 'assignedSubsSeen'> = {
  env: 'envSubsSeen',
  site: 'siteSubsSeen',
  assigned: 'assignedSubsSeen',
};

/**
 * 托管订阅的启动期自动导入与静默刷新（env=部署者预置 / site=站点共享 / assigned=管理员分配）。
 *
 * seen 标记仅在同步成功后写入：
 * - 同步成功 → 标记 seen，用户此后删除该订阅不会被自动加回；
 * - 同步失败 → 不标记，下次启动自动重试，已导入的旧数据保持不动。
 * 已存在的订阅超过 24h 未同步时静默刷新（成功过但 seen 机制上线前的旧数据也会借此补标）。
 */
export async function syncManagedSubscriptions(
  subs: { url: string; name?: string }[],
  bucket: ManagedBucket,
  label = '托管订阅'
): Promise<void> {
  const seenField = SEEN_FIELD[bucket];
  for (const sub of subs) {
    const store = useAppStore.getState();
    try {
      const existing = store.subscriptions.find((s) => s.url === sub.url);
      let result: SubscriptionSyncResult | undefined;
      if (existing) {
        if (existing.lastSync && Date.now() - existing.lastSync < MANAGED_SUB_RESYNC_MS) {
          store.markSubsSeen(bucket, [sub.url]);
          continue;
        }
        result = await syncSourceSubscription(sub.url);
      } else {
        // 已成功过且被用户删除的托管订阅：尊重用户选择，不再加回
        if (store[seenField].includes(sub.url)) continue;
        result = await syncSourceSubscription(sub.url);
      }
      // 托管订阅对用户是静默的，跳过/截断情况写入控制台供部署者排查（只记计数，不打印配置内容）
      if (result?.stats && result.stats.skipped > 0) {
        console.info(`[LibreTV] ${label}部分条目未导入：`, sub.url, describeParseStats(result.stats));
      }
      useAppStore.getState().markSubsSeen(bucket, [sub.url]);
    } catch (err) {
      console.warn(
        `[LibreTV] ${label}同步失败（下次启动将重试）：`,
        sub.url,
        err instanceof Error ? err.message : err
      );
    }
  }
}

/** 兼容包装：部署者通过 DEFAULT_SUBSCRIPTIONS 预置的订阅 */
export async function syncEnvSubscriptions(subs: { url: string; name?: string }[]): Promise<void> {
  await syncManagedSubscriptions(subs, 'env', '预置订阅');
}

/**
 * 应用 /api/status 下发的部署者预置数据（预置点播源 / 预置直播源 / 预置订阅）。
 *
 * 调用点有两处，缺一不可：
 * - Providers 首屏拿到 /api/status 后调用（此时可能尚未登录）；
 * - AuthProvider 登录成功后补调一次——预置订阅要经鉴权接口 /api/source-list 拉取，
 *   首屏那次在登录前会 401 静默失败，不补调则本次会话内不会出现预置订阅。
 *
 * 重复调用是安全的：setEnvSources / setLiveEnvSources 幂等，syncEnvSubscriptions
 * 对已同步（24h 内）的订阅会跳过，对已成功过的订阅也不会重复导入。
 */
export async function applyEnvPresets(status: AuthStatusResponse): Promise<void> {
  if (Array.isArray(status.defaultSources)) {
    useAppStore.getState().setEnvSources(status.defaultSources);
  }
  if (Array.isArray(status.defaultLiveSources)) {
    useAppStore.getState().setLiveEnvSources(status.defaultLiveSources);
  }
  if (Array.isArray(status.defaultSubscriptions) && status.defaultSubscriptions.length > 0) {
    await syncEnvSubscriptions(status.defaultSubscriptions);
  }
}

/**
 * 拉取站点共享源（管理员存于 Cloudflare D1）并合入本地 store，含站点级订阅同步。
 *
 * 仅在已登录后调用：接口需要鉴权，未登录调用会 401 触发全局登录框。
 * 未配置 D1 的部署（available=false）与请求失败均静默忽略——共享源是可选增强，
 * 失败不影响本地源的使用；下次登录成功时会再次尝试。
 *
 * 重复调用是安全的：setSharedSources 幂等，seen 标记（sharedKeysSeen）保证
 * 用户取消勾选的共享源不会被反复勾回。
 */
export async function syncSharedSources(): Promise<void> {
  try {
    const { available, config } = await api.getSharedSources();
    if (!available || !config) return;
    useAppStore.getState().setSharedSources(config.sources, config.liveSources);
    if (config.subscriptions.length > 0) {
      await syncManagedSubscriptions(config.subscriptions, 'site', '站点订阅');
    }
  } catch {
    // 静默：共享源是可选增强，失败不影响本地源的使用
  }
}

/**
 * 源体系统一启动入口（Providers 首屏与登录成功共用）：
 *
 * 1. 未登录：仅应用 env 预置（托管订阅拉取会 401 静默失败，登录后补跑）；
 * 2. 已登录：拉取站点共享源与本人分配源——
 *    - 有分配（三类任一非空）→ 替换模式：清空 env/shared 下发、跳过 env 预置，
 *      仅应用分配源与分配订阅；用户自定义源（customAPIs）不受影响；
 *    - 无分配 → 应用站点共享源与站点订阅，再照常应用 env 预置。
 *
 * 替换模式下清空 env/shared 只清数据不清勾选意图（selectedKeys 与各 seen 集合保留），
 * 管理员撤销分配后源恢复下发时，用户此前的勾选状态自动还原。
 * 失败静默：源是增强能力，任何一步失败都不影响本地已有源的使用。
 */
export async function bootstrapSources(status: AuthStatusResponse): Promise<void> {
  if (!status.verified) {
    await applyEnvPresets(status);
    return;
  }

  let data: Awaited<ReturnType<typeof api.getSharedSources>> | null = null;
  try {
    data = await api.getSharedSources();
  } catch {
    // 拉取失败：走 env 预置兜底
  }

  const assigned = data?.available ? data.assigned : null;
  if (
    assigned &&
    (assigned.sources.length > 0 || assigned.liveSources.length > 0 || assigned.subscriptions.length > 0)
  ) {
    const store = useAppStore.getState();
    store.setEnvSources([]);
    store.setLiveEnvSources([]);
    store.setSharedSources([], []);
    store.setAssignedSources(assigned.sources, assigned.liveSources);
    if (assigned.subscriptions.length > 0) {
      await syncManagedSubscriptions(assigned.subscriptions, 'assigned', '分配订阅');
    }
    return;
  }

  if (data?.available && data.config) {
    useAppStore.getState().setSharedSources(data.config.sources, data.config.liveSources);
    if (data.config.subscriptions.length > 0) {
      await syncManagedSubscriptions(data.config.subscriptions, 'site', '站点订阅');
    }
  }
  await applyEnvPresets(status);
}
