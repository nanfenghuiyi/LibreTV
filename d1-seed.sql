-- LibreTV 站点共享源种子数据（与 src/lib/shared-config.ts 的 KV 模式兼容）
-- 表结构由应用自动创建，这里 IF NOT EXISTS 兜底
-- 2026-09-22 探活筛选：
--   点播 24→18（剔除连续失败的死源：如意/iKun/红牛/CK/U酷/1080，均为 ECONNRESET）
--   直播 11→4（仅保留海外节点实测可播的订阅；剔除运营商内网 IPTV、rtp:// 组播、404 与无法验证的源）
CREATE TABLE IF NOT EXISTS shared_config (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

INSERT INTO shared_config (k, v, updated_at) VALUES ('sources', '{"sources":[{"name":"电影天堂","url":"http://caiji.dyttzyapi.com/api.php/provide/vod"},{"name":"暴风资源","url":"https://bfzyapi.com/api.php/provide/vod"},{"name":"非凡资源","url":"https://api.ffzyapi.com/api.php/provide/vod"},{"name":"量子资源","url":"https://cj.lziapi.com/api.php/provide/vod"},{"name":"无尽资源","url":"https://api.wujinapi.me/api.php/provide/vod"},{"name":"极速资源","url":"https://jszyapi.com/api.php/provide/vod"},{"name":"豆瓣资源","url":"https://dbzy.tv/api.php/provide/vod"},{"name":"天涯资源","url":"https://tyyszy.com/api.php/provide/vod"},{"name":"360资源","url":"https://360zy.com/api.php/provide/vod"},{"name":"茅台资源","url":"https://caiji.maotaizy.cc/api.php/provide/vod"},{"name":"魔都资源","url":"https://www.mdzyapi.com/api.php/provide/vod"},{"name":"最大资源","url":"https://api.zuidapi.com/api.php/provide/vod"},{"name":"樱花资源","url":"https://m3u8.apiyhzy.com/api.php/provide/vod"},{"name":"百度资源","url":"https://api.apibdzy.com/api.php/provide/vod"},{"name":"新浪资源","url":"https://api.xinlangapi.com/xinlangapi.php/provide/vod"},{"name":"豪华资源","url":"https://hhzyapi.com/api.php/provide/vod"},{"name":"速博资源","url":"https://subocaiji.com/api.php/provide/vod"},{"name":"光速资源","url":"https://api.guangsuapi.com/api.php/provide/vod"}],"liveSources":[{"name":"YanG聚合","url":"https://raw.githubusercontent.com/YanG-1989/m3u/main/Gather.m3u","epg":"https://live.fanmingming.com/e.xml"},{"name":"YueChan全球","url":"https://raw.githubusercontent.com/YueChan/Live/main/Global.m3u"},{"name":"每日更新IPv4","url":"https://raw.githubusercontent.com/vbskycn/iptv/master/tv/iptv4.m3u","epg":"http://epg.51zmt.top:8000/e.xml"},{"name":"mzky测活列表","url":"https://raw.githubusercontent.com/mzky/checklist/refs/heads/master/itvlist.m3u"}]}', 1790074000000)
ON CONFLICT(k) DO UPDATE SET v = excluded.v, updated_at = excluded.updated_at;
