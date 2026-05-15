// localStorage 统一封装，带命名空间和旧数据迁移

import { StorageKeys } from './constants.js';

const PREFIX = 'ltv:';

// 旧版 key 到新版 key 的映射（用于数据迁移）
const LEGACY_KEYS = Object.values(StorageKeys);

function getFullKey(key) {
    return PREFIX + key;
}

function tryMigrateLegacy(key) {
    // 如果新版 key 不存在，尝试读取旧版 key
    const fullKey = getFullKey(key);
    if (localStorage.getItem(fullKey) !== null) return;

    const legacyValue = localStorage.getItem(key);
    if (legacyValue !== null) {
        localStorage.setItem(fullKey, legacyValue);
    }
}

export const storage = {
    get(key, defaultValue = null) {
        tryMigrateLegacy(key);
        try {
            const raw = localStorage.getItem(getFullKey(key));
            if (raw === null) return defaultValue;
            // 尝试解析 JSON，失败则返回原始字符串
            try {
                return JSON.parse(raw);
            } catch {
                return raw;
            }
        } catch {
            return defaultValue;
        }
    },

    set(key, value) {
        try {
            localStorage.setItem(getFullKey(key), JSON.stringify(value));
        } catch (e) {
            console.error('Storage set error:', e);
        }
    },

    remove(key) {
        localStorage.removeItem(getFullKey(key));
        // 同时清理旧版 key
        localStorage.removeItem(key);
    },

    clear() {
        Object.keys(localStorage)
            .filter(k => k.startsWith(PREFIX))
            .forEach(k => localStorage.removeItem(k));
    },

    // 一次性导出所有配置（用于配置导出功能）
    exportAll() {
        const data = {};
        Object.values(StorageKeys).forEach(key => {
            const value = this.get(key);
            if (value !== null) {
                data[key] = value;
            }
        });
        return data;
    },

    // 一次性导入配置
    importAll(data) {
        Object.entries(data).forEach(([key, value]) => {
            if (Object.values(StorageKeys).includes(key)) {
                this.set(key, value);
            }
        });
    }
};
