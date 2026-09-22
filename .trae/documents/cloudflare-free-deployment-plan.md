# LibreTV Cloudflare（免费版）部署分析与调整方案

> 更新说明：已核实 `dev` 分支（当前线上正在使用的版本）的原生部署方式，本文档补充了「dev 分支部署架构分析」与「两分支对比决策」，并保留 main 分支（Next.js 重构版）接入 Cloudflare 的完整调整方案。

## 一、两个分支的现状

### 1.1 dev 分支（正在使用，LibreTV v1.1.0 旧版）—— 已原生支持 Cloudflare Pages 免费版

dev 分支是**纯静态前端 + 各平台 Serverless 函数**的架构，无任何构建步骤，Cloudflare Pages 是其官方支持的一键部署平台之一。

**部署组成（三部分）：**

| 部分 | 位置 | 作用 |
|------|------|------|
| 静态前端 | 仓库根目录（`index.html` / `player.html` / `watch.html` / `js/` / `css/` / `libs/`） | Pages 构建命令留空、输出目录为根目录，直接作为静态站点发布 |
| 代理函数 | `functions/proxy/[[path]].js` | Pages Functions 约定路由，拦截 `/proxy/*`：m3u8 重写、媒体分片透传、UA 伪装、多级重定向、`auth+timestamp` 参数鉴权；配置经 Pages 环境变量绑定（`PASSWORD`、`CACHE_TTL`、`MAX_RECURSION`、`USER_AGENTS_JSON`、`DEBUG`） |
| 环境注入中间件 | `functions/_middleware.js` | 拦截所有 HTML 响应，把 `window.__ENV__.PASSWORD = "{{PASSWORD}}";` 占位符替换为 `sha256(PASSWORD)`，实现密码注入 |

**为什么 dev 分支在免费版可直接运行：**
- 无构建步骤，纯静态请求在 Pages 免费版**不计数、不限量**
- Functions 依赖极少：sha256 用的是仓库自带纯 JS 实现（`js/sha256.js`），其余全是 Web 标准 API（fetch、Response），完全兼容 workerd 运行时
- Functions 请求走 Workers 免费额度（10 万次/天），对个人使用足够
- 环境变量在 Pages 控制台「设置 → 环境变量」绑定，`PASSWORD` 必填

**dev 分支同一套代码的多平台部署矩阵：**

| 平台 | 服务端能力实现 | 关键文件 |
|------|----------------|----------|
| Cloudflare Pages（正在使用） | Pages Functions | `functions/` 目录 |
| Vercel | Serverless Functions | `api/proxy/[...path].mjs` + `vercel.json`（rewrites 把 `/proxy/*` 指到 `/api/proxy/*`） |
| Netlify | Functions + Edge Functions | `netlify/functions/proxy.mjs` + `netlify/edge-functions/inject-env.js` + `netlify.toml` |
| Render / Docker | Node 进程 | `render.yaml` + `server.mjs`（Express）+ `Dockerfile` |

**dev 分支旧架构在 Cloudflare 上的固有局限（重构版要解决的问题）：**
- **鉴权弱**：`sha256(PASSWORD)` 明文下发到前端本地比对（`js/password.js`），哈希可被截获重放；main 分支已改为服务端 HMAC 签名会话 + httpOnly cookie
- **搜索在浏览器直连**采集站：暴露用户 IP、受 CORS 限制；main 分支已上移服务端聚合
- 无直播（IPTV）、订阅同步、EPG、观看历史搜索等新功能

### 1.2 main 分支（Next.js 15 重构版 v2.12.3，当前工作分支）—— 暂不支持 Cloudflare

main 分支是完整的 Next.js App Router 应用，官方仅提供 Docker 部署路径（`Dockerfile` + `docker-publish.yml`），直接部署 Cloudflare 会失败。

**代码级阻塞点：**

| # | 位置 | 问题 | 严重度 |
|---|------|------|--------|
| 1 | `src/lib/ssrf.ts:1` | `node:dns/promises` 的 `dns.lookup()`，workerd 运行时不支持 | **阻塞** |
| 2 | `src/lib/xmltv.ts:1` | `node:zlib` 的 `gunzipSync()`，同步 zlib API 在 workerd 不可靠 | **阻塞** |
| 3 | 15 个 API 路由的 `export const runtime = 'nodejs'` | 仅对 next-on-pages（edge-only）是硬伤；OpenNext 会忽略，无需改动 | 低（选型规避） |
| 4 | `src/lib/auth.ts` 的 `node:crypto`、`Buffer`、`setInterval` | `nodejs_compat` 兼容标志下均受支持，**保留不动** | 无 |
| 5 | `auth.ts` 内存限流 Map、`fetch-utils.ts`/`live-cache.ts` 内存 TTL 缓存 | Workers 多隔离实例间不共享，缓存/限流退化为「每实例独立、尽力而为」 | 可接受，文档说明 |
| 6 | `next.config.ts` 构建期读 `package.json` | OpenNext 构建同样跑在 Node 下，**保留不动** | 无 |

