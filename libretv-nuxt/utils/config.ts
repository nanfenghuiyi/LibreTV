
// 全局常量配置
export const PROXY_URL = '/api/proxy/'; 

// 网站信息配置
export const SITE_CONFIG = {
    name: 'LibreTV',
    url: 'https://libretv.is-an.org',
    description: '免费在线视频搜索与观看平台',
    logo: '/image/logo.png',
    version: '1.0.3'
};

// API站点配置
export const API_SITES: Record<string, any> = {
    qiqi: {
        api: "https://www.qiqidys.com/api.php/provide/vod/",
        name: "七七资源",
        adult: false
    },
    dyttzy: {
        api: "http://caiji.dyttzyapi.com/api.php/provide/vod/",
        name: "电影天堂资源",
        detail: "http://caiji.dyttzyapi.com",
        adult: false
    },
    heimuer: {
        api: "https://json.heimuer.xyz/api.php/provide/vod/",
        name: "黑木耳",
        detail: "https://heimuer.tv",
        adult: true
    },
    ruyi: {
        api: "http://cj.rycjapi.com/api.php/provide/vod/",
        name: "如意资源",
        adult: false
    },
    bfzy: {
        api: "https://bfzyapi.com/api.php/provide/vod/",
        name: "暴风资源",
        adult: false
    },
    tyyszy: {
        api: "https://tyyszy.com/api.php/provide/vod/",
        name: "天涯资源",
        adult: false
    },
    ffzy: {
        api: "http://ffzy5.tv/api.php/provide/vod/",
        name: "非凡影视",
        detail: "http://ffzy5.tv",
        adult: false
    },
    zy360: {
        api: "https://360zy.com/api.php/provide/vod/",
        name: "360资源",
        adult: false
    },
    maotaizy: {
        api: "https://caiji.maotaizy.cc/api.php/provide/vod/",
        name: "茅台资源",
        adult: false
    },
    wolong: {
        api: "https://wolongzyw.com/api.php/provide/vod/",
        name: "卧龙资源",
        adult: false
    },
    jisu: {
        api: "https://jszyapi.com/api.php/provide/vod/",
        name: "极速资源",
        detail: "https://jszyapi.com",
        adult: false
    },
    dbzy: {
        api: "https://dbzy.tv/api.php/provide/vod/",
        name: "豆瓣资源",
        adult: false
    },
    mozhua: {
        api: "https://mozhuazy.com/api.php/provide/vod/",
        name: "魔爪资源",
        adult: true
    },
    mdzy: {
        api: "https://www.mdzyapi.com/api.php/provide/vod/",
        name: "魔都资源",
        adult: true
    },
    zuid: {
        api: "https://api.zuidapi.com/api.php/provide/vod/",
        name: "最大资源",
        adult: false
    },
    yinghua: {
        api: "https://m3u8.apiyhzy.com/api.php/provide/vod/",
        name: "樱花资源",
        adult: false
    },
    wujin: {
        api: "https://api.wujinapi.me/api.php/provide/vod/",
        name: "无尽资源",
        adult: false
    },
    wwzy: {
        api: "https://wwzy.tv/api.php/provide/vod/",
        name: "旺旺短剧",
        adult: false
    },
    ikun: {
        api: "https://ikunzyapi.com/api.php/provide/vod/",
        name: "iKun资源",
        adult: false
    },
    lzi: {
        api: "https://cj.lziapi.com/api.php/provide/vod/",
        name: "量子资源站",
        adult: false
    },
    xiaomaomi: {
        api: "https://zy.xmm.hk/api.php/provide/vod/",
        name: "小猫咪资源",
        adult: false
    },
    baiduyun: {
        api: "https://api.apibdzy.com/api.php/provide/vod/",
        name: "百度云资源",
        adult: false
    },
    youku: {
        api: "https://api.ukuapi.com/api.php/provide/vod/",
        name: "优酷资源",
        adult: false
    },
    huya: {
        api: "https://www.huyaapi.com/api.php/provide/vod/",
        name: "虎牙资源",
        adult: false
    }
};

// 抽象API请求配置
export const API_CONFIG = {
    search: {
        path: '?ac=videolist&wd=',
        pagePath: '?ac=videolist&wd={query}&pg={page}',
        maxPages: 5, // Reduced default for performance
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
};

export const CUSTOM_API_CONFIG = {
    separator: ',',
    maxSources: 5,
    testTimeout: 5000,
    namePrefix: 'Custom-',
    validateUrl: true,
    cacheResults: true,
    cacheExpiry: 5184000000,
    adultPropName: 'isAdult'
};
