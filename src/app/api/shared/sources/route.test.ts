import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, PUT } from './route';
import { SESSION_COOKIE, signSession } from '@/lib/auth';

/**
 * 站点共享源接口单测：登录/管理员守卫、D1 降级语义（available=false / 501）、
 * 输入校验错误归为 400、内部错误归为 500。GET 额外透传本人分配源（assigned）。
 * 存储细节由 shared-config / user-sources 自身测试覆盖。
 */

const h = vi.hoisted(() => ({
  getD1: vi.fn<() => Promise<unknown>>(async () => ({})),
  getSharedSources: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => null),
  saveSharedSources: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => null),
  getUserSources: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => null),
}));

vi.mock('@/lib/d1', () => ({
  getD1: h.getD1,
}));

// 守卫的 D1 复查（禁用/epoch）由 user-auth.test.ts 覆盖，这里固定为通过，
// 使本文件聚焦于路由自身的响应契约
vi.mock('@/lib/user-auth', () => ({
  hasUserStore: vi.fn(async () => true),
  checkSessionAlive: vi.fn(async () => true),
}));

vi.mock('@/lib/shared-config', () => ({
  getSharedSources: h.getSharedSources,
  saveSharedSources: h.saveSharedSources,
}));

vi.mock('@/lib/user-sources', () => ({
  getUserSources: h.getUserSources,
}));

function makeRequest(
  method: string,
  body?: unknown,
  options?: { authenticated?: boolean; asAdmin?: boolean }
): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options?.authenticated !== false) {
    const token = options?.asAdmin ? signSession().token : signSession('alice').token;
    headers.cookie = `${SESSION_COOKIE}=${token}`;
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
  h.getD1.mockResolvedValue({});
});

describe('GET /api/shared/sources', () => {
  it('未登录被守卫拦下', async () => {
    const res = await GET(makeRequest('GET', undefined, { authenticated: false }));
    expect(res.status).toBe(401);
  });

  it('无 D1 绑定时返回 available=false（前端据此隐藏站点源功能）', async () => {
    h.getD1.mockResolvedValue(null);
    const res = await GET(makeRequest('GET'));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ available: false, config: null, assigned: null });
  });

  it('有配置时透传共享源与本人分配源', async () => {
    const config = {
      sources: [{ key: 'shared_vod_x', name: 'A', url: 'https://a.example.com/vod' }],
      liveSources: [],
      updatedAt: 123,
    };
    const assigned = {
      sources: [{ key: 'assign_vod_y', name: 'B', url: 'https://b.example.com/vod' }],
      liveSources: [],
      subscriptions: [],
      updatedAt: 456,
    };
    h.getSharedSources.mockResolvedValue(config);
    h.getUserSources.mockResolvedValue(assigned);
    const res = await GET(makeRequest('GET', undefined, { asAdmin: true }));
    await expect(res.json()).resolves.toEqual({ available: true, config, assigned });
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

  it('普通用户被管理员守卫拦下（403）', async () => {
    const res = await PUT(makeRequest('PUT', { sources: [], liveSources: [] }));
    expect(res.status).toBe(403);
  });

  it('无 D1 绑定时返回 501 并给出明确错误', async () => {
    h.getD1.mockResolvedValue(null);
    const res = await PUT(makeRequest('PUT', { sources: [], liveSources: [] }, { asAdmin: true }));
    expect(res.status).toBe(501);
  });

  it('请求体不是合法 JSON 时返回 400', async () => {
    const res = await PUT(makeRequest('PUT', 'not json', { asAdmin: true }));
    expect(res.status).toBe(400);
  });

  it('校验错误（非法地址等）归为 400', async () => {
    h.saveSharedSources.mockRejectedValue(new Error('采集站第 1 项的 url 必须以 http:// 或 https:// 开头'));
    const res = await PUT(
      makeRequest('PUT', { sources: [{ name: 'A', url: 'ftp://x' }], liveSources: [] }, { asAdmin: true })
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

    const res = await PUT(makeRequest('PUT', payload, { asAdmin: true }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ available: true, config: saved });
    expect(h.saveSharedSources).toHaveBeenCalledWith(payload);
  });

  it('内部错误返回 500', async () => {
    h.saveSharedSources.mockRejectedValue(new Error('d1 write failed'));
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await PUT(makeRequest('PUT', { sources: [], liveSources: [] }, { asAdmin: true }));
    expect(res.status).toBe(500);
    expect(err).toHaveBeenCalled();
  });
});
