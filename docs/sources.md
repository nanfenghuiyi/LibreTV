# LibreTV 可用源列表

> 探测日期：2026-09-22（Asia/Shanghai），逐个源实际请求验证（点播源请求 `?ac=list&pg=1` 校验 JSON 响应，直播源校验 M3U 内容并统计频道数）。
> 免费公开源具有时效性，会不定期失效或更换域名，请以实际使用为准。本文仅作技术记录，不存储、不分发任何音视频内容。

## 点播源（Apple CMS 采集站）

共探测 30 个公开采集站，以下 **24 个在探测时可用**（`库存量` 为接口返回的影片总数）。

| 名称 | 接口地址 | 库存量 | 备注 |
|---|---|---:|---|
| 电影天堂 | `http://caiji.dyttzyapi.com/api.php/provide/vod` | 84060 | 老牌源，资源较全 |
| 暴风资源 | `https://bfzyapi.com/api.php/provide/vod` | 160294 | 库存大，更新快 |
| 非凡资源 | `https://api.ffzyapi.com/api.php/provide/vod` | 98189 | 热门剧集收录快 |
| 量子资源 | `https://cj.lziapi.com/api.php/provide/vod` | 155710 | 资源全，接口稍慢 |
| 无尽资源 | `https://api.wujinapi.me/api.php/provide/vod` | 120743 | 稳定 |
| 如意资源 | `http://cj.rycjapi.com/api.php/provide/vod` | 86160 | 稳定 |
| 极速资源 | `https://jszyapi.com/api.php/provide/vod` | 111615 | 速度较快 |
| 豆瓣资源 | `https://dbzy.tv/api.php/provide/vod` | 145067 | 按豆瓣条目组织 |
| 天涯资源 | `https://tyyszy.com/api.php/provide/vod` | 70266 | — |
| 360 资源 | `https://360zy.com/api.php/provide/vod` | 71361 | — |
| 茅台资源 | `https://caiji.maotaizy.cc/api.php/provide/vod` | 147415 | — |
| 魔都资源 | `https://www.mdzyapi.com/api.php/provide/vod` | 89049 | — |
| 最大资源 | `https://api.zuidapi.com/api.php/provide/vod` | 123289 | — |
| 樱花资源 | `https://m3u8.apiyhzy.com/api.php/provide/vod` | 103014 | 动漫资源较多 |
| iKun 资源 | `https://ikunzyapi.com/api.php/provide/vod` | 66976 | — |
| 百度资源 | `https://api.apibdzy.com/api.php/provide/vod` | 48504 | — |
| 红牛资源 | `https://www.hongniuzy2.com/api.php/provide/vod` | 112771 | — |
| 新浪资源 | `https://api.xinlangapi.com/xinlangapi.php/provide/vod` | 113354 | 路径含 `xinlangapi.php`，非标准 |
| CK 资源 | `https://ckzy.me/api.php/provide/vod` | 7506 | 库存较少 |
| U 酷资源 | `https://api.ukuapi.com/api.php/provide/vod` | 58104 | — |
| 1080 资源 | `https://api.1080zyku.com/inc/apijson.php` | 103996 | 路径非标准 `api.php` |
| 豪华资源 | `https://hhzyapi.com/api.php/provide/vod` | 112382 | — |
| 速博资源 | `https://subocaiji.com/api.php/provide/vod` | 113286 | — |
| 光速资源 | `https://api.guangsuapi.com/api.php/provide/vod` | 113347 | — |

探测时不可用（备用复查）：卧龙 `https://wolongzyw.com`、魔爪 `https://mozhuazy.com`、旺旺短剧 `https://wwzy.tv`、飘零 `https://p2100.net`（403）、快车 `https://caiji.kczyapi.com`、天翼 `https://api.tianyizyapi.com`。

### 使用方式

**方式一：界面添加** — 设置 → 源管理 → 数据源 → 填入上方接口地址（推荐添加 3~6 个即可，过多会拖慢搜索）。

**方式二：`DEFAULT_SOURCES` 环境变量预置**（部署者配置，用户端自动出现并默认勾选），以下为全部 24 个可用源的直接可用配置：

```json
[
  {"name":"电影天堂","url":"http://caiji.dyttzyapi.com/api.php/provide/vod"},
  {"name":"暴风资源","url":"https://bfzyapi.com/api.php/provide/vod"},
  {"name":"非凡资源","url":"https://api.ffzyapi.com/api.php/provide/vod"},
  {"name":"量子资源","url":"https://cj.lziapi.com/api.php/provide/vod"},
  {"name":"无尽资源","url":"https://api.wujinapi.me/api.php/provide/vod"},
  {"name":"如意资源","url":"http://cj.rycjapi.com/api.php/provide/vod"},
  {"name":"极速资源","url":"https://jszyapi.com/api.php/provide/vod"},
  {"name":"豆瓣资源","url":"https://dbzy.tv/api.php/provide/vod"},
  {"name":"天涯资源","url":"https://tyyszy.com/api.php/provide/vod"},
  {"name":"360资源","url":"https://360zy.com/api.php/provide/vod"},
  {"name":"茅台资源","url":"https://caiji.maotaizy.cc/api.php/provide/vod"},
  {"name":"魔都资源","url":"https://www.mdzyapi.com/api.php/provide/vod"},
  {"name":"最大资源","url":"https://api.zuidapi.com/api.php/provide/vod"},
  {"name":"樱花资源","url":"https://m3u8.apiyhzy.com/api.php/provide/vod"},
  {"name":"iKun资源","url":"https://ikunzyapi.com/api.php/provide/vod"},
  {"name":"百度资源","url":"https://api.apibdzy.com/api.php/provide/vod"},
  {"name":"红牛资源","url":"https://www.hongniuzy2.com/api.php/provide/vod"},
  {"name":"新浪资源","url":"https://api.xinlangapi.com/xinlangapi.php/provide/vod"},
  {"name":"CK资源","url":"https://ckzy.me/api.php/provide/vod"},
  {"name":"U酷资源","url":"https://api.ukuapi.com/api.php/provide/vod"},
  {"name":"1080资源","url":"https://api.1080zyku.com/inc/apijson.php"},
  {"name":"豪华资源","url":"https://hhzyapi.com/api.php/provide/vod"},
  {"name":"速博资源","url":"https://subocaiji.com/api.php/provide/vod"},
  {"name":"光速资源","url":"https://api.guangsuapi.com/api.php/provide/vod"}
]
```

