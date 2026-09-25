import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
import type { NextConfig } from 'next';
import fs from 'node:fs';
import path from 'node:path';

// 本地 next dev 通过 platform proxy 挂载 wrangler 绑定（D1 等），
// 使 getCloudflareContext() 在开发模式下可用（用户体系/共享源可本地联调）
// wrangler 运行时会写全局配置目录（日志/registry），默认落在系统 AppData；
// 未显式配置时重定向到项目内（.wrangler-home 已在 .gitignore），避免受限环境 EPERM
if (!process.env.XDG_CONFIG_HOME) {
  process.env.XDG_CONFIG_HOME = path.join(process.cwd(), '.wrangler-home');
}
initOpenNextCloudflareForDev();

/** 版本号以 package.json 为单一来源，构建时注入 process.env.APP_VERSION（/api/status 使用） */
function readAppVersion(): string {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')) as {
      version?: string;
    };
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

const nextConfig: NextConfig = {
  // standalone 输出仅供 Docker 镜像构建使用（DOCKER_BUILD=1）；
  // 本地 next start 在 standalone 模式下不受支持，故按环境切换
  output: process.env.DOCKER_BUILD === '1' ? 'standalone' : undefined,
  reactStrictMode: true,
  env: { APP_VERSION: readAppVersion() },
  // 采集站/豆瓣等上游地址在运行时由用户配置，构建期无法枚举，关闭图片优化改用 <img>
  images: { unoptimized: true },
};

export default nextConfig;
