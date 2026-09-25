'use client';

import type { UserDataItem } from './types';
import { ApiError, api } from './client-api';
import {
  db,
  setPushSink,
  type HistoryEntry,
  type ProgressEntry,
  type SearchHistoryEntry,
  type SyncPushOp,
} from './db';
import { useAppStore } from './store';

/**
 * 个人数据云同步引擎（登录后启用）：
 * - 登录时 full sync：全量拉云端 → LWW 合并进本地 → 把本地较新的行推回云端；
 * - 日常写入由 db.ts 写路径经 pushSink 回调进入队列，500ms 去抖聚合批量 PUT；
 * - 设置快照每 30s 轮询 localStorage，变化才推送（zustand persist 无变更回调）。
 *
 * 合并规则：history 逐条 LWW（entry.timestamp 为序）；progress LWW 且进度不回退
 * （position 取大者）；搜索历史 / 设置为整表快照 LWW。
 * 已知限制：接受离线设备的旧数据在重新登录时推回云端（无墓碑机制）。
 */

const SETTINGS_KEY = 'libretv-settings';
const SETTINGS_META_KEY = 'libretv-settings-sync';
const DEBOUNCE_MS = 500;
const SETTINGS_POLL_MS = 30_000;
const PUT_CHUNK = 200; // 服务端单次 PUT items 上限
const MAX_PROGRESS_PUSH = 300; // 与服务端 progress 行数上限一致
const MAX_QUEUE = 2000;

let enabled = false;
let cloudAvailable = false;
let queue: SyncPushOp[] = [];
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let settingsTimer: ReturnType<typeof setInterval> | null = null;
let lastSettingsRaw: string | null = null;
let syncing = false; // full sync 进行中：防并发，期间防抖 flush 让路

// —— 入口 ——

/** 登录成功后调用：启用云同步并执行一次 full sync */
export function startUserSync(): void {
  if (enabled) return;
  enabled = true;
  setPushSink(enqueue);
  settingsTimer = setInterval(checkSettings, SETTINGS_POLL_MS);
  void fullSync();
}

/** 登出时调用：停用云同步，本地数据保留 */
export function stopUserSync(): void {
  enabled = false;
  cloudAvailable = false;
  setPushSink(null);
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (settingsTimer) {
    clearInterval(settingsTimer);
    settingsTimer = null;
  }
  queue = [];
  lastSettingsRaw = null;
  syncing = false;
}

// —— 推送队列 ——

function enqueue(op: SyncPushOp): void {
  if (!enabled || !cloudAvailable) return;
  if (queue.length >= MAX_QUEUE) queue.shift();
  queue.push(op);
  scheduleFlush();
}

function scheduleFlush(): void {
  if (debounceTimer) return;
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void flushQueue();
  }, DEBOUNCE_MS);
}

async function flushQueue(): Promise<void> {
  if (!enabled) return;
  if (syncing) {
    scheduleFlush(); // full sync 结束后统一 flush
    return;
  }
  const ops = queue;
  queue = [];
  if (ops.length === 0) return;
  try {
    const payload = await aggregate(ops);
    if (payload) await putInBatches(payload);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 400 || err.status === 413)) {
      // 数据超限等永久性拒绝：丢弃本批，避免无限重试
      console.warn('[LibreTV] 云同步推送被拒绝，已丢弃本批：', err.message);
      return;
    }
    // 网络/服务端临时故障：放回队首，下次写入时重试
    queue = [...ops, ...queue];
    console.warn('[LibreTV] 云同步推送失败，稍后重试：', err);
  }
}

interface AggPayload {
  items: UserDataItem[];
  deletes: { type: string; keys: string[] }[];
  clears: string[];
}

