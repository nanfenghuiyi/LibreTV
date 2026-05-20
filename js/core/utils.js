// 纯工具函数，无副作用

/**
 * HTML 转义，防止 XSS
 */
export function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * 节流函数
 */
export function throttle(fn, delay) {
    let lastTime = 0;
    return function (...args) {
        const now = Date.now();
        if (now - lastTime >= delay) {
            lastTime = now;
            fn.apply(this, args);
        }
    };
}

/**
 * 防抖函数
 */
export function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

/**
 * 深拷贝（简单对象）
 */
export function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (Array.isArray(obj)) return obj.map(item => deepClone(item));
    const cloned = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            cloned[key] = deepClone(obj[key]);
        }
    }
    return cloned;
}

/**
 * 格式化时间戳为本地时间字符串
 */
export function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN');
}

/**
 * 将秒数格式化为 mm:ss 或 hh:mm:ss
 */
export function formatDuration(seconds) {
    if (seconds == null || isNaN(seconds) || seconds < 0) return '';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const parts = [];
    if (h > 0) parts.push(String(h).padStart(2, '0'));
    parts.push(String(m).padStart(2, '0'));
    parts.push(String(s).padStart(2, '0'));
    return parts.join(':');
}

/**
 * 安全的 URL 拼接
 */
export function buildUrl(base, params) {
    const url = new URL(base, window.location.origin);
    Object.entries(params).forEach(([key, value]) => {
        if (value != null) {
            url.searchParams.set(key, String(value));
        }
    });
    return url.toString();
}

/**
 * 生成唯一 ID
 */
export function generateId() {
    return Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15);
}

/**
 * 等待指定毫秒
 */
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 带超时的 Promise
 */
const BASE58_CHARS = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/**
 * Base58 解码
 */
export function base58Decode(input) {
    let result = new Uint8Array(0);
    for (let i = 0; i < input.length; i++) {
        const charIndex = BASE58_CHARS.indexOf(input[i]);
        if (charIndex === -1) {
            throw new Error('Invalid Base58 character: ' + input[i]);
        }
        let carry = charIndex;
        for (let j = 0; j < result.length; j++) {
            carry += result[j] * 58;
            result[j] = carry & 0xff;
            carry >>= 8;
        }
        while (carry > 0) {
            result = new Uint8Array([...result, carry & 0xff]);
            carry >>= 8;
        }
    }
    for (let i = 0; i < input.length && input[i] === BASE58_CHARS[0]; i++) {
        result = new Uint8Array([0, ...result]);
    }
    result = new Uint8Array([...result].reverse());
    return new TextDecoder().decode(result);
}

export function withTimeout(promise, ms, errorMessage = '操作超时') {
    const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(errorMessage)), ms)
    );
    return Promise.race([promise, timeout]);
}
