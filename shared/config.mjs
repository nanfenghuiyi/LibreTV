// 服务端共享配置

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载环境变量（仅在 Node 环境）
if (typeof process !== 'undefined') {
    dotenv.config();
}

export const serverConfig = {
    port: parseInt(process.env.PORT || '8080', 10),
    password: process.env.PASSWORD || '111111',
    corsOrigin: process.env.CORS_ORIGIN || '*',
    timeout: parseInt(process.env.REQUEST_TIMEOUT || '5000', 10),
    maxRetries: parseInt(process.env.MAX_RETRIES || '2', 10),
    cacheMaxAge: process.env.CACHE_MAX_AGE || '1d',
    debug: process.env.DEBUG === 'true',
    userAgent: process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    blockedHosts: (process.env.BLOCKED_HOSTS || 'localhost,127.0.0.1,0.0.0.0,::1').split(','),
    blockedPrefixes: (process.env.BLOCKED_IP_PREFIXES || '192.168.,10.,172.').split(','),
    filteredHeaders: (process.env.FILTERED_HEADERS || 'content-security-policy,cookie,set-cookie,x-frame-options,access-control-allow-origin').split(',')
};

export function logDebug(...args) {
    if (serverConfig.debug) {
        console.log('[DEBUG]', ...args);
    }
}
