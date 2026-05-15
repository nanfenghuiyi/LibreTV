// 观看历史列表渲染器

import { escapeHtml, formatTime } from '../../core/utils.js';
import { clearElement, $ } from '../../core/dom.js';

/**
 * 渲染观看历史列表
 * @param {Array} history - 历史记录数组
 * @param {string} containerId - 容器ID
 * @param {Function} onClear - 清空回调
 * @param {Function} onItemClick - 点击条目回调
 */
export function renderHistoryList(history, containerId = 'historyList', onClear = null, onItemClick = null) {
    const container = $(containerId);
    if (!container) return;

    if (!history || history.length === 0) {
        container.innerHTML = `
            <div class="text-center text-gray-500 py-8">
                <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <p>暂无观看记录</p>
            </div>
        `;
        return;
    }

    const html = history.map((item, index) => `
        <div class="history-item flex items-center gap-3 p-3 bg-[#1a1a1a] rounded-lg mb-2 cursor-pointer hover:bg-[#222] transition-colors"
             data-index="${index}"
             data-id="${escapeHtml(item.id || '')}"
             data-source="${escapeHtml(item.source || '')}">
            <div class="w-16 h-10 bg-[#222] rounded flex-shrink-0 overflow-hidden">
                ${item.cover
                    ? `<img src="${escapeHtml(item.cover)}" alt="" class="w-full h-full object-cover" loading="lazy">`
                    : `<div class="w-full h-full flex items-center justify-center text-gray-600">
                         <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                         </svg>
                       </div>`}
            </div>
            <div class="flex-1 min-w-0">
                <h4 class="text-sm text-white truncate">${escapeHtml(item.title || '未知视频')}</h4>
                <p class="text-xs text-gray-500">
                    ${item.episodeName ? `看到 ${escapeHtml(item.episodeName)} · ` : ''}
                    ${formatTime(item.timestamp)}
                </p>
            </div>
        </div>
    `).join('');

    container.innerHTML = html;

    // 绑定点击事件
    if (onItemClick) {
        container.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('click', () => {
                const index = parseInt(item.dataset.index, 10);
                onItemClick(history[index], index);
            });
        });
    }
}
