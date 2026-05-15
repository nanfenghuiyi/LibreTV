// 通用 HTTP 客户端，处理代理、鉴权和超时

import { PROXY_URL, API_CONFIG } from '../core/config.js';
import { withTimeout } from '../core/utils.js';
import { storage } from '../core/storage.js';
import { StorageKeys } from '../core/constants.js';

/**
 * 获取密码哈希用于代理鉴权
 */
async function getAuthHash() {
    // 优先从全局 ProxyAuth 获取
    if (window.ProxyAuth?.getPasswordHash) {
        return await window.ProxyAuth.getPasswordHash();
    }
    // 尝试从 storage 获取（支持 ltv: 前缀和旧版 key 迁移）
    const hash = storage.get(StorageKeys.PROXY_AUTH_HASH) || storage.get(StorageKeys.PASSWORD_HASH);
    if (hash) return hash;
    // 尝试从环境变量获取
    if (window.__ENV__?.PASSWORD) return window.__ENV__.PASSWORD;
    return null;
}

/**
 * 为代理 URL 添加鉴权参数
 */
async function addAuthToProxyUrl(url) {
    const hash = await getAuthHash();
    if (!hash) {
        console.warn('无法获取密码哈希，代理请求可能失败');
        return url;
    }
    const timestamp = Date.now();
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}auth=${encodeURIComponent(hash)}&t=${timestamp}`;
}

/**
 * 发送经过代理的请求
 * @param {string} targetUrl - 目标 API URL
 * @param {Object} options - fetch 选项
 * @param {number} timeoutMs - 超时毫秒
 */
export async function proxyFetch(targetUrl, options = {}, timeoutMs = 10000) {
    const proxiedUrl = await addAuthToProxyUrl(PROXY_URL + encodeURIComponent(targetUrl));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(proxiedUrl, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`请求失败: ${response.status}`);
        }

        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

/**
 * 获取 JSON 数据
 */
export async function fetchJson(targetUrl, options = {}, timeoutMs = 10000) {
    const response = await proxyFetch(targetUrl, {
        headers: {
            'Accept': 'application/json',
            ...options.headers
        },
        ...options
    }, timeoutMs);

    const text = await response.text();
    try {
        return JSON.parse(text);
    } catch {
        // API 返回了非 JSON 数据（如 "暂不支持搜索"）
        throw new Error(`API 返回非 JSON: ${text.substring(0, 100)}`);
    }
}

/**
 * 获取文本数据
 */
export async function fetchText(targetUrl, options = {}, timeoutMs = 10000) {
    const response = await proxyFetch(targetUrl, options, timeoutMs);
    return response.text();
}

/**
 * 测试站点可用性
 */
export async function testSiteAvailability(apiUrl) {
    try {
        const testUrl = `${apiUrl}${API_CONFIG.search.path}test`;
        const data = await withTimeout(
            fetchJson(testUrl, {}, 5000),
            5000,
            '站点测试超时'
        );
        return data && data.code !== 400 && Array.isArray(data.list);
    } catch {
        return false;
    }
}
