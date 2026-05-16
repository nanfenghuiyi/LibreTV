// 通用弹窗组件

import { $ } from '../../core/dom.js';

/**
 * 打开弹窗
 * @param {string} id - 弹窗元素ID
 */
export function openModal(id) {
    const modal = $(id);
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';
}

/**
 * 关闭弹窗
 * @param {string} id - 弹窗元素ID
 */
export function closeModal(id) {
    const modal = $(id);
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.style.overflow = '';
}

/**
 * 设置弹窗标题
 */
export function setModalTitle(title) {
    const el = $('modalTitle');
    if (el) el.innerHTML = title;
}

/**
 * 设置弹窗内容（安全HTML）
 */
export function setModalContent(html) {
    const el = $('modalContent');
    if (el) el.innerHTML = html;
}

/**
 * 点击弹窗外部关闭
 */
export function setupModalBackdrop(modalId, closeFn) {
    const modal = $(modalId);
    if (!modal) return;
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeFn();
    });
}
