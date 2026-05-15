// 视频源 API - 搜索、详情、聚合搜索

import { API_SITES, API_CONFIG, CUSTOM_API_CONFIG, AGGREGATED_SEARCH_CONFIG } from '../core/config.js';
import { fetchJson, fetchText } from './client.js';
import {
    formatSearchResults,
    extractEpisodes,
    buildDetailResponse,
    buildErrorResponse,
    extractM3u8FromHtml,
    extractInfoFromHtml,
    deduplicateResults
} from './parser.js';

/**
 * 搜索视频
 * @param {string} query - 搜索关键词
 * @param {string} source - 源代码
 * @param {string} [customApi] - 自定义API地址
 */
export async function search(query, source, customApi = '') {
    try {
        if (!query) throw new Error('缺少搜索参数');
        if (source === 'custom' && !customApi) throw new Error('使用自定义API时必须提供API地址');
        if (!API_SITES[source] && source !== 'custom') throw new Error('无效的API来源');

        const apiUrl = customApi
            ? `${customApi}${API_CONFIG.search.path}${encodeURIComponent(query)}`
            : `${API_SITES[source].api}${API_CONFIG.search.path}${encodeURIComponent(query)}`;

        const data = await fetchJson(apiUrl, { headers: API_CONFIG.search.headers });

        if (!data || !Array.isArray(data.list)) {
            throw new Error('API返回的数据格式无效');
        }

        const sourceName = source === 'custom' ? '自定义源' : API_SITES[source].name;
        const results = formatSearchResults(data.list, source, sourceName, customApi || null);

        return { code: 200, list: results };
    } catch (error) {
        console.error('搜索失败:', error);
        return buildErrorResponse(error.message);
    }
}

/**
 * 获取视频详情
 * @param {string} id - 视频ID
 * @param {string} source - 源代码
 * @param {string} [customApi] - 自定义API地址
 * @param {string} [customDetail] - 自定义详情地址
 */
export async function getDetail(id, source, customApi = '', customDetail = '') {
    try {
        if (!id) throw new Error('缺少视频ID参数');
        if (!/^[\w-]+$/.test(id)) throw new Error('无效的视频ID格式');
        if (source === 'custom' && !customApi) throw new Error('使用自定义API时必须提供API地址');
        if (!API_SITES[source] && source !== 'custom') throw new Error('无效的API来源');

        // 特殊源处理（有 detail 字段的源）
        if (source !== 'custom' && API_SITES[source]?.detail) {
            return await fetchSpecialSourceDetail(id, source);
        }

        // 自定义API且有 detail 参数
        if (source === 'custom' && customDetail) {
            return await fetchCustomApiDetail(id, customDetail);
        }

        // 标准详情请求
        const detailUrl = customApi
            ? `${customApi}${API_CONFIG.detail.path}${id}`
            : `${API_SITES[source].api}${API_CONFIG.detail.path}${id}`;

        const data = await fetchJson(detailUrl, { headers: API_CONFIG.detail.headers });

        if (!data || !data.list || !Array.isArray(data.list) || data.list.length === 0) {
            throw new Error('获取到的详情内容无效');
        }

        const videoDetail = data.list[0];
        const episodes = extractEpisodes(videoDetail);
        const sourceName = source === 'custom' ? '自定义源' : API_SITES[source].name;

        return buildDetailResponse(episodes, detailUrl, {
            title: videoDetail.vod_name,
            cover: videoDetail.vod_pic,
            desc: videoDetail.vod_content,
            type: videoDetail.type_name,
            year: videoDetail.vod_year,
            area: videoDetail.vod_area,
            director: videoDetail.vod_director,
            actor: videoDetail.vod_actor,
            remarks: videoDetail.vod_remarks,
            source_name: sourceName,
            source_code: source
        });
    } catch (error) {
        console.error('详情获取失败:', error);
        return buildErrorResponse(error.message);
    }
}

/**
 * 聚合搜索（所有内置源）
 */