/** 聚合同批操作：同键 upsert 覆盖 delete，clear 吞掉之前的 delete/upsert */
async function aggregate(ops: SyncPushOp[]): Promise<AggPayload | null> {
  const historyUpserts = new Map<string, HistoryEntry>();
  const historyDeletes = new Set<string>();
  let historyClear = false;
  const progressUpserts = new Map<string, ProgressEntry>();
  const progressDeletes = new Set<string>();
  let progressClear = false;
  let searchDirty = false;
  let settingsDirty = false;

  for (const op of ops) {
    switch (op.kind) {
      case 'history-upsert':
        historyUpserts.set(op.entry.id, op.entry);
        historyDeletes.delete(op.entry.id);
        break;
      case 'history-delete':
        historyDeletes.add(op.id);
        historyUpserts.delete(op.id);
        break;
      case 'history-clear':
        historyUpserts.clear();
        historyDeletes.clear();
        historyClear = true;
        break;
      case 'progress-upsert':
        progressUpserts.set(op.entry.key, op.entry);
        progressDeletes.delete(op.entry.key);
        break;
      case 'progress-clear':
        progressDeletes.add(op.key);
        progressUpserts.delete(op.key);
        break;
      case 'progress-clear-all':
        progressUpserts.clear();
        progressDeletes.clear();
        progressClear = true;
        break;
      case 'search-list':
        searchDirty = true;
        break;
      case 'settings-snapshot':
        settingsDirty = true;
        break;
    }
  }

  const items: UserDataItem[] = [];
  const deletes: AggPayload['deletes'] = [];
  const clears: string[] = [];

  for (const entry of historyUpserts.values()) {
    items.push({ type: 'history', k: entry.id, v: JSON.stringify(entry), updatedAt: entry.timestamp });
  }
  if (historyClear) {
    clears.push('history');
  } else if (historyDeletes.size > 0) {
    deletes.push({ type: 'history', keys: [...historyDeletes] });
  }

  for (const entry of progressUpserts.values()) {
    items.push({ type: 'progress', k: entry.key, v: JSON.stringify(entry), updatedAt: entry.updatedAt });
  }
  if (progressClear) {
    clears.push('progress');
  } else if (progressDeletes.size > 0) {
    deletes.push({ type: 'progress', keys: [...progressDeletes] });
  }

  if (searchDirty) {
    const list = await db.searchHistory.toArray();
    items.push({ type: 'search_history', k: 'list', v: JSON.stringify(list), updatedAt: Date.now() });
  }
  if (settingsDirty) {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      lastSettingsRaw = raw;
      saveSettingsMeta(raw, Date.now());
      items.push({ type: 'settings', k: 'snapshot', v: raw, updatedAt: Date.now() });
    }
  }

  if (items.length === 0 && deletes.length === 0 && clears.length === 0) return null;
  return { items, deletes, clears };
}

async function putInBatches(payload: AggPayload): Promise<void> {
  const { items, deletes, clears } = payload;
  const batches = Math.max(1, Math.ceil(items.length / PUT_CHUNK));
  for (let i = 0; i < batches; i++) {
    await api.putUserData({
      items: items.slice(i * PUT_CHUNK, (i + 1) * PUT_CHUNK),
      deletes: i === 0 ? deletes : undefined,
      clears: i === 0 ? clears : undefined,
    });
  }
}

// —— full sync（登录时执行一次） ——

async function fullSync(): Promise<void> {
  if (syncing) return;
  syncing = true;
  try {
    const res = await api.getUserData();
    if (!res.available) {
      cloudAvailable = false;
      return;
    }
    cloudAvailable = true;

    const cloud = {
      history: new Map<string, UserDataItem>(),
      progress: new Map<string, UserDataItem>(),
      search: null as UserDataItem | null,
      settings: null as UserDataItem | null,
    };
    for (const item of res.items) {
      if (item.type === 'history') cloud.history.set(item.k, item);
      else if (item.type === 'progress') cloud.progress.set(item.k, item);
      else if (item.type === 'search_history' && item.k === 'list') cloud.search = item;
      else if (item.type === 'settings' && item.k === 'snapshot') cloud.settings = item;
    }

    const pushItems: UserDataItem[] = [];

    // —— 观看历史：逐条 LWW ——
    const localHistory = await db.history.toArray();
    const localHistoryMap = new Map(localHistory.map((h) => [h.id, h]));
    for (const h of localHistory) {
      const c = cloud.history.get(h.id);
      if (!c || h.timestamp > c.updatedAt) {
        pushItems.push({ type: 'history', k: h.id, v: JSON.stringify(h), updatedAt: h.timestamp });
      }
    }
    for (const [k, c] of cloud.history) {
      const local = localHistoryMap.get(k);
      if (!local || c.updatedAt > local.timestamp) {
        const entry = parseJson<HistoryEntry>(c.v);
        if (entry?.id === k && entry.title) await db.history.put({ ...entry, id: k });
      }
    }

    // —— 播放进度：LWW + 位置不回退 ——
    const localProgress = await db.progress.toArray();
    const localProgressMap = new Map(localProgress.map((p) => [p.key, p]));
    // 本地全表可能超出云端行数上限：只推最新的 MAX_PROGRESS_PUSH 条
    const progressToPush = [...localProgress]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_PROGRESS_PUSH);
    for (const p of progressToPush) {
      const c = cloud.progress.get(p.key);
      if (!c || p.updatedAt > c.updatedAt) {
        pushItems.push({ type: 'progress', k: p.key, v: JSON.stringify(p), updatedAt: p.updatedAt });
      }
    }
    for (const [k, c] of cloud.progress) {
      const local = localProgressMap.get(k);
      if (!local || c.updatedAt > local.updatedAt) {
        const entry = parseJson<ProgressEntry>(c.v);
        if (entry?.key === k) {
          await db.progress.put({
            key: k,
            position: Math.max(entry.position || 0, local?.position ?? 0),
            duration: entry.duration || local?.duration || 0,
            updatedAt: c.updatedAt,
          });
        }
      }
    }

    // —— 搜索历史：整表 LWW ——
    const localSearch = await db.searchHistory.toArray();
    const localSearchStamp = localSearch.reduce((m, s) => Math.max(m, s.timestamp), 0);
    if (cloud.search && cloud.search.updatedAt > localSearchStamp) {
      const list = parseJson<SearchHistoryEntry[]>(cloud.search.v);
      if (Array.isArray(list)) {
        await db.searchHistory.clear();
        await db.searchHistory.bulkPut(list.filter((s) => s && typeof s.text === 'string'));
      }
    } else if (localSearch.length > 0) {
      pushItems.push({
        type: 'search_history',
        k: 'list',
        v: JSON.stringify(localSearch),
        updatedAt: Math.max(localSearchStamp, Date.now()),
      });
    }

    // —— 设置快照：带本机同步元数据判断「本机是否改过」 ——
    syncSettingsSnapshot(cloud.settings, pushItems);

    if (!enabled) return; // full sync 期间已登出

    if (pushItems.length > 0) {
      await putInBatches({ items: pushItems, deletes: [], clears: [] });
    }
  } catch (err) {
    console.warn('[LibreTV] 云同步初始化失败：', err);
  } finally {
    syncing = false;
    if (enabled && queue.length > 0) scheduleFlush();
  }
}