## 直播源（M3U 订阅）

以下订阅地址在探测时可用（`频道数` 为 M3U 中 `#EXTINF` 条目数）。

| 名称 | M3U 订阅地址 | 频道数 | EPG（XMLTV） | 备注 |
|---|---|---:|---|---|
| 范明明 · 国内 IPTV | `https://live.fanmingming.com/tv/m3u/itv.m3u` | 189 | `https://live.fanmingming.com/e.xml` | 央视/卫视/地方，需 IPv6 或组播网络 |
| 范明明 · IPv6 | `https://live.fanmingming.com/tv/m3u/ipv6.m3u` | 82 | `https://live.fanmingming.com/e.xml` | 纯 IPv6 网络 |
| vbskycn · IPv4 | `https://raw.githubusercontent.com/vbskycn/iptv/master/tv/iptv4.m3u` | 392 | `http://epg.51zmt.top:8000/e.xml` | 每日自动测活更新 |
| vbskycn · IPv6 | `https://raw.githubusercontent.com/vbskycn/iptv/master/tv/iptv6.m3u` | — | `http://epg.51zmt.top:8000/e.xml` | 需 IPv6 网络 |
| suxuang · IPv4 | `https://raw.githubusercontent.com/suxuang/myIPTV/main/ipv4.m3u` | 1273 | `https://live.fanmingming.com/e.xml` | 频道最全，含港澳台 |
| suxuang · IPv6 | `https://raw.githubusercontent.com/suxuang/myIPTV/main/ipv6.m3u` | 862 | `https://live.fanmingming.com/e.xml` | — |
| YanG-1989 聚合 | `https://raw.githubusercontent.com/YanG-1989/m3u/main/Gather.m3u` | 123 | `https://live.fanmingming.com/e.xml` | 聚合多来源 |
| mzky itvlist | `https://raw.githubusercontent.com/mzky/checklist/refs/heads/master/itvlist.m3u` | 569 | — | 定时测活 |
| APTV 测试源 | `https://raw.githubusercontent.com/Kimentanm/aptv/master/m3u/iptv.m3u` | 120 | — | 官方测试源 |
| YueChan · 全球 | `https://raw.githubusercontent.com/YueChan/Live/main/Global.m3u` | 74 | — | 全球频道 |
| YueChan · IPTV | `https://raw.githubusercontent.com/YueChan/Live/main/IPTV.m3u` | 96 | — | 央视/卫视 |

> - `raw.githubusercontent.com` 在部分网络环境下不稳定，可加加速前缀使用，例如：`https://gh-proxy.com/raw.githubusercontent.com/vbskycn/iptv/refs/heads/master/tv/iptv4.m3u`。
> - 频道能否实际播放取决于网络（IPv4/IPv6、运营商组播等），建议在「直播」页先用探活功能筛选。

### 使用方式

**方式一：界面添加** — 设置 → 源管理 → 直播源 → 填入 M3U 地址（可选填 XMLTV 节目单地址），添加后自动探活。

**方式二：`DEFAULT_LIVE_SOURCES` 环境变量预置**（部署者配置），推荐组合：

```json
[
  {"name":"范明明IPTV","url":"https://live.fanmingming.com/tv/m3u/itv.m3u","epg":"https://live.fanmingming.com/e.xml"},
  {"name":"每日更新IPv4","url":"https://raw.githubusercontent.com/vbskycn/iptv/master/tv/iptv4.m3u","epg":"http://epg.51zmt.top:8000/e.xml"},
  {"name":"suxuang全量","url":"https://raw.githubusercontent.com/suxuang/myIPTV/main/ipv4.m3u","epg":"https://live.fanmingming.com/e.xml"}
]
```

## 数据来源

- 点播源列表整理自 MoonTV / LibreTV 系项目的公开默认配置（LiuShen/backup-moontv-config 等），并经本机逐个探活筛选。
- 直播源来自以下维护中的开源仓库：
  - [fanmingming/live](https://github.com/fanmingming/live)
  - [vbskycn/iptv](https://github.com/vbskycn/iptv)
  - [suxuang/myIPTV](https://github.com/suxuang/myIPTV)
  - [YanG-1989/m3u](https://github.com/YanG-1989/m3u)
  - [YueChan/Live](https://github.com/YueChan/Live)
  - [mzky/checklist](https://github.com/mzky/checklist)
  - [Kimentanm/aptv](https://github.com/Kimentanm/aptv)
  - [HerbertHe/iptv-sources](https://github.com/HerbertHe/iptv-sources)（聚合镜像站 https://m3u.ibert.me ）
- EPG 节目单：[fanmingming/live](https://live.fanmingming.com/e.xml)、[51zmt](http://epg.51zmt.top:8000/e.xml)

## 免责声明

本文件所列均为互联网公开的技术接口地址，仅供学习与研究。所有内容均来自第三方站点，与本项目的开发者和部署者无关；请遵守所在地区法律法规，勿用于商业用途。
