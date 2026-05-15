// DOM 操作封装

/**
 * 安全的元素查询，找不到时返回 null 而非报错
 */
export function $(id) {
    return document.getElementById(id);
}

/**
 * 查询单个元素
 */
export function qs(selector, parent = document) {
    return parent.querySelector(selector);
}

/**
 * 查询多个元素
 */
export function qsa(selector, parent = document) {
    return Array.from(parent.querySelectorAll(selector));
}

/**
 * 创建元素并设置属性
 */
export function createElement(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
        if (key === 'text') {
            el.textContent = value;
        } else if (key === 'html') {
            el.innerHTML = value;
        } else if (key.startsWith('on') && typeof value === 'function') {
            el.addEventListener(key.substring(2).toLowerCase(), value);
        } else {
            el.setAttribute(key, value);
        }
    });
    children.forEach(child => {
        if (typeof child === 'string') {
            el.appendChild(document.createTextNode(child));
        } else if (child instanceof Node) {
            el.appendChild(child);
        }
    });
    return el;
}

/**
 * 切换元素的显示/隐藏
 */
export function toggleDisplay(element, show) {
    if (!element) return;
    if (typeof element === 'string') {
        element = document.getElementById(element);
    }
    if (element) {
        element.classList.toggle('hidden', !show);
    }
}

/**
 * 设置元素可见性（使用 hidden 属性）
 */
export function setVisible(element, visible) {
    if (!element) return;
    if (typeof element === 'string') {
        element = document.getElementById(element);
    }
    if (element) {
        element.classList.toggle('hidden', !visible);
    }
}

/**
 * 清空元素内容
 */
export function clearElement(element) {
    if (!element) return;
    if (typeof element === 'string') {
        element = document.getElementById(element);
    }
    if (element) {
        element.innerHTML = '';
    }
}

/**
 * 添加/移除 CSS 类
 */
export function addClass(element, ...classes) {
    if (!element) return;
    element.classList.add(...classes);
}

export function removeClass(element, ...classes) {
    if (!element) return;
    element.classList.remove(...classes);
}

/**
 * 委托事件监听
 */
export function delegate(parent, selector, eventType, handler) {
    if (typeof parent === 'string') {
        parent = document.getElementById(parent);
    }
    if (!parent) return;
    parent.addEventListener(eventType, (e) => {
        const target = e.target.closest(selector);
        if (target && parent.contains(target)) {
            handler.call(target, e, target);
        }
    });
}
