import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, PUT } from './route';
import { SESSION_COOKIE, signSession } from '@/lib/auth';

/**
 * 站点共享源接口单测：登录守卫、D1 降级语义（available=false / 501）、
 * 输入校验错误归为 400、内部错误归为 500。存储细节由 shared-config 自身测试覆盖。
 */

const h = vi.hoisted(() => ({
  hasSharedStore: vi.fn(async () => true),
  getSharedSources: vi.fn(async () => null),
  saveSharedSources: vi.fn(async () => ({ sources: [], liveSources: [], updatedAt: 1 })),
}));

vi.mock('@/lib/shared-config', () => ({
  hasSharedStore: h.hasSharedStore,
  getSharedSources: h.getSharedSources,
  saveSharedSources: h.saveSharedSources,
}));

function makeRequest(method: string, body?: unknown, options?: { authenticated?: boolean }): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options?.authenticated !== false) {
    headers.cookie = `${SESSION_COOKIE}=${signSession().token}`;
  }
  return new Request('https://local.test/api/shared/sources', {
    method,
    headers,
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
}

beforeAll(() => {
  process.env.PASSWORD = 'test-password';
});

beforeEach(() => {
  vi.clearAllMocks();
  h.hasSharedStore.mockResolvedValue(true);
  h.getSharedSources.mockResolvedValue(null);
});

describe('GET /api/shared/sources', () => {
  it('未登录被守卫拦下', async () => {
    const res = await GET(makeRequest('GET', undefined, { authenticated: false }));
    expect(res.status).toBe(401);
  });

  it('无 D1 绑定时返回 available=false（前端据此隐藏站点共享源功能）', async () => {
    h.hasSharedStore.mockResolvedValue(false);
    const res = await GET(makeRequest('GET'));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ available: false, config: null });
  });

  it('有配置时透传', async () => {
    const config = {
      sources: [{ key: 'shared_vod_x', name: 'A', url: 'https://a.example.com/vod' }],
      liveSources: [],
      updatedAt: 123,
    };
    h.getSharedSources.mockResolvedValue(config);
    const res = await GET(makeRequest('GET'));
    await expect(res.json()).resolves.toEqual({ available: true, config });
  });

  it('读取失败返回 500', async () => {
    h.getSharedSources.mockRejectedValue(new Error('d1 down'));
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await GET(makeRequest('GET'));
    expect(res.status).toBe(500);
    expect(err).toHaveBeenCalled();
  });
});

describe('PUT /api/shared/sources', () => {
  it('未登录被守卫拦下', async () => {
    const res = await PUT(makeRequest('PUT', { sources: [] }, { authenticated: false }));
    expect(res.status).toBe(401);
  });

  it('无 D1 绑定时返回 501 并给出明确错误', async () => {
    h.hasSharedStore.mockResolvedValue(false);
    const res = await PUT(makeRequest('PUT', { sources: [], liveSources: [] }));
    expect(res.status).toBe(501);
  });

  it('请求体不是合法 JSON 时返回 400', async () => {
    const res = await PUT(makeRequest('PUT', 'not json'));
    expect(res.status).toBe(400);
  });

  it('校验错误（非法地址等）归为 400', async () => {
    h.saveSharedSources.mockRejectedValue(new Error('采集站第 1 项的 url 必须以 http:// 或 https:// 开头'));
    const res = await PUT(
      makeRequest('PUT', { sources: [{ name: 'A', url: 'ftp://x' }], liveSources: [] })
    );
    expect(res.status).toBe(400);
  });

  it('保存成功返回最新配置，参数原样透传', async () => {
    const payload = {
      sources: [{ name: 'A', url: 'https://a.example.com/vod' }],
      liveSources: [{ name: 'L', url: 'https://l.example.com/list.m3u' }],
    };
    const saved = { ...payload, updatedAt: 42 };
    h.saveSharedSources.mockResolvedValue(saved);

    const res = await PUT(makeRequest('PUT', payload));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ available: true, config: saved });
    expect(h.saveSharedSources).toHaveBeenCalledWith(payload);
  });

  it('内部错误返回 500', async () => {
    h.saveSharedSources.mockRejectedValue(new Error('d1 write failed'));
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await PUT(makeRequest('PUT', { sources: [], liveSources: [] }));
    expect(res.status).toBe(500);
    expect(err).toHaveBeenCalled();
  });
});
