// 全局常量配置 - 纯常量，无副作用

export const PROXY_URL = '/proxy/';

export const SEARCH_HISTORY_KEY = 'videoSearchHistory';

export const MAX_HISTORY_ITEMS = 5;

export const PASSWORD_CONFIG = Object.freeze({
    localStorageKey: 'passwordVerified',
    verificationTTL: 90 * 24 * 60 * 60 * 1000 // 90天
});

export const SITE_CONFIG = Object.freeze({
    name: 'LibreTV',
    url: 'https://libretv.is-an.org',
    description: '免费在线视频搜索与观看平台',
    logo: 'image/logo.png',
    version: '1.1.0'
});

// 聚合搜索配置
export const AGGREGATED_SEARCH_CONFIG = Object.freeze({
    enabled: true,
    timeout: 8000,
    maxResults: 10000,
    parallelRequests: true,
    showSourceBadges: true
});

// API 站点配置
export const API_SITES = Object.freeze({
    testSource: {
        api: 'https://www.example.com/api.php/provide/vod',
        name: '空内容测试源',
        adult: true
    },
    qiqi: {
        api: 'https://www.qiqidys.com/api.php/provide/vod',
        name: '七七资源'
    },
    dyttzy: {
        api: 'http://caiji.dyttzyapi.com/api.php/provide/vod',
        name: '电影天堂资源',
        detail: 'http://caiji.dyttzyapi.com'
    },
    heimuer: {
        api: 'https://json.heimuer.xyz/api.php/provide/vod',
        name: '黑木耳',
        detail: 'https://heimuer.tv'
    },
    ruyi: {
        api: 'http://cj.rycjapi.com/api.php/provide/vod',
        name: '如意资源'
    },
    bfzy: {
        api: 'https://bfzyapi.com/api.php/provide/vod',
        name: '暴风资源'
    },
    tyyszy: {
        api: 'https://tyyszy.com/api.php/provide/vod',
        name: '天涯资源'
    },
    ffzy: {
        api: 'http://ffzy5.tv/api.php/provide/vod',
        name: '非凡影视',
        detail: 'http://ffzy5.tv'
    },
    zy360: {
        api: 'https://360zy.com/api.php/provide/vod',
        name: '360资源'
    },
    maotaizy: {
        api: 'https://caiji.maotaizy.cc/api.php/provide/vod',
        name: '茅台资源'
    },
    wolong: {
        api: 'https://wolongzyw.com/api.php/provide/vod',
        name: '卧龙资源'
    },
    jisu: {
        api: 'https://jszyapi.com/api.php/provide/vod',
        name: '极速资源',
        detail: 'https://jszyapi.com'
    },
    dbzy: {
        api: 'https://dbzy.tv/api.php/provide/vod',
        name: '豆瓣资源'
    },
    mozhua: {
        api: 'https://mozhuazy.com/api.php/provide/vod',
        name: '魔爪资源'
    },
    mdzy: {
        api: 'https://www.mdzyapi.com/api.php/provide/vod',
        name: '魔都资源'
    },
    zuid: {
        api: 'https://api.zuidapi.com/api.php/provide/vod',
        name: '最大资源'
    },
    yinghua: {
        api: 'https://m3u8.apiyhzy.com/api.php/provide/vod',
        name: '樱花资源'
    },
    wujin: {
        api: 'https://api.wujinapi.me/api.php/provide/vod',
        name: '无尽资源'
    },
    wwzy: {
        api: 'https://wwzy.tv/api.php/provide/vod',
        name: '旺旺短剧'
    },
    ikun: {
        api: 'https://ikunzyapi.com/api.php/provide/vod',
        name: 'iKun资源'
    },
    lzi: {
        api: 'https://cj.lziapi.com/api.php/provide/vod',
        name: '量子资源站'
    },
    xiaomaomi: {
        api: 'https://zy.xmm.hk/api.php/provide/vod',
        name: '小猫咪资源'
    },
    baiduyun: {
        api: 'https://api.apibdzy.com/api.php/provide/vod',
        name: '百度云资源'
    },
    youku: {
        api: 'https://api.ukuapi.com/api.php/provide/vod',
        name: '优酷资源'
    },
    huya: {
        api: 'https://www.huyaapi.com/api.php/provide/vod',
        name: '虎牙资源'
    }
});

// API 请求配置
export const API_CONFIG = Object.freeze({
    search: {
        path: '?ac=videolist&wd=',
        pagePath: '?ac=videolist&wd={query}&pg={page}',
        maxPages: 50,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'application/json'
        }
    },
    detail: {
        path: '?ac=videolist&ids=',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'application/json'
        }
    }
});

export const M3U8_PATTERN = /\$https?:\/\/[^"'\s]+?\.m3u8/g;

export const CUSTOM_PLAYER_URL = 'player.html';

export const PLAYER_CONFIG = Object.freeze({
    autoplay: true,
    allowFullscreen: true,
    width: '100%',
    height: '600',
    timeout: 15000,
    filterAds: true,
    autoPlayNext: true,
    adFilteringEnabled: true,
    adFilteringStorage: 'adFilteringEnabled'
});

export const ERROR_MESSAGES = Object.freeze({
    NETWORK_ERROR: '网络连接错误，请检查网络设置',
    TIMEOUT_ERROR: '请求超时，服务器响应时间过长',
    API_ERROR: 'API接口返回错误，请尝试更换数据源',
    PLAYER_ERROR: '播放器加载失败，请尝试其他视频源',
    UNKNOWN_ERROR: '发生未知错误，请刷新页面重试'
});

export const SECURITY_CONFIG = Object.freeze({
    enableXSSProtection: true,
    sanitizeUrls: true,
    maxQueryLength: 100
});

export const CUSTOM_API_CONFIG = Object.freeze({
    separator: ',',
    maxSources: 5,
    testTimeout: 5000,
    namePrefix: 'Custom-',
    validateUrl: true,
    cacheResults: true,
    cacheExpiry: 5184000000,
    adultPropName: 'isAdult'
});

export const HIDE_BUILTIN_ADULT_APIS = false;

// 默认选中的API
export const DEFAULT_SELECTED_APIS = ['tyyszy', 'dyttzy', 'bfzy', 'ruyi'];
