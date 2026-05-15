// 搜索业务服务 - 聚合、排序、过滤

import { search, aggregatedSearch, customAggregatedSearch } from '../api/vod.js';
import { API_SITES, AGGREGATED_SEARCH_CONFIG } from '../core/config.js';
import { settingsService } from './settings-service.js';
import { eventBus } from '../core/events.js';
import { Events } from '../core/constants.js';

// 搜索状态
let currentQuery = '';
let currentResults = [];
let currentTypeFilter = '';

/**
 * 执行搜索
 * @param {string} query - 搜索关键词
 * @param {string} source - 指定源（可选）
 */
export async function executeSearch(query, source = null) {
    if (!query || !query.trim()) return { code: 400, list: [] };

    currentQuery = query.trim();
    eventBus.emit(Events.SEARCH_STARTED, { query: currentQuery });

    try {
        let result;

        if (source && source !== 'aggregated') {
            // 单源搜索
            result = await search(currentQuery, source);
        } else {
            // 聚合搜索：获取选中的源
            const selectedAPIs = settingsService.getSelectedAPIs();
            const customAPIs = settingsService.getCustomAPIs().filter(api => api.selected);

            const promises = [];

            // 内置源
            selectedAPIs.forEach(apiKey => {
                if (API_SITES[apiKey]) {
                    promises.push(
                        search(currentQuery, apiKey).catch(err => {
                            console.warn(`${apiKey} 搜索失败:`, err);
                            return { code: 200, list: [] };
                        })
                    );
                }
            });

            // 自定义源
            customAPIs.forEach(api => {
                promises.push(
                    search(currentQuery, 'custom', api.url).catch(err => {
                        console.warn('自定义源搜索失败:', err);
                        return { code: 200, list: [] };
                    })
                );
            });

            const results = await Promise.all(promises);
            let allList = [];
            results.forEach(r => {
                if (r.code === 200 && Array.isArray(r.list)) {
                    allList = allList.concat(r.list);
                }
            });

            result = { code: 200, list: allList };
        }

        // 过滤成人内容
        if (settingsService.isYellowFilterEnabled()) {
            result.list = result.list.filter(item => {
                const typeName = (item.type_name || '').toString();
                return !typeName.includes('伦理') && !typeName.includes('福利');
            });
        }

        currentResults = result.list;
        eventBus.emit(Events.SEARCH_COMPLETED, { query: currentQuery, results: currentResults });
        return result;
    } catch (error) {
        console.error('搜索执行失败:', error);
        eventBus.emit(Events.SEARCH_ERROR, { query: currentQuery, error });
        return { code: 400, list: [], msg: error.message };
    }
}

/**
 * 排序结果
 */
export function sortResults(results, sortOrder) {
    const sorted = [...results];
    switch (sortOrder) {
        case 'name_asc':
            sorted.sort((a, b) => (a.vod_name || '').localeCompare(b.vod_name || '', 'zh'));
            break;
        case 'name_desc':
            sorted.sort((a, b) => (b.vod_name || '').localeCompare(a.vod_name || '', 'zh'));
            break;
        case 'time_desc':
            sorted.sort((a, b) => (b.vod_time || '').localeCompare(a.vod_time || ''));
            break;
        case 'time_asc':
            sorted.sort((a, b) => (a.vod_time || '').localeCompare(b.vod_time || ''));
            break;
        case 'year_desc':
            sorted.sort((a, b) => parseInt(b.vod_year || 0) - parseInt(a.vod_year || 0));
            break;
        case 'year_asc':
            sorted.sort((a, b) => parseInt(a.vod_year || 0) - parseInt(b.vod_year || 0));
            break;
        case 'source':
            sorted.sort((a, b) => {
                const sourceCompare = (a.source_name || '').localeCompare(b.source_name || '');
                if (sourceCompare !== 0) return sourceCompare;
                return (a.vod_name || '').localeCompare(b.vod_name || '', 'zh');
            });
            break;
    }
    return sorted;
}

/**
 * 按分类筛选
 */
export function filterByType(results, typeName) {
    if (!typeName) return results;
    return results.filter(item => item.type_name === typeName);
}

/**
 * 提取所有分类（用于渲染筛选标签）
 */
export function extractTypes(results) {
    const count = {};
    results.forEach(item => {
        const type = item.type_name || '未分类';
        count[type] = (count[type] || 0) + 1;
    });
    return Object.entries(count)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, count }));
}

/**
 * 获取当前搜索结果
 */
export function getCurrentResults() {
    return currentResults;
}

/**
 * 获取当前查询词
 */
export function getCurrentQuery() {
    return currentQuery;
}

export const searchService = {
    executeSearch,
    sortResults,
    filterByType,
    extractTypes,
    getCurrentResults,
    getCurrentQuery
};
