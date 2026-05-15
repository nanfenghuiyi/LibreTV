// 设置服务 - 管理用户配置、API 选择、开关状态

import { storage } from '../core/storage.js';
import { StorageKeys } from '../core/constants.js';
import { DEFAULT_SELECTED_APIS, PLAYER_CONFIG } from '../core/config.js';
import { eventBus } from '../core/events.js';
import { Events } from '../core/constants.js';

const DEFAULTS = {
    [StorageKeys.SELECTED_APIS]: DEFAULT_SELECTED_APIS,
    [StorageKeys.CUSTOM_APIS]: [],
    [StorageKeys.YELLOW_FILTER_ENABLED]: true,
    [StorageKeys.DOUBAN_ENABLED]: true,
    [StorageKeys.SEARCH_SORT_ORDER]: 'name_asc',
    [StorageKeys.AUTOPLAY_ENABLED]: true,
    [StorageKeys.EPISODES_REVERSED]: false,
    [PLAYER_CONFIG.adFilteringStorage]: true
};

/**
 * 初始化默认设置（首次访问）
 */
export function initializeDefaults() {
    if (storage.get(StorageKeys.HAS_INITIALIZED_DEFAULTS)) return;

    storage.set(StorageKeys.SELECTED_APIS, DEFAULT_SELECTED_APIS);
    storage.set(StorageKeys.YELLOW_FILTER_ENABLED, true);
    storage.set(PLAYER_CONFIG.adFilteringStorage, true);
    storage.set(StorageKeys.DOUBAN_ENABLED, true);
    storage.set(StorageKeys.HAS_INITIALIZED_DEFAULTS, true);
}

/**
 * 获取设置值
 */
export function getSetting(key, defaultValue = null) {
    const value = storage.get(key);
    return value !== null ? value : (defaultValue ?? DEFAULTS[key] ?? null);
}

/**
 * 设置值
 */
export function setSetting(key, value) {
    storage.set(key, value);
    eventBus.emit(Events.SETTINGS_CHANGED, { key, value });
}

/**
 * 获取选中的 API 列表
 */
export function getSelectedAPIs() {
    return getSetting(StorageKeys.SELECTED_APIS, DEFAULT_SELECTED_APIS);
}

/**
 * 设置选中的 API 列表
 */
export function setSelectedAPIs(apis) {
    setSetting(StorageKeys.SELECTED_APIS, apis);
}

/**
 * 获取自定义 API 列表
 */
export function getCustomAPIs() {
    return getSetting(StorageKeys.CUSTOM_APIS, []);
}

/**
 * 添加自定义 API
 */
export function addCustomAPI(api) {
    const apis = getCustomAPIs();
    apis.push(api);
    setSetting(StorageKeys.CUSTOM_APIS, apis);
    return apis;
}

/**
 * 删除自定义 API
 */
export function removeCustomAPI(index) {
    const apis = getCustomAPIs();
    apis.splice(index, 1);
    setSetting(StorageKeys.CUSTOM_APIS, apis);
    return apis;
}

/**
 * 更新自定义 API
 */
export function updateCustomAPIs(apis) {
    setSetting(StorageKeys.CUSTOM_APIS, apis);
}

/**
 * 获取黄色过滤开关状态
 */
export function isYellowFilterEnabled() {
    return getSetting(StorageKeys.YELLOW_FILTER_ENABLED, true);
}

/**
 * 设置黄色过滤开关
 */
export function setYellowFilterEnabled(enabled) {
    setSetting(StorageKeys.YELLOW_FILTER_ENABLED, enabled);
}

/**
 * 获取豆瓣开关状态
 */
export function isDoubanEnabled() {
    return getSetting(StorageKeys.DOUBAN_ENABLED, true);
}

/**
 * 获取广告过滤开关状态
 */
export function isAdFilteringEnabled() {
    return getSetting(PLAYER_CONFIG.adFilteringStorage, true);
}

/**
 * 获取搜索排序方式
 */
export function getSearchSortOrder() {
    return getSetting(StorageKeys.SEARCH_SORT_ORDER, 'name_asc');
}

/**
 * 设置搜索排序方式
 */
export function setSearchSortOrder(order) {
    setSetting(StorageKeys.SEARCH_SORT_ORDER, order);
}

/**
 * 导出所有配置
 */
export function exportSettings() {
    return storage.exportAll();
}

/**
 * 导入配置
 */
export function importSettings(data) {
    storage.importAll(data);
    eventBus.emit(Events.SETTINGS_CHANGED, { imported: true });
}

/**
 * 清除所有设置
 */
export function clearAllSettings() {
    storage.clear();
}

// 聚合导出对象（兼容命名空间导入风格）
export const settingsService = {
    initializeDefaults,
    getSetting,
    setSetting,
    getSelectedAPIs,
    setSelectedAPIs,
    getCustomAPIs,
    addCustomAPI,
    removeCustomAPI,
    updateCustomAPIs,
    isYellowFilterEnabled,
    setYellowFilterEnabled,
    isDoubanEnabled,
    isAdFilteringEnabled,
    getSearchSortOrder,
    setSearchSortOrder,
    exportSettings,
    importSettings,
    clearAllSettings
};
