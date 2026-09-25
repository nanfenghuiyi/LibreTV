import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// store.ts 运行时引用 db.ts（IndexedDB），node 测试环境下 mock 掉
vi.mock('./db', () => ({
  db: {},
  clearLiveProbeResultsDb: vi.fn(async () => {}),
  loadLiveProbeResults: vi.fn(async () => ({})),
  saveLiveProbeResults: vi.fn(async () => {}),
}));

// 订阅内容由服务端代理拉取（需登录），测试中直接 mock
vi.mock('./client-api', () => ({
  api: { fetchSourceList: vi.fn(), getSharedSources: vi.fn() },
}));

import { api } from './client-api';
import { applyEnvPresets, bootstrapSources } from './subscription-sync';
import { useAppStore } from './store';
import type { AuthStatusResponse, SourceListPayload } from './types';

/**
 * applyEnvPresets 单测：覆盖「首屏未登录时预置订阅 401 静默失败，登录后补跑」这一修复路径。
 * 补跑是否发生由 auth.tsx 负责，这里保证补跑本身是幂等且安全的。
 */

const SUB_URL = 'https://paste.rs/JsI9D';

const status = (over: Partial<AuthStatusResponse> = {}): AuthStatusResponse => ({
  passwordRequired: true,
  verified: false,
  version: 'test',
  defaultSources: [],
  defaultLiveSources: [],
  defaultSubscriptions: [],
  ...over,
});

const payload: SourceListPayload = {
  name: 'LibreTV-List',
  sources: [
    { name: '非凡影视', url: 'https://cj.ffzyapi.com/api.php/provide/vod/from/ffm3u8' },
    { name: '如意资源', url: 'https://cj.rycjapi.com/api.php/provide/vod' },
  ],
  liveSources: [],
};

const fetchSourceList = vi.mocked(api.fetchSourceList);
const getSharedSources = vi.mocked(api.getSharedSources);

