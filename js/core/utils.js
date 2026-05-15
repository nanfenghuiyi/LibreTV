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
export function withTimeout(promise, ms, errorMessage = '操作超时') {
    const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(errorMessage)), ms)
    );
    return Promise.race([promise, timeout]);
}
