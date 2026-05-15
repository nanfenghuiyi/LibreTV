// 响应数据解析与格式化

import { M3U8_PATTERN } from '../core/config.js';

/**
 * 为搜索结果添加源信息
 */
export function formatSearchResults(list, sourceCode, sourceName, apiUrl = null) {
    if (!Array.isArray(list)) return [];
    return list.map(item => ({
        ...item,
        source_name: sourceName,
        source_code: sourceCode,
        ...(apiUrl ? { api_url: apiUrl } : {})
    }));
}

/**
 * 从视频详情中提取集数列表
 */
export function extractEpisodes(videoDetail) {
    let episodes = [];

    if (videoDetail.vod_play_url) {
        const playSources = videoDetail.vod_play_url.split('$$$');
        if (playSources.length > 0) {
            const mainSource = playSources[0];
            const episodeList = mainSource.split('#');
            episodes = episodeList.map(ep => {
                const parts = ep.split('$');
                return parts.length > 1 ? parts[1] : '';
            }).filter(url => url && (url.startsWith('http://') || url.startsWith('https://')));
        }
    }

    // 如果没有找到播放地址，尝试从内容中匹配 m3u8
    if (episodes.length === 0 && videoDetail.vod_content) {
        const matches = videoDetail.vod_content.match(M3U8_PATTERN) || [];
        episodes = matches.map(link => link.replace(/^\$/, ''));
    }

    return episodes;
}

/**
 * 构建详情响应对象
 */
export function buildDetailResponse(episodes, detailUrl, videoInfo) {
    return {
        code: 200,
        episodes,
        detailUrl,
        videoInfo
    };
}

/**
 * 构建错误响应
 */
export function buildErrorResponse(message, extra = {}) {
    return {
        code: 400,
        msg: message || '请求处理失败',
        list: [],
        episodes: [],
        ...extra
    };
}

/**
 * 从 HTML 内容中提取 m3u8 链接
 */
export function extractM3u8FromHtml(html, sourceCode = null) {
    let matches = [];

    if (sourceCode === 'ffzy') {
        const ffzyPattern = /\$(https?:\/\/[^"'\s]+?\/\d{8}\/\d+_[a-f0-9]+\/index\.m3u8)/g;
        matches = html.match(ffzyPattern) || [];
    }

    if (matches.length === 0) {
        const generalPattern = /\$(https?:\/\/[^"'\s]+?\.m3u8)/g;
        matches = html.match(generalPattern) || [];
    }

    // 去重
    matches = [...new Set(matches)];

    // 处理链接（去掉开头的 $ 和括号后的内容）
    return matches.map(link => {
        link = link.substring(1);
        const parenIndex = link.indexOf('(');
        return parenIndex > 0 ? link.substring(0, parenIndex) : link;
    });
}

/**
 * 从 HTML 中提取基本信息
 */
export function extractInfoFromHtml(html) {
    const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
    const titleText = titleMatch ? titleMatch[1].trim() : '';

    const descMatch = html.match(/<div[^>]*class=["']sketch["'][^>]*>([\s\S]*?)<\/div>/);
    const descText = descMatch ? descMatch[1].replace(/<[^>]+>/g, ' ').trim() : '';

    return { title: titleText, desc: descText };
}

/**
 * 搜索结果去重
 */
export function deduplicateResults(results, keyFn) {
    const unique = [];
    const seen = new Set();
    results.forEach(item => {
        const key = keyFn(item);
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(item);
        }
    });
    return unique;
}
