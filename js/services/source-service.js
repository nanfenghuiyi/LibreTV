// 数据源管理服务 - 内置源 + 自定义源

import { API_SITES, CUSTOM_API_CONFIG } from '../core/config.js';
import { settingsService } from './settings-service.js';
import { testSiteAvailability } from '../api/client.js';

/**
 * 获取所有可用源（内置 + 自定义）
 */
export function getAllSources() {
    const builtIn = Object.entries(API_SITES).map(([key, config]) => ({
        key,
        name: config.name,
        url: config.api,
        detail: config.detail || null,
        adult: config.adult || false,
        isCustom: false
    }));

    const custom = settingsService.getCustomAPIs().map((api, index) => ({
        key: `custom_${index}`,
        name: api.name || `${CUSTOM_API_CONFIG.namePrefix}${index + 1}`,
        url: api.url,
        detail: api.detail || null,
        adult: api.isAdult || false,
        isCustom: true,
        index
    }));

    return [...builtIn, ...custom];
}

/**
 * 获取选中的源
 */
export function getSelectedSources() {
    const selectedKeys = settingsService.getSelectedAPIs();
    const all = getAllSources();
    return all.filter(s => selectedKeys.includes(s.key));
}

/**
 * 获取普通源（排除成人源）
 */
export function getNormalSources() {
    return getAllSources().filter(s => !s.adult);
}

/**
 * 获取成人源
 */
export function getAdultSources() {
    return getAllSources().filter(s => s.adult);
}

/**
 * 切换源的选中状态
 */
export function toggleSource(key, selected) {
    const current = settingsService.getSelectedAPIs();
    if (selected) {
        if (!current.includes(key)) {
            current.push(key);
        }
    } else {
        const index = current.indexOf(key);
        if (index !== -1) current.splice(index, 1);
    }
    settingsService.setSelectedAPIs(current);
    return current;
}

/**
 * 全选/全不选
 */
export function selectAllSources(selected, onlyNormal = false) {
    const sources = onlyNormal ? getNormalSources() : getAllSources();
    const keys = sources.map(s => s.key);
    if (selected) {
        const current = settingsService.getSelectedAPIs();
        const merged = [...new Set([...current, ...keys])];
        settingsService.setSelectedAPIs(merged);
        return merged;
    } else {
        const current = settingsService.getSelectedAPIs();
        const filtered = current.filter(k => !keys.includes(k));
        settingsService.setSelectedAPIs(filtered);
        return filtered;
    }
}

/**
 * 添加自定义源
 */
export function addCustomSource(name, url, detail = '', isAdult = false) {
    const apis = settingsService.getCustomAPIs();
    if (apis.length >= CUSTOM_API_CONFIG.maxSources) {
        throw new Error(`最多允许 ${CUSTOM_API_CONFIG.maxSources} 个自定义源`);
    }
    apis.push({ name, url, detail, isAdult, selected: true });
    settingsService.updateCustomAPIs(apis);
    return apis;
}

/**
 * 删除自定义源
 */
export function removeCustomSource(index) {
    const apis = settingsService.getCustomAPIs();
    apis.splice(index, 1);
    settingsService.updateCustomAPIs(apis);

    // 同时从选中列表中移除
    const selected = settingsService.getSelectedAPIs();
    const filtered = selected.filter(k => k !== `custom_${index}`);
    settingsService.setSelectedAPIs(filtered);

    return apis;
}

/**
 * 测试源可用性
 */
export async function testSource(url) {
    return await testSiteAvailability(url);
}

/**
 * 通过 key 获取源信息
 */
export function getSourceByKey(key) {
    if (key.startsWith('custom_')) {
        const index = parseInt(key.replace('custom_', ''), 10);
        const apis = settingsService.getCustomAPIs();
        return apis[index] || null;
    }
    return API_SITES[key] || null;
}

export const sourceService = {
    getAllSources,
    getSelectedSources,
    getNormalSources,
    getAdultSources,
    toggleSource,
    selectAllSources,
    addCustomSource,
    removeCustomSource,
    testSource,
    getSourceByKey
};