beforeEach(() => {
  vi.clearAllMocks();
  useAppStore.setState({
    customAPIs: [],
    selectedKeys: [],
    envSources: [],
    envKeysSeen: [],
    subscriptions: [],
    envSubsSeen: [],
    liveEnvSources: [],
    liveEnvKeysSeen: [],
    liveSubscriptions: [],
    liveSelectedUrls: [],
    yellowFilter: false,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('applyEnvPresets', () => {
  it('写入预置点播源与直播源，并自动勾选/启用', async () => {
    await applyEnvPresets(
      status({
        defaultSources: [{ key: 'env_0', name: '预置源', url: 'https://example.com/api.php/provide/vod' }],
        defaultLiveSources: [{ key: 'env_1', name: '预置直播', url: 'https://example.com/list.m3u' }],
      })
    );

    const s = useAppStore.getState();
    expect(s.envSources.map((x) => x.key)).toEqual(['env_0']);
    expect(s.selectedKeys).toContain('env_0');
    expect(s.liveEnvSources.map((x) => x.key)).toEqual(['env_1']);
    expect(s.liveSelectedUrls).toContain('https://example.com/list.m3u');
    // 没有预置订阅时不应触发订阅拉取
    expect(fetchSourceList).not.toHaveBeenCalled();
  });

  it('预置订阅：拉取并导入源，写入订阅条目与 seen 标记', async () => {
    fetchSourceList.mockResolvedValue(payload);

    await applyEnvPresets(status({ defaultSubscriptions: [{ url: SUB_URL, name: 'LibreTV-List' }] }));

    expect(fetchSourceList).toHaveBeenCalledWith(SUB_URL);
    const s = useAppStore.getState();
    expect(s.subscriptions.map((x) => x.url)).toEqual([SUB_URL]);
    expect(s.customAPIs.map((x) => x.url)).toEqual(payload.sources.map((x) => x.url));
    expect(s.customAPIs.map((x) => x.name)).toEqual(['非凡影视', '如意资源']);
    expect(s.envSubsSeen).toContain(SUB_URL);
  });

  it('幂等：已同步（24h 内）的预置订阅补跑时不会重复拉取', async () => {
    fetchSourceList.mockResolvedValue(payload);

    await applyEnvPresets(status({ defaultSubscriptions: [{ url: SUB_URL }] }));
    await applyEnvPresets(status({ defaultSubscriptions: [{ url: SUB_URL }] }));

    expect(fetchSourceList).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().customAPIs).toHaveLength(payload.sources.length);
  });

  it('登录前那次失败的典型形态（401）不会抛出，也不会留下半截数据', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fetchSourceList.mockRejectedValue(new Error('需要登录'));

    await expect(applyEnvPresets(status({ defaultSubscriptions: [{ url: SUB_URL }] }))).resolves.toBeUndefined();

    const s = useAppStore.getState();
    expect(s.subscriptions).toHaveLength(0);
    expect(s.customAPIs).toHaveLength(0);
    // 失败不写 seen：下次（登录成功后的补跑）仍会重试
    expect(s.envSubsSeen).not.toContain(SUB_URL);
    expect(warn).toHaveBeenCalled();
  });

  it('用户删除过的预置订阅不会被重新导入', async () => {
    useAppStore.setState({ envSubsSeen: [SUB_URL] });
    fetchSourceList.mockResolvedValue(payload);

    await applyEnvPresets(status({ defaultSubscriptions: [{ url: SUB_URL }] }));

    expect(fetchSourceList).not.toHaveBeenCalled();
  });
});

describe('bootstrapSources', () => {
  const sharedVod = { key: 'shared_vod_s', name: '共享源', url: 'https://shared.example.com/api.php/provide/vod' };
  const assignVod = { key: 'assign_vod_a', name: '分配源', url: 'https://assign.example.com/api.php/provide/vod' };
  const envVod = { key: 'env_0', name: '预置源', url: 'https://env.example.com/api.php/provide/vod' };

  beforeEach(() => {
    useAppStore.setState({
      sharedSources: [],
      sharedLiveSources: [],
      sharedKeysSeen: [],
      assignedSources: [],
      assignedLiveSources: [],
      assignedKeysSeen: [],
      siteSubsSeen: [],
      assignedSubsSeen: [],
    });
  });

  it('未登录：仅应用 env 预置，不拉取共享/分配源', async () => {
    await bootstrapSources(status({ defaultSources: [envVod] }));

    expect(getSharedSources).not.toHaveBeenCalled();
    expect(useAppStore.getState().envSources.map((x) => x.key)).toEqual([envVod.key]);
  });

  it('已登录且有分配源：替换模式——清空 env/shared 下发，仅应用分配源与分配订阅', async () => {
    useAppStore.setState({ envSources: [envVod], sharedSources: [sharedVod] });
    getSharedSources.mockResolvedValue({
      available: true,
      config: { sources: [sharedVod], liveSources: [], subscriptions: [] },
      assigned: { sources: [assignVod], liveSources: [], subscriptions: [{ url: SUB_URL }], updatedAt: 1 },
    });
    fetchSourceList.mockResolvedValue(payload);

    await bootstrapSources(status({ verified: true }));

    const s = useAppStore.getState();
    expect(s.envSources).toEqual([]);
    expect(s.sharedSources).toEqual([]);
    expect(s.assignedSources.map((x) => x.key)).toEqual([assignVod.key]);
    expect(s.selectedKeys).toContain(assignVod.key);
    // 分配订阅以 assigned 桶导入并标记 seen
    expect(s.customAPIs.map((x) => x.url)).toEqual(payload.sources.map((x) => x.url));
    expect(s.assignedSubsSeen).toContain(SUB_URL);
    expect(s.siteSubsSeen).not.toContain(SUB_URL);
  });

  it('已登录且无分配：应用站点共享源与站点订阅，并照常应用 env 预置', async () => {
    getSharedSources.mockResolvedValue({
      available: true,
      config: { sources: [sharedVod], liveSources: [], subscriptions: [{ url: SUB_URL }] },
      assigned: null,
    });
    fetchSourceList.mockResolvedValue(payload);

    await bootstrapSources(status({ verified: true, defaultSources: [envVod] }));

    const s = useAppStore.getState();
    expect(s.sharedSources.map((x) => x.key)).toEqual([sharedVod.key]);
    expect(s.siteSubsSeen).toContain(SUB_URL);
    expect(s.envSources.map((x) => x.key)).toEqual([envVod.key]);
  });

  it('无 D1 绑定（available=false）：跳过共享源，走 env 预置兜底', async () => {
    getSharedSources.mockResolvedValue({ available: false, config: null, assigned: null });

    await bootstrapSources(status({ verified: true, defaultSources: [envVod] }));

    expect(useAppStore.getState().envSources.map((x) => x.key)).toEqual([envVod.key]);
  });

  it('getSharedSources 拉取失败：静默降级到 env 预置', async () => {
    getSharedSources.mockRejectedValue(new Error('network down'));

    await bootstrapSources(status({ verified: true, defaultSources: [envVod] }));

    expect(useAppStore.getState().envSources.map((x) => x.key)).toEqual([envVod.key]);
  });
});