/** 设置快照合并：本机自上次同步后未改过且云端更新 → 应用云端；否则本机为准 */
function syncSettingsSnapshot(cloud: UserDataItem | null, pushItems: UserDataItem[]): void {
  const raw = localStorage.getItem(SETTINGS_KEY);
  const meta = loadSettingsMeta();
  const localUnchanged = meta !== null && raw !== null && meta.h === hashStr(raw);

  if (!raw) {
    if (cloud) applyCloudSettings(cloud.v, cloud.updatedAt);
    return;
  }
  if (localUnchanged && cloud && cloud.updatedAt > meta.t) {
    // 本机没改过设置，云端有更新（来自其他设备）
    applyCloudSettings(cloud.v, cloud.updatedAt);
    return;
  }
  lastSettingsRaw = raw;
  const differs = !cloud || raw !== cloud.v;
  if (differs) {
    // 首次同步或本机有未同步修改：本机为准
    const t = Date.now();
    saveSettingsMeta(raw, t);
    pushItems.push({ type: 'settings', k: 'snapshot', v: raw, updatedAt: t });
  } else {
    saveSettingsMeta(raw, Math.max(meta?.t ?? 0, cloud?.updatedAt ?? 0));
  }
}

function applyCloudSettings(raw: string, updatedAt: number): void {
  try {
    localStorage.setItem(SETTINGS_KEY, raw);
    lastSettingsRaw = raw;
    saveSettingsMeta(raw, updatedAt);
    void useAppStore.persist.rehydrate();
  } catch (err) {
    console.warn('[LibreTV] 应用云端设置失败：', err);
  }
}

// —— 设置轮询（persist 无变更回调，30s diff 一次） ——

function checkSettings(): void {
  if (!enabled || !cloudAvailable || syncing) return;
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw || raw === lastSettingsRaw) return;
  lastSettingsRaw = raw;
  saveSettingsMeta(raw, Date.now());
  enqueue({ kind: 'settings-snapshot' });
}

// —— 工具 ——

function parseJson<T>(v: string): T | null {
  try {
    return JSON.parse(v) as T;
  } catch {
    return null;
  }
}

/** settings 本机同步元数据：内容 hash + 上次同步时间（判断「本机是否改过设置」） */
function loadSettingsMeta(): { h: string; t: number } | null {
  try {
    const raw = localStorage.getItem(SETTINGS_META_KEY);
    const meta = raw ? (JSON.parse(raw) as { h: string; t: number }) : null;
    return meta && typeof meta.h === 'string' && Number.isFinite(meta.t) ? meta : null;
  } catch {
    return null;
  }
}

function saveSettingsMeta(raw: string, updatedAt: number): void {
  try {
    localStorage.setItem(SETTINGS_META_KEY, JSON.stringify({ h: hashStr(raw), t: updatedAt }));
  } catch {
    // 配额满等存储异常：设置同步退化为「本机为准」
  }
}

function hashStr(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return String(h);
}
