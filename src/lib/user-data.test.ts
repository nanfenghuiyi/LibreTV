import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_ROW_LIMIT, MAX_PUT_ITEMS, ROW_LIMITS } from './user-data';
import { makeFakeD1 } from './fake-d1';

/**
 * user-data 单元测试：内存 D1（fake-d1）覆盖云端同步数据的
 * LWW 合并、删除/清空语义与防滥用限额。
 * 建表标记缓存在模块内，通过 vi.resetModules 在用例间隔离。
 */

async function load() {
  await vi.resetModules();
  return import('./user-data');
}

beforeEach(() => {
  vi.resetModules();
});

describe('getAllUserData', () => {
  it('空库返回空数组', async () => {
    const db = makeFakeD1();
    const mod = await load();
    await expect(mod.getAllUserData(db, 'alice')).resolves.toEqual([]);
  });

  it('写入后按 updatedAt 倒序、驼峰映射读回；用户间数据隔离', async () => {
    const db = makeFakeD1();
    const mod = await load();
    await mod.putUserData(db, 'alice', {
      items: [
        { type: 'history', k: 'h1', v: '{"id":"h1"}', updatedAt: 100 },
        { type: 'settings', k: 'snapshot', v: '{}', updatedAt: 200 },
      ],
    });
    await mod.putUserData(db, 'bob', {
      items: [{ type: 'history', k: 'h1', v: '{"id":"h1"}', updatedAt: 1 }],
    });

    const rows = await mod.getAllUserData(db, 'alice');
    expect(rows).toEqual([
      { type: 'settings', k: 'snapshot', v: '{}', updatedAt: 200 },
      { type: 'history', k: 'h1', v: '{"id":"h1"}', updatedAt: 100 },
    ]);
    expect(await mod.getAllUserData(db, 'bob')).toHaveLength(1);
  });
});

describe('putUserData 输入校验', () => {
  it.each([
    [{}, /缺少 items/],
    [
      {
        items: Array.from({ length: MAX_PUT_ITEMS + 1 }, (_, i) => ({
          type: 'history',
          k: `k${i}`,
          v: 'v',
          updatedAt: 1,
        })),
      },
      /最多推送/,
    ],
    [{ items: [{ type: 'unknown', k: 'k', v: 'v', updatedAt: 1 }] }, /未知的数据类型/],
    [{ items: [{ type: 'history', k: 'x'.repeat(513), v: 'v', updatedAt: 1 }] }, /键 k 非法或过长/],
    [{ items: [{ type: 'history', k: 'k', v: 'x'.repeat(101 * 1024), updatedAt: 1 }] }, /100KB/],
    [{ items: [{ type: 'history', k: 'k', v: 'v', updatedAt: -1 }] }, /updatedAt 非法/],
    [{ deletes: [{ type: 'history', keys: [] }] }, /keys 不能为空/],
  ])('拒绝非法输入（用例 %#）', async (input, match) => {
    const db = makeFakeD1();
    const mod = await load();
    await expect(mod.putUserData(db, 'alice', input as never)).rejects.toThrow(match);
    expect(await mod.getAllUserData(db, 'alice')).toEqual([]);
  });
});

describe('LWW 合并', () => {
  it('updatedAt 更小的推送被跳过，相等或更大才写入', async () => {
    const db = makeFakeD1();
    const mod = await load();
    await mod.putUserData(db, 'alice', {
      items: [{ type: 'history', k: 'h1', v: 'v1', updatedAt: 100 }],
    });

    let r = await mod.putUserData(db, 'alice', {
      items: [{ type: 'history', k: 'h1', v: 'v0', updatedAt: 50 }],
    });
    expect(r.updated).toBe(0);
    expect((await mod.getAllUserData(db, 'alice'))[0].v).toBe('v1');

    r = await mod.putUserData(db, 'alice', {
      items: [{ type: 'history', k: 'h1', v: 'v2', updatedAt: 100 }],
    });
    expect(r.updated).toBe(1);

    r = await mod.putUserData(db, 'alice', {
      items: [{ type: 'history', k: 'h1', v: 'v3', updatedAt: 200 }],
    });
    expect(r.updated).toBe(1);
    expect((await mod.getAllUserData(db, 'alice'))[0].v).toBe('v3');
  });

  it('deletes 按键删除；clears 清空整类且优先于同类 deletes', async () => {
    const db = makeFakeD1();
    const mod = await load();
    await mod.putUserData(db, 'alice', {
      items: [
        { type: 'history', k: 'h1', v: '1', updatedAt: 1 },
        { type: 'history', k: 'h2', v: '2', updatedAt: 1 },
        { type: 'progress', k: 'p1', v: '3', updatedAt: 1 },
      ],
    });

    await mod.putUserData(db, 'alice', { deletes: [{ type: 'history', keys: ['h1'] }] });
    let rows = await mod.getAllUserData(db, 'alice');
    expect(rows.map((r) => r.k).sort()).toEqual(['h2', 'p1']);

    await mod.putUserData(db, 'alice', { clears: ['progress'] });
    rows = await mod.getAllUserData(db, 'alice');
    expect(rows.map((r) => r.k)).toEqual(['h2']);

    await mod.putUserData(db, 'alice', {
      items: [{ type: 'history', k: 'h3', v: '3', updatedAt: 2 }],
      deletes: [{ type: 'history', keys: ['h2'] }],
      clears: ['history'],
    });
    rows = await mod.getAllUserData(db, 'alice');
    expect(rows).toEqual([{ type: 'history', k: 'h3', v: '3', updatedAt: 2 }]);
  });
});

describe('行数限额', () => {
  it('history 超出行上限时整个 PUT 拒绝且不落库', async () => {
    const db = makeFakeD1();
    const mod = await load();
    const limit = ROW_LIMITS.history;
    await mod.putUserData(db, 'alice', {
      items: Array.from({ length: limit }, (_, i) => ({
        type: 'history',
        k: `h${i}`,
        v: 'v',
        updatedAt: 1,
      })),
    });

    await expect(
      mod.putUserData(db, 'alice', { items: [{ type: 'history', k: 'new-1', v: 'v', updatedAt: 2 }] })
    ).rejects.toThrow(/超出上限/);
    expect(await mod.getAllUserData(db, 'alice')).toHaveLength(limit);
  });

  it('未配置专属上限的类型走默认上限', () => {
    expect(DEFAULT_ROW_LIMIT).toBe(300);
    expect(ROW_LIMITS.history).toBeGreaterThan(0);
  });
});
