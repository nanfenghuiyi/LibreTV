// 临时诊断脚本：点播源探活 + 直播订阅频道流抽测（本机网络视角）
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const VOD = [
  ['电影天堂', 'http://caiji.dyttzyapi.com/api.php/provide/vod'],
  ['暴风资源', 'https://bfzyapi.com/api.php/provide/vod'],
  ['非凡资源', 'https://api.ffzyapi.com/api.php/provide/vod'],
  ['量子资源', 'https://cj.lziapi.com/api.php/provide/vod'],
  ['无尽资源', 'https://api.wujinapi.me/api.php/provide/vod'],
  ['如意资源', 'http://cj.rycjapi.com/api.php/provide/vod'],
  ['极速资源', 'https://jszyapi.com/api.php/provide/vod'],
  ['豆瓣资源', 'https://dbzy.tv/api.php/provide/vod'],
  ['天涯资源', 'https://tyyszy.com/api.php/provide/vod'],
  ['360资源', 'https://360zy.com/api.php/provide/vod'],
  ['茅台资源', 'https://caiji.maotaizy.cc/api.php/provide/vod'],
  ['魔都资源', 'https://www.mdzyapi.com/api.php/provide/vod'],
  ['最大资源', 'https://api.zuidapi.com/api.php/provide/vod'],
  ['樱花资源', 'https://m3u8.apiyhzy.com/api.php/provide/vod'],
  ['iKun资源', 'https://ikunzyapi.com/api.php/provide/vod'],
  ['百度资源', 'https://api.apibdzy.com/api.php/provide/vod'],
  ['红牛资源', 'https://www.hongniuzy2.com/api.php/provide/vod'],
  ['新浪资源', 'https://api.xinlangapi.com/xinlangapi.php/provide/vod'],
  ['CK资源', 'https://ckzy.me/api.php/provide/vod'],
  ['U酷资源', 'https://api.ukuapi.com/api.php/provide/vod'],
  ['1080资源', 'https://api.1080zyku.com/inc/apijson.php'],
  ['豪华资源', 'https://hhzyapi.com/api.php/provide/vod'],
  ['速博资源', 'https://subocaiji.com/api.php/provide/vod'],
  ['光速资源', 'https://api.guangsuapi.com/api.php/provide/vod'],
];

const LIVE = [
  ['范明明IPTV', 'https://live.fanmingming.com/tv/m3u/itv.m3u'],
  ['范明明IPv6', 'https://live.fanmingming.com/tv/m3u/ipv6.m3u'],
  ['每日更新IPv4', 'https://raw.githubusercontent.com/vbskycn/iptv/master/tv/iptv4.m3u'],
  ['每日更新IPv6', 'https://raw.githubusercontent.com/vbskycn/iptv/master/tv/iptv6.m3u'],
  ['suxuang全量IPv4', 'https://raw.githubusercontent.com/suxuang/myIPTV/main/ipv4.m3u'],
  ['suxuang全量IPv6', 'https://raw.githubusercontent.com/suxuang/myIPTV/main/ipv6.m3u'],
  ['YanG聚合', 'https://raw.githubusercontent.com/YanG-1989/m3u/main/Gather.m3u'],
  ['mzky测活列表', 'https://raw.githubusercontent.com/mzky/checklist/refs/heads/master/itvlist.m3u'],
  ['APTV测试源', 'https://raw.githubusercontent.com/Kimentanm/aptv/master/m3u/iptv.m3u'],
  ['YueChan全球', 'https://raw.githubusercontent.com/YueChan/Live/main/Global.m3u'],
  ['YueChan IPTV', 'https://raw.githubusercontent.com/YueChan/Live/main/IPTV.m3u'],
];

async function testVod(name, base) {
  const t = Date.now();
  try {
    const res = await fetch(`${base}?ac=list&pg=1`, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    const body = await res.text();
    let ok = false, total = 0;
    try {
      const j = JSON.parse(body);
      ok = j.code === 1 && Array.isArray(j.list);
      total = j.total ?? 0;
    } catch { /* 非 JSON */ }
    console.log(`VOD ${res.ok && ok ? 'OK  ' : 'FAIL'} ${Date.now() - t}ms http=${res.status} total=${total} ${name}`);
    return ok && res.ok;
  } catch (e) {
    console.log(`VOD FAIL ${Date.now() - t}ms ${e.name} ${name}`);
    return false;
  }
}

/** 解析 m3u，返回 [{name, url}] */
function parseM3u(text) {
  const lines = text.split(/\r?\n/);
  const out = [];
  let pending = null;
  for (const line of lines) {
    if (line.startsWith('#EXTINF')) {
      const m = line.match(/,(.+)$/);
      pending = m ? m[1].trim() : '未知';
    } else if (line && !line.startsWith('#') && line.trim()) {
      out.push({ name: pending || '未知', url: line.trim() });
      pending = null;
    }
  }
  return out;
}

/** 流可达性：响应头到达即算成功（不读 body，避免长连接挂起） */
async function testStream(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: '*/*' },
      signal: AbortSignal.timeout(6000),
      redirect: 'follow',
    });
    const ok = res.ok;
    const ct = res.headers.get('content-type') || '';
    try { await res.body?.cancel(); } catch { /* 忽略 */ }
    return { ok, status: res.status, ct };
  } catch (e) {
    return { ok: false, status: e.name === 'TimeoutError' ? 'timeout' : 'err', ct: '' };
  }
}

async function testLive(name, m3uUrl) {
  const t = Date.now();
  try {
    const res = await fetch(m3uUrl, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      console.log(`LIVE FAIL(下载 ${res.status}) ${Date.now() - t}ms ${name}`);
      return;
    }
    const channels = parseM3u(await res.text());
    // 抽样：前 5 个 + 中间 3 个
    const sample = [];
    const step = [0, 1, 2, 3, 4].map((i) => channels[i]);
    const mid = [0.4, 0.5, 0.6].map((r) => channels[Math.floor(channels.length * r)]);
    for (const c of [...step, ...mid]) if (c) sample.push(c);
    const results = await Promise.all(sample.map((c) => testStream(c.url).then((r) => ({ ...r, name: c.name, url: c.url }))));
    const okCount = results.filter((r) => r.ok).length;
    console.log(`LIVE ${okCount}/${sample.length} ${Date.now() - t}ms ch=${channels.length} ${name}`);
    for (const r of results) {
      if (!r.ok) console.log(`   X [${r.status}] ${r.name} ${r.url.slice(0, 80)}`);
    }
  } catch (e) {
    console.log(`LIVE FAIL(${e.name}) ${Date.now() - t}ms ${name}`);
  }
}

const mode = process.argv[2] || 'all';
const limit = 6; // 并发
async function pool(items, fn) {
  const queue = [...items];
  const workers = Array.from({ length: limit }, async () => {
    while (queue.length) await fn(queue.shift());
  });
  await Promise.all(workers);
}

if (mode === 'vod' || mode === 'all') {
  console.log('===== 点播源探活 =====');
  await pool(VOD, ([n, u]) => testVod(n, u));
}
if (mode === 'live' || mode === 'all') {
  console.log('===== 直播订阅频道流抽测（本机视角） =====');
  await pool(LIVE, ([n, u]) => testLive(n, u));
}
