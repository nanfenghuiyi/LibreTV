# LibreTV - 免费在线视频搜索与观看平台 (Nuxt 重构版)

<div align="center">
  <img src="libretv-nuxt/public/image/logo.png" alt="LibreTV Logo" width="120">
  <br>
  <p><strong>自由观影，畅享精彩 —— 基于 Nuxt 3 的全新重构版本</strong></p>
</div>

## 📺 项目简介

LibreTV 是一个轻量级、免费的在线视频搜索与观看平台。本次重构基于 **Nuxt 3 + Tailwind CSS + Artplayer**，提供了更流畅的交互、跨站换源切换、观看历史记录、以及更强大的视频代理功能。

## 🚀 一键部署

选择以下平台，点击按钮即可快速创建自己的 LibreTV (Nuxt 版) 实例：

[![Deploy to Zeabur](https://zeabur.com/button.svg)](https://zeabur.com/templates/XXXXX) <!-- 注意：此处模板ID需替换或使用通用按钮 -->
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fnanfenghuiyi%2FLibreTV&root-directory=libretv-nuxt)
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/nanfenghuiyi%2FLibreTV&base=libretv-nuxt)

> [!IMPORTANT]
> **部署时必须设置 `PASSWORD` 环境变量**，否则将无法正常使用视频代理功能。

## 📋 详细部署指南

由于项目重构版本位于 `libretv-nuxt` 子目录下，部署时请参照以下设置：

### ☁️ Cloudflare Pages (推荐)

1. **创建项目**: 连接 GitHub 仓库。
2. **构建设置**:
   - **框架预设**: `Nuxt.js`
   - **根目录**: `libretv-nuxt`
   - **构建命令**: `npm run build`
   - **输出目录**: `.output/public`
3. **环境变量**:
   - 在 `设置` -> `环境变量` 中添加 `PASSWORD` (例如: `123456`)。
   - (可选) 如果构建失败，请确保 `NODE_VERSION` 大于 `18.x`。

### ⚡ Zeabur

1. **导入仓库**: 选择本仓库。
2. **配置**: 
   - Zeabur 会自动识别 `libretv-nuxt` 为 Nuxt 项目。
   - 如果未自动识别，请在服务设置中将 `Root Directory` 设置为 `libretv-nuxt`。
3. **变量**: 在 `Variables` 面板中添加 `PASSWORD`。

### 🐳 Docker

```bash
docker run -d \
  --name libretv-nuxt \
  -p 3000:3000 \
  -e PASSWORD=你的密码 \
  -v ./data:/app/libretv-nuxt/.data \
  bestzwei/libretv:latest
```

## 🔧 开发与配置

### 本地运行
```bash
cd libretv-nuxt
npm install
# 复制并配置环境变量
cp .env.example .env
npm run dev
```

### 环境变量说明
| 变量名 | 说明 | 默认值 |
| --- | --- | --- |
| `PASSWORD` | **[必须]** 访问密码，用于代理授权 | `111111` |
| `PORT` | 运行端口 | `3000` |
| `USER_AGENT` | 模拟请求头的 UA | 默认现代浏览器 |

## 🛠️ 技术栈更新
- **前端框架**: [Nuxt 3](https://nuxt.com/) (Vue 3 + Vite)
- **样式方案**: [Tailwind CSS](https://tailwindcss.com/)
- **播放器**: [Artplayer.js](https://artplayer.org/) + [Hls.js](https://github.com/video-dev/hls.js/)
- **存储**: LocalStorage (观看历史、设置)
- **代理服务**: Nitro Server Engine (支持跨域 M3U8 代理)

## ⚠️ 免责声明与原版说明
本项目基于 [bestK/tv](https://github.com/bestK/tv) 重构。LibreTV 仅作为视频搜索工具，不存储、上传或分发任何视频内容。所有视频均来自第三方 API 接口提供的搜索结果。使用本项目时，您必须遵守当地的法律法规。

---
**[LibreTV Nuxt Refactor @ 2025]**