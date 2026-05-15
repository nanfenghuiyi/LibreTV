// 共享代理核心逻辑（Express 和 Vercel 共用）

import crypto from 'crypto';
import { serverConfig, logDebug } from './config.mjs';

/**
 * 计算 SHA-256 哈希
 */
export function sha256Hash(input) {
    return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * 验证 URL 是否合法
 */
export function isValidUrl(urlString) {
    try {
        const parsed = new URL(urlString);
        const allowedProtocols = ['http:', 'https:'];

        if (!allowedProtocols.includes(parsed.protocol)) return false;
        if (serverConfig.blockedHosts.includes(parsed.hostname)) return false;

        for (const prefix of serverConfig.blockedPrefixes) {
            if (parsed.hostname.startsWith(prefix)) return false;
        }

        return true;
    } catch {
        return false;
    }
}

/**
 * 验证代理请求鉴权
 */
export function validateProxyAuth(authHash, serverPasswordHash, timestamp) {
    if (!authHash || !serverPasswordHash) {
        return false;
    }

    if (authHash !== serverPasswordHash) {
        return false;
    }

    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10 分钟

    if (timestamp && (now - parseInt(timestamp)) > maxAge) {
        logDebug('代理请求时间戳过期');
        return false;
    }

    return true;
}

/**
 * 获取服务器密码哈希
 */
export function getServerPasswordHash() {
    const password = serverConfig.password;
    if (!password) return null;
    return sha256Hash(password);
}

/**
 * 过滤敏感响应头
 */
export function filterSensitiveHeaders(headers) {
    const result = { ...headers };
    serverConfig.filteredHeaders.forEach(header => {
        delete result[header];
    });
    return result;
}
