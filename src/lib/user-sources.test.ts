import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeFakeD1 } from './fake-d1';

/**
 * user-sources 单元测试：内存 D1（fake-d1）覆盖管理员分配源的读写、
 * 全量覆盖语义、三类全空视为未分配、删除与列举，以及损坏数据容错。
 * d1.ts 的建表缓存为模块级，通过 vi.resetModules + 动态 import 在用例间隔离。
 */

/** 重新加载模块（隔离建表缓存），返回新实例 */
async function load() {
  await vi.resetModules();
  return import('./user-sources');
}

const VOD = { name: 'A', url: 'https://a.example.com/api.php/provide/vod/' };
const LIVE = { name: 'L', url: 'https://live.example.com/list.m3u', epg: 'https://epg.example.com/e.xml' };
const SUB = { url: 'https://sub.example.com/list.json/', name: '订阅' };

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('user-sources 读写', () => {
  it('未分配时 getUserSources 返回 null', async () => {
    const db = makeFakeD1();
    const mod = await load();
    await expect(mod.getUserSources(db, 'alice')).resolves.toBeNull();
  });

  it('保存三类后读回：key 前缀 assign_*、url 归一化、updatedAt 记录', async () => {
    const db = makeFakeD1();
    const mod = await load();
    const saved = await mod.saveUserSources(db, 'alice', {
      sources: [VOD],
      liveSources: [LIVE],
      subscriptions: [SUB],
    });

    expect(saved.sources[0].key).toMatch(/^assign_vod_/);
    expect(saved.sources[0].url).toBe('https://a.example.com/api.php/provide/vod'); // 尾斜杠去除
    expect(saved.liveSources[0].key).toMatch(/^assign_live_/);
    expect(saved.liveSources[0].epg).toBe('https://epg.example.com/e.xml');
    expect(saved.subscriptions[0].url).toBe('https://sub.example.com/list.json');
    expect(typeof saved.updatedAt).toBe('number');

    const loaded = await mod.getUserSources(db, 'alice');
    expect(loaded?.sources.map((s) => s.key)).toEqual(saved.sources.map((s) => s.key));
    expect(loaded?.liveSources.map((s) => s.key)).toEqual(saved.liveSources.map((s) => s.key));
    expect(loaded?.updatedAt).toBe(saved.updatedAt);
  });

  it('三类全空视为未分配：getUserSources 返回 null（等同撤销分配）', async () => {
    const db = makeFakeD1();
    const mod = await load();
    await mod.saveUserSources(db, 'alice', { sources: [], liveSources: [], subscriptions: [] });
    await expect(mod.getUserSources(db, 'alice')).resolves.toBeNull();
  });

  it('全量覆盖：未传入的字段按空数组覆盖，可单独清除某一类源', async () => {
    const db = makeFakeD1();
    const mod = await load();
    await mod.saveUserSources(db, 'alice', { sources: [VOD], liveSources: [LIVE], subscriptions: [SUB] });

    const saved = await mod.saveUserSources(db, 'alice', { sources: [VOD] });
    expect(saved.sources).toHaveLength(1);
    expect(saved.liveSources).toEqual([]);
    expect(saved.subscriptions).toEqual([]);
  });

  it('UPSERT：同一用户重复保存只保留最新一份', async () => {
    const db = makeFakeD1();
    const mod = await load();
    await mod.saveUserSources(db, 'alice', { sources: [{ name: 'A', url: 'https://a.example.com/vod' }] });
    await mod.saveUserSources(db, 'alice', { sources: [{ name: 'B', url: 'https://b.example.com/vod' }] });

    const loaded = await mod.getUserSources(db, 'alice');
    expect(loaded?.sources.map((s) => s.name)).toEqual(['B']);
  });

  it('deleteUserSources：存在返回 true 并清空；不存在返回 false', async () => {
    const db = makeFakeD1();
    const mod = await load();
    await mod.saveUserSources(db, 'alice', { sources: [VOD] });
    await expect(mod.deleteUserSources(db, 'alice')).resolves.toBe(true);
    await expect(mod.getUserSources(db, 'alice')).resolves.toBeNull();
    await expect(mod.deleteUserSources(db, 'alice')).resolves.toBe(false);
  });

  it('listAssignedUsernames：返回已分配用户名集合', async () => {
    const db = makeFakeD1();
    const mod = await load();
    await mod.saveUserSources(db, 'alice', { sources: [VOD] });
    await mod.saveUserSources(db, 'bob', { liveSources: [LIVE] });

    const names = await mod.listAssignedUsernames(db);
    expect([...names].sort()).toEqual(['alice', 'bob']);
  });

  it('非法输入抛出校验错误（url 协议 / 缺少 name）', async () => {
    const db = makeFakeD1();
    const mod = await load();
    await expect(
      mod.saveUserSources(db, 'alice', { sources: [{ name: 'A', url: 'ftp://x' }] })
    ).rejects.toThrow(/url 必须以 http/);
    await expect(
      mod.saveUserSources(db, 'alice', { liveSources: [{ url: 'https://x.example.com/list.m3u' }] })
    ).rejects.toThrow(/缺少 name/);
    await expect(mod.saveUserSources(db, 'alice', { sources: 'nope' })).rejects.toThrow(/必须是数组/);
  });

  it('存量数据损坏时容错：返回 null 而非抛错', async () => {
    const db = makeFakeD1();
    const mod = await load();
    db.userSources.set('alice', { v: '{not-json', updated_at: 1 });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(mod.getUserSources(db, 'alice')).resolves.toBeNull();
    expect(warn).toHaveBeenCalled();
  });
});
