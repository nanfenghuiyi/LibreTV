import { beforeEach, describe, expect, it, vi } from 'vitest';

// getCloudflareContext 的 mock（vi.hoisted 保证提升到 vi.mock factory 之前）
const cf = vi.hoisted(() => ({
  getCloudflareContext: vi.fn(),
}));

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: cf.getCloudflareContext,
}));

/**
 * 最小 D1 内存实现：覆盖 shared-config 用到的 prepare / bind / first / run 语义。
 * shared_config 表为单行 KV（k='sources'），直接用 Map 存储即可。
 */
function makeFakeD1() {
  const rows = new Map<string, { v: string; updated_at: number }>();
  const executed: string[] = [];
  const makeStmt = (query: string) => {
    let bound: (string | number | null)[] = [];
    const first = async <T,>(): Promise<T | null> => {
      const [k] = bound as [string];
      return (rows.get(k) as T | undefined) ?? null;
    };
    const run = async () => {
      executed.push(query);
      if (/INSERT INTO/i.test(query)) {
        const [k, v, ts] = bound as [string, string, number];
        rows.set(k, { v, updated_at: ts });
      }
    };
    return {
      bind: (...values: (string | number | null)[]) => {
        bound = values;
        return { first, run };
      },
      first,
      run,
    };
  };
  return { prepare: makeStmt, batch: vi.fn(async () => {}), rows, executed };
}

/** 动态加载被测模块：getD1 有模块级缓存，每个用例需 resetModules 隔离 */
async function load() {
  await vi.resetModules();
  return import('./shared-config');
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('shared-config 降级行为（无 D1 绑定）', () => {
  it('非 Workers 环境（getCloudflareContext 抛错）视为无存储', async () => {
    cf.getCloudflareContext.mockImplementation(() => {
      throw new Error('No Cloudflare context');
    });
    const mod = await load();

    await expect(mod.hasSharedStore()).resolves.toBe(false);
    await expect(mod.getSharedSources()).resolves.toBeNull();
    await expect(mod.saveSharedSources({ sources: [], liveSources: [] })).rejects.toThrow(/未配置 D1/);
  });

  it('env.DB 缺失时同样降级', async () => {
    cf.getCloudflareContext.mockReturnValue({ env: {} });
    const mod = await load();

    await expect(mod.hasSharedStore()).resolves.toBe(false);
  });
});

describe('shared-config D1 读写', () => {
  it('保存后可读回：key 自动生成、url 尾斜杠去除、updatedAt 记录', async () => {
    const db = makeFakeD1();
    cf.getCloudflareContext.mockReturnValue({ env: { DB: db } });
    const mod = await load();

    const saved = await mod.saveSharedSources({
      sources: [{ name: 'A', url: 'https://a.example.com/api.php/provide/vod/' }],
      liveSources: [{ name: 'L', url: 'https://live.example.com/list.m3u', epg: 'https://epg.example.com/e.xml' }],
    });

    expect(saved.sources[0].key).toMatch(/^shared_vod_/);
    expect(saved.sources[0].url).toBe('https://a.example.com/api.php/provide/vod');
    expect(saved.liveSources[0].key).toMatch(/^shared_live_/);
    expect(typeof saved.updatedAt).toBe('number');

    // 首次写入自动建表
    expect(db.executed.some((q) => /CREATE TABLE IF NOT EXISTS/i.test(q))).toBe(true);

    const loaded = await mod.getSharedSources();
    expect(loaded).not.toBeNull();
    expect(loaded?.sources.map((s) => s.key)).toEqual(saved.sources.map((s) => s.key));
    expect(loaded?.liveSources.map((s) => s.key)).toEqual(saved.liveSources.map((s) => s.key));
    expect(loaded?.updatedAt).toBe(saved.updatedAt);
  });

  it('key 由 url+name 决定：重排序、重存均稳定（客户端勾选状态得以保留）', async () => {
    const db = makeFakeD1();
    cf.getCloudflareContext.mockReturnValue({ env: { DB: db } });
    const mod = await load();

    const a = { name: 'A', url: 'https://a.example.com/vod' };
    const b = { name: 'B', url: 'https://b.example.com/vod' };

    const first = await mod.saveSharedSources({ sources: [a, b], liveSources: [] });
    const second = await mod.saveSharedSources({ sources: [b, a], liveSources: [] });

    // 同一 url+name 在两次保存中得到相同 key（顺序不同不影响 key 本身）
    const keyByName = new Map(first.sources.map((s) => [s.name, s.key]));
    expect(second.sources.map((s) => keyByName.get(s.name))).toEqual(second.sources.map((s) => s.key));
  });

  it('覆盖保存：读取到的始终是最新一份', async () => {
    const db = makeFakeD1();
    cf.getCloudflareContext.mockReturnValue({ env: { DB: db } });
    const mod = await load();

    await mod.saveSharedSources({ sources: [{ name: 'A', url: 'https://a.example.com/vod' }], liveSources: [] });
    await mod.saveSharedSources({ sources: [{ name: 'B', url: 'https://b.example.com/vod' }], liveSources: [] });

    const loaded = await mod.getSharedSources();
    expect(loaded?.sources.map((s) => s.name)).toEqual(['B']);
  });

  it('存量数据损坏时容错：返回 null 而非抛错', async () => {
    const db = makeFakeD1();
    cf.getCloudflareContext.mockReturnValue({ env: { DB: db } });
    const mod = await load();

    db.rows.set('sources', { v: '{not-json', updated_at: 1 });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(mod.getSharedSources()).resolves.toBeNull();
    expect(warn).toHaveBeenCalled();
  });
});

describe('shared-config 输入校验', () => {
  it.each([
    [{ sources: [{ name: 'A', url: 'ftp://x' }], liveSources: [] }, /url 必须以 http/],
    [{ sources: [{ url: 'https://a.example.com/vod' }], liveSources: [] }, /缺少 name/],
    [{ sources: 'nope', liveSources: [] }, /必须是数组/],
    [{ sources: [{ name: 'L', url: 'https://l.example.com/list.m3u' }], liveSources: [{ name: 'L2', url: 'nope' }] }, /url 必须以 http/],
  ])('拒绝非法输入：%j', async (input, match) => {
    const mod = await load();
    await expect(mod.saveSharedSources(input)).rejects.toThrow(match);
  });

  it('数量上限：点播 200、直播 100', async () => {
    const db = makeFakeD1();
    cf.getCloudflareContext.mockReturnValue({ env: { DB: db } });
    const mod = await load();

    const vod = Array.from({ length: 201 }, (_, i) => ({ name: `v${i}`, url: `https://v${i}.example.com/vod` }));
    const live = Array.from({ length: 101 }, (_, i) => ({ name: `l${i}`, url: `https://l${i}.example.com/list.m3u` }));

    await expect(mod.saveSharedSources({ sources: vod, liveSources: [] })).rejects.toThrow(/超出上限/);
    await expect(mod.saveSharedSources({ sources: [], liveSources: live })).rejects.toThrow(/超出上限/);
  });

  it('normalizeSharedSources：undefined 视为空数组，空白 detail/epg 归一为 undefined', async () => {
    const mod = await load();
    const result = mod.normalizeSharedSources({
      sources: [{ name: ' A ', url: 'https://a.example.com/vod/', detail: '  ', isAdult: true }],
      liveSources: undefined,
    });
    expect(result.sources[0]).toEqual({
      key: expect.stringMatching(/^shared_vod_/),
      name: 'A',
      url: 'https://a.example.com/vod',
      detail: undefined,
      isAdult: true,
    });
    expect(result.liveSources).toEqual([]);
  });
});
