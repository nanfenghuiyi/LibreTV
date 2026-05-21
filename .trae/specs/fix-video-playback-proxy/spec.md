# 视频播放代理修复规格

## Why
部分视频链接在浏览器中可以直接访问，但在播放器中无法播放。这是因为 HLS.js 直接加载视频 URL 时可能遇到 CORS 限制、Referer 限制或其他跨域问题。项目已有完善的代理服务 (`/api/proxy/[...path]`)，但播放器未使用它。

## What Changes
- 修改播放器初始化逻辑，将视频 URL 重写为代理 URL
- 添加代理 URL 转换函数，支持自动检测和处理视频链接
- 保持现有错误处理和重试机制不变
- 确保代理服务处理 M3U8 内容和媒体片段

## Impact
- 受影响规格：视频播放功能
- 受影响代码：`js/player.js` (播放器初始化、URL 处理)
- 依赖服务：`api/proxy/[...path].mjs` (已存在，无需修改)

## MODIFIED Requirements
### Requirement: 视频播放
播放器 SHALL 通过代理服务加载视频内容，以解决 CORS 和跨域限制问题。

#### Scenario: 视频 URL 可正常播放
- **WHEN** 用户打开播放页面
- **THEN** 视频 URL 被转换为代理 URL
- **AND** 播放器通过代理服务加载视频
- **AND** 视频正常播放

#### Scenario: 视频 URL 有 CORS 限制
- **WHEN** 视频 URL 有跨域限制
- **THEN** 代理服务处理请求并返回内容
- **AND** 播放器可以正常加载和播放视频

#### Scenario: 视频 URL 直接可访问
- **WHEN** 视频 URL 没有跨域限制
- **THEN** 代理服务仍然处理请求
- **AND** 视频正常播放（性能影响可接受）