**Workers 免费版硬限制（两种方案都受约束）：**
- 请求数 100,000 次/天（HLS 分片经 `/api/proxy` 转发时每分片计 1 次）
- CPU 时间 10ms/请求（代理/搜索均为 I/O 密集，通常安全；超大 EPG XML 正则解析是最大风险点）
- 子请求 ≤50 次/单请求（搜索聚合最多 50 源 × 最多 5 页，可能超限）
- 无长驻进程：环境变量改用 wrangler secrets / 控制台配置

## 二、处理方案决策

| 路线 | 内容 | 改动量 | 适用场景 |
|------|------|--------|----------|
| **A. main 分支接入 Cloudflare Workers（推荐）** | 用 `@opennextjs/cloudflare` 适配器部署重构版，改造 2 个 lib 文件 + 新增 4 个配置 | 小（详见第三节） | 想用重构版的全部新能力（安全鉴权、服务端搜索、直播等）跑在 Cloudflare 免费版 |
| B. 维持现状 | dev 分支继续跑 Cloudflare Pages（零改动），main 分支继续 Docker | 零 | 对重构版上 Cloudflare 无迫切需求 |
| C. 静态导出 + 手写 API | `output: 'export'` + 重写全部 15 个 API 路由 | 极大 | 不推荐 |

**结论：** dev 分支部署方式已验证「纯静态 + Functions」模式在免费版完全可行；main 分支沿用同一云资源模型（静态资源 + Worker），只需通过 OpenNext 适配器把 Next.js 编译为该形态。路线 A 完成后两分支可并存过渡，互不影响。

## 三、路线 A 实施改动清单

### 3.1 新增依赖（`package.json`）

devDependencies 增加：`@opennextjs/cloudflare`、`wrangler`。

新增 scripts（保留现有 `dev`/`build`/`start` 不变）：

```json
"preview": "opennextjs-cloudflare build && opennextjs-cloudflare preview",
"deploy": "opennextjs-cloudflare build && opennextjs-cloudflare deploy",
"upload": "opennextjs-cloudflare build && opennextjs-cloudflare upload",
"cf-typegen": "wrangler types"
```

### 3.2 新增 `wrangler.jsonc`（项目根目录）

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "libretv",
  "main": ".open-next/worker.js",
  "compatibility_date": "2024-09-23",
  "compatibility_flags": ["nodejs_compat", "global_fetch_strictly_public"],
  "assets": { "directory": ".open-next/assets", "binding": "ASSETS" },
  "observability": { "enabled": true }
}
```

- `nodejs_compat`：使 `node:crypto`、`Buffer`、`AbortSignal` 在 workerd 可用（`auth.ts` 现状代码零改动）
- `global_fetch_strictly_public`：禁止 fetch 访问内部/回环地址，作为 SSRF 纵深补充
- `PASSWORD`、`PROXY_SECRET`、`LIVE_ALLOW_PRIVATE`、`SEARCH_MAX_PAGES` 等**不写入文件**，部署时 `wrangler secret put` / 控制台配置

### 3.3 修改 `src/lib/ssrf.ts`：DNS 校验改为 DoH（DNS over HTTPS）

- 移除 `import dns from 'node:dns/promises'`
- `isBlockedByDNS()` 签名保持 `async`，内部改为请求 Cloudflare DNS JSON API（`https://cloudflare-dns.com/dns-query?name=<host>&type=A` + `accept: application/dns-json`，并发查 AAAA，任一记录命中 `isPrivateIP` 即拦截）
- 查询失败/超时（2s）→ 返回 `false`，与现状「解析失败不阻断」语义一致
- `isPrivateIP`、`isValidProxyUrl`、`checkUpstreamAllowed`、`checkLiveUrlAllowed` 全部不动；`src/lib/ssrf.test.ts` 不受影响
- 纯 `fetch` 实现，Node（Docker）与 Workers 双兼容

### 3.4 修改 `src/lib/xmltv.ts`：gzip 解压改为 Web 标准 `DecompressionStream`

