* [x] URL 代理转换函数 `convertToProxyUrl()` 已创建并正确处理各种 URL 格式

* [x] `initPlayer()` 函数在初始化播放器前将视频 URL 转换为代理 URL

* [x] 代理 URL 格式正确（`/proxy/{encoded_url}`），与现有代理服务兼容

* [x] 有 CORS 限制的视频链接现在可以通过代理正常播放

* [x] 错误处理和重试机制仍然正常工作

* [x] 下载功能仍然使用原始 URL（不通过代理）

