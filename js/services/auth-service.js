// 认证服务 - 密码验证与代理鉴权管理

import { PASSWORD_CONFIG } from '../core/config.js';
import { storage } from '../core/storage.js';
import { StorageKeys } from '../core/constants.js';
import { eventBus } from '../core/events.js';

/**
 * 检查是否启用了密码保护
 */
export function isPasswordProtected() {
    return !!(window.__ENV__?.PASSWORD || storage.get(StorageKeys.USER_PASSWORD));
}

/**
 * 检查当前是否已通过密码验证
 */
export function isPasswordVerified() {
    const verified = storage.get(StorageKeys.PASSWORD_VERIFIED);
    if (!verified) return false;

    const timestamp = storage.get('passwordVerifiedTime');
    if (timestamp) {
        const now = Date.now();
        if (now - timestamp > PASSWORD_CONFIG.verificationTTL) {
            // 验证已过期
            clearPasswordVerification();
            return false;
        }
    }
    return true;
}

/**
 * 验证密码
 * @param {string} password - 用户输入的密码
 */
export async function verifyPassword(password) {
    if (!password) return false;

    // 获取服务器端密码哈希
    const serverHash = window.__ENV__?.PASSWORD;
    if (!serverHash) return true; // 未设置密码则直接通过

    // 计算输入密码的哈希
    let inputHash = '';
    if (window._jsSha256) {
        inputHash = window._jsSha256(password);
    } else if (window.sha256) {
        inputHash = window.sha256(password);
    }

    if (inputHash === serverHash) {
        storage.set(StorageKeys.PASSWORD_VERIFIED, true);
        storage.set('passwordVerifiedTime', Date.now());
        storage.set(StorageKeys.PASSWORD_HASH, inputHash);
        storage.set(StorageKeys.PROXY_AUTH_HASH, inputHash);
        storage.set(StorageKeys.USER_PASSWORD, password);
        return true;
    }
    return false;
}

/**
 * 清除密码验证状态
 */
export function clearPasswordVerification() {
    storage.remove(StorageKeys.PASSWORD_VERIFIED);
    storage.remove('passwordVerifiedTime');
    storage.remove(StorageKeys.PASSWORD_HASH);
    storage.remove(StorageKeys.PROXY_AUTH_HASH);
    storage.remove(StorageKeys.USER_PASSWORD);
}

/**
 * 确保已验证（用于需要保护的页面或操作）
 */
export function ensurePasswordProtection() {
    if (isPasswordProtected() && !isPasswordVerified()) {
        eventBus.emit('auth:required');
        return false;
    }
    return true;
}