- 移除 `import { gunzipSync } from 'node:zlib'`；检测 `1f 8b` gzip 魔数后用 `DecompressionStream('gzip')` 流式解压（Node 18+ 与 Workers 均支持）
- `parseXmltv` 改为 `async`：参数 `string | Buffer` 改为 `string | Uint8Array`（`Buffer` 是 `Uint8Array` 子类，调用兼容）；返回 `Promise<Map<...>>`
- 同步更新调用方与测试：
  - `src/app/api/live/epg/route.ts:46-48`：`buf` 改 `Uint8Array`、`await parseXmltv(...)`，`Buffer.from(...)` 删除
  - `src/lib/xmltv.test.ts`：gzip 夹具改用 `CompressionStream('gzip')` 生成，断言加 `await`
- 附带收益：流式解压降低内存与 CPU 占用，缓解免费版限制

### 3.5 新增 `open-next.config.ts`（项目根目录）

```ts
import type { OpenNextConfig } from "@opennextjs/cloudflare";
const config: OpenNextConfig = { default: {} };
export default config;
```

### 3.6 环境变量文档

- `.env.example` 追加注释：Cloudflare 部署时变量经 `wrangler secret put` / Workers 控制台配置（`PASSWORD` 必填；https 下 `COOKIE_SECURE` 无需设置）
- `README.md` 新增「Cloudflare Workers（免费版）部署」小节：`npm run preview` 本地预览 → `wrangler secret put PASSWORD` → `npm run deploy`；免费版限制说明

### 3.7 新增 GitHub Actions `.github/workflows/cloudflare-deploy.yml`（可选 CI）

- 触发：`workflow_dispatch` + push tag `v*`（与 docker-publish.yml 对齐）
- 步骤：checkout → setup-node 20 → `npm ci` → `npx opennextjs-cloudflare build` → `cloudflare/wrangler-action@v3` 部署
- Secrets：`CLOUDFLARE_API_TOKEN`（Workers Scripts:Edit）、`CLOUDFLARE_ACCOUNT_ID`

### 3.8 明确不改动项

- 15 个路由的 `export const runtime = 'nodejs'`：OpenNext 忽略之，保留以避免无谓 diff
- `next.config.ts`、`auth.ts`、内存缓存/限流、Dockerfile、docker-publish.yml：全部保留
- 本期不引入 KV / Durable Objects / R2（升级项）

## 四、免费版限制的具体应对

| 限制 | 应对 |
|------|------|
| 搜索单请求 ≤50 子请求 | 部署文档建议 `SEARCH_MAX_PAGES=2`；现有 `sources.slice(0, 50)` 上限保持，单源失败不影响整体（现有容错已覆盖） |
| 100k 请求/天 | 高播放量建议图片代理模式选 direct；m3u8/图片响应已带 `Cache-Control`，命中 Cloudflare 边缘缓存后不计上游 |
| 10ms CPU | EPG 已有 24h 窗口裁剪 + gzip 流式解压；observability 面板发现 CPU 超限再针对性优化 |
| 内存缓存/限流失效于多实例 | README 注明「单实例尽力而为」；需严格限流时未来可换 Cloudflare KV，本期不做 |

## 五、验证步骤

1. **单测**：`npm run test`（vitest）——xmltv 改动后全部通过
2. **类型/lint**：`npm run typecheck`、`npm run lint`
3. **Node 路径回归**：`npm run build && npm start`，确认 Docker 部署路径行为不变
4. **Workers 本地预览**：`npm run preview`（miniflare），逐项验证：密码未配置提示/登录登出/鉴权 401、搜索（含 stream）、详情、豆瓣推荐、热榜、`/api/proxy` 图片与 m3u8 重写及 Range 分片、直播 M3U/gzip EPG/节目单
5. **真机部署**：`wrangler secret put PASSWORD` → `npm run deploy` → 公网域名走通第 4 步清单

## 六、假设与决策记录

- **决策**：dev 分支部署方式已证实「静态资源 + Functions」是免费版可行形态；main 分支经 OpenNext 编译为同一形态，属最小改动路径
- **决策**：选 Workers + `@opennextjs/cloudflare`（官方推荐、维护活跃），不用已进维护模式的 next-on-pages
- **决策**：`node:crypto` 不改写为 WebCrypto——`nodejs_compat` 已覆盖，且保持 Docker 路径零改动
- **决策**：DoH 校验在两种运行时统一使用，不为 Workers 单独开分支
- **假设**：部署者接受免费版「限流/缓存为尽力而为」的语义降级
- **假设**：无需自定义域名（Workers 默认 `*.workers.dev`）