export async function aggregatedSearch(query) {
    const availableSources = Object.keys(API_SITES).filter(
        key => key !== 'aggregated' && key !== 'custom'
    );

    if (availableSources.length === 0) {
        return buildErrorResponse('没有可用的API源');
    }

    const searchPromises = availableSources.map(async source => {
        try {
            const result = await search(query, source);
            return result.code === 200 ? result.list : [];
        } catch (error) {
            console.warn(`${source}源搜索失败:`, error);
            return [];
        }
    });

    try {
        const resultsArray = await Promise.all(searchPromises);
        let allResults = [];
        resultsArray.forEach(list => {
            if (Array.isArray(list) && list.length > 0) {
                allResults = allResults.concat(list);
            }
        });

        if (allResults.length === 0) {
            return { code: 200, list: [], msg: '所有源均无搜索结果' };
        }

        const unique = deduplicateResults(allResults, item => `${item.source_code}_${item.vod_id}`);

        unique.sort((a, b) => {
            const nameCompare = (a.vod_name || '').localeCompare(b.vod_name || '');
            if (nameCompare !== 0) return nameCompare;
            return (a.source_name || '').localeCompare(b.source_name || '');
        });

        return { code: 200, list: unique };
    } catch (error) {
        console.error('聚合搜索处理错误:', error);
        return buildErrorResponse('聚合搜索处理失败: ' + error.message);
    }
}

/**
 * 多个自定义API聚合搜索
 */
export async function customAggregatedSearch(query, customApiUrls) {
    const apiUrls = customApiUrls.split(CUSTOM_API_CONFIG.separator)
        .map(url => url.trim())
        .filter(url => url.length > 0 && /^https?:\/\//.test(url))
        .slice(0, CUSTOM_API_CONFIG.maxSources);

    if (apiUrls.length === 0) {
        return buildErrorResponse('没有提供有效的自定义API地址');
    }

    const searchPromises = apiUrls.map(async (apiUrl, index) => {
        try {
            const result = await search(query, 'custom', apiUrl);
            if (result.code === 200) {
                return result.list.map(item => ({
                    ...item,
                    source_name: `${CUSTOM_API_CONFIG.namePrefix}${index + 1}`,
                    source_code: 'custom',
                    api_url: apiUrl
                }));
            }
            return [];
        } catch (error) {
            console.warn(`自定义API ${index + 1} 搜索失败:`, error);
            return [];
        }
    });

    try {
        const resultsArray = await Promise.all(searchPromises);
        let allResults = [];
        resultsArray.forEach(list => {
            if (Array.isArray(list) && list.length > 0) {
                allResults = allResults.concat(list);
            }
        });

        if (allResults.length === 0) {
            return { code: 200, list: [], msg: '所有自定义API源均无搜索结果' };
        }

        const unique = deduplicateResults(allResults, item => `${item.api_url || ''}_${item.vod_id}`);
        return { code: 200, list: unique };
    } catch (error) {
        console.error('自定义API聚合搜索处理错误:', error);
        return buildErrorResponse('自定义API聚合搜索处理失败: ' + error.message);
    }
}

/**
 * 获取特殊源详情（从 HTML 页面抓取）
 */
async function fetchSpecialSourceDetail(id, sourceCode) {
    const detailUrl = `${API_SITES[sourceCode].detail}/index.php/vod/detail/id/${id}.html`;
    const html = await fetchText(detailUrl, {
        headers: { 'User-Agent': API_CONFIG.detail.headers['User-Agent'] }
    });

    const episodes = extractM3u8FromHtml(html, sourceCode);
    const info = extractInfoFromHtml(html);

    return buildDetailResponse(episodes, detailUrl, {
        title: info.title,
        desc: info.desc,
        source_name: API_SITES[sourceCode].name,
        source_code: sourceCode
    });
}

/**
 * 获取自定义API详情（从 HTML 页面抓取）
 */
async function fetchCustomApiDetail(id, customDetail) {
    const detailUrl = `${customDetail}/index.php/vod/detail/id/${id}.html`;
    const html = await fetchText(detailUrl, {
        headers: { 'User-Agent': API_CONFIG.detail.headers['User-Agent'] }
    });

    const episodes = extractM3u8FromHtml(html);
    const info = extractInfoFromHtml(html);

    return buildDetailResponse(episodes, detailUrl, {
        title: info.title,
        desc: info.desc,
        source_name: '自定义源',
        source_code: 'custom'
    });
}
