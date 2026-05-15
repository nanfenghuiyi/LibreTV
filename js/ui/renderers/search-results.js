// 搜索结果渲染器

import { escapeHtml } from '../../core/utils.js';
import { clearElement, $ } from '../../core/dom.js';

/**
 * 渲染搜索结果卡片
 */
export function renderSearchResults(results, containerId = 'results') {
    const container = $(containerId);
    if (!container) return;

    if (!results || results.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center text-gray-500 py-12">
                <p class="text-lg">未找到相关视频</p>
                <p class="text-sm mt-2">请尝试更换关键词或数据源</p>
            </div>
        `;
        return;
    }

    const html = results.map(item => {
        const hasCover = item.vod_pic && !item.vod_pic.includes('noimage');
        const sourceInfo = item.source_name
            ? `<span class="text-xs px-2 py-0.5 rounded bg-[#222] text-gray-400 border border-[#333]">${escapeHtml(item.source_name)}</span>`
            : '';

        return `
            <div class="bg-[#111] border border-[#333] rounded-lg overflow-hidden hover:border-white transition-all duration-300 cursor-pointer group"
                 data-vod-id="${escapeHtml(item.vod_id)}"
                 data-source="${escapeHtml(item.source_code || '')}">
                <div class="relative aspect-[2/3] overflow-hidden bg-[#1a1a1a]">
                    ${hasCover
                        ? `<img src="${escapeHtml(item.vod_pic)}" alt="${escapeHtml(item.vod_name)}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy">`
                        : `<div class="w-full h-full flex items-center justify-center text-gray-600">
                             <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                                      d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                             </svg>
                           </div>`}
                    ${item.vod_remarks
                        ? `<div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                             <span class="text-xs text-white">${escapeHtml(item.vod_remarks)}</span>
                           </div>`
                        : ''}
                </div>
                <div class="p-3">
                    <h3 class="text-sm font-medium text-white line-clamp-2 mb-1" title="${escapeHtml(item.vod_name)}">
                        ${escapeHtml(item.vod_name)}
                    </h3>
                    <div class="flex flex-wrap gap-1 mb-2">
                        ${item.type_name
                            ? `<span class="text-xs py-0.5 px-1.5 rounded bg-opacity-20 bg-blue-500 text-blue-300">${escapeHtml(item.type_name)}</span>`
                            : ''}
                        ${item.vod_year
                            ? `<span class="text-xs py-0.5 px-1.5 rounded bg-opacity-20 bg-purple-500 text-purple-300">${escapeHtml(item.vod_year)}</span>`
                            : ''}
                    </div>
                    <div class="flex justify-between items-center pt-2 border-t border-gray-800">
                        ${sourceInfo}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

/**
 * 渲染分类筛选标签
 */
export function renderTypeFilters(types, currentFilter, containerId = 'typeFilters') {
    const container = $(containerId);
    if (!container) return;

    if (!types || types.length === 0) {
        container.classList.add('hidden');
        container.innerHTML = '';
        return;
    }

    container.classList.remove('hidden');

    const total = types.reduce((sum, t) => sum + t.count, 0);

    let html = renderFilterButton('', '全部', total, !currentFilter);
    types.forEach(type => {
        html += renderFilterButton(type.name, type.name, type.count, currentFilter === type.name);
    });

    container.innerHTML = html;
}

function renderFilterButton(value, label, count, isActive) {
    const activeClass = isActive
        ? 'bg-blue-600 text-white border-blue-600'
        : 'bg-[#222] text-gray-400 border-[#333] hover:border-gray-500 hover:text-white';
    return `
        <button data-filter="${escapeHtml(value)}"
                class="px-3 py-1 text-xs rounded-full border transition-colors ${activeClass}">
            ${escapeHtml(label)} (${count})
        </button>
    `;
}

/**
 * 更新结果计数
 */
export function updateResultsCount(count, elementId = 'searchResultsCount') {
    const el = $(elementId);
    if (el) el.textContent = count;
}
