import { NextResponse } from 'next/server';
import { isPasswordConfigured } from '@/lib/auth';
import { resolveSession } from '@/lib/api-guard';
import { getRegistrationMode, hasUserStore } from '@/lib/user-auth';
import { getEnvSources } from '@/lib/env-sources';
import { getEnvLiveSources } from '@/lib/env-live-sources';
import { getEnvSubscriptions } from '@/lib/env-subscriptions';

export const runtime = 'nodejs';

/** 站点状态：客户端据此决定是否弹出登录框 / 提示管理员配置密码，并获取预置采集站与预置直播源 */
export async function GET(req: Request) {
  const passwordRequired = isPasswordConfigured();
  const session = resolveSession(req);
  const verified = passwordRequired && session !== null;
  return NextResponse.json({
    passwordRequired,
    verified,
    // 用户体系可用性（配置了 D1 才开放注册/登录/云同步）
    userSystemAvailable: await hasUserStore(),
    registrationMode: getRegistrationMode(),
    // 当前会话用户（主密码登录为虚拟账号 admin）
    me: session ? { username: session.userId, role: session.role } : null,
    // 构建时由 next.config.ts 从 package.json 注入
    version: process.env.APP_VERSION || 'dev',
    // 部署者通过 DEFAULT_SOURCES 预置的采集站
    defaultSources: getEnvSources(),
    // 部署者通过 DEFAULT_LIVE_SOURCES 预置的直播源（M3U 订阅）
    defaultLiveSources: getEnvLiveSources(),
    // 部署者通过 DEFAULT_SUBSCRIPTIONS 预置的 SourceList 订阅链接
    defaultSubscriptions: getEnvSubscriptions(),
  });
}
