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
        const hasCover = item.vod_pic && item.vod_pic.startsWith('http');
        const apiUrlAttr = item.api_url
            ? `data-api-url="${escapeHtml(item.api_url)}"` : '';
        const sourceInfo = item.source_name
            ? `<span class="bg-[#222] text-xs px-1.5 py-0.5 rounded-full">${escapeHtml(item.source_name)}</span>` : '';

        return `
            <div class="card-hover bg-[#111] rounded-lg overflow-hidden cursor-pointer transition-all hover:scale-[1.02] h-full shadow-sm hover:shadow-md"
                 data-vod-id="${escapeHtml(item.vod_id)}"
                 data-source="${escapeHtml(item.source_code || '')}"
                 ${apiUrlAttr}
                 onclick="var d=this.dataset;d.vodId&amp;&amp;LibreTV.openDetail(d.vodId,d.source)">
                <div class="flex h-full">
                    ${hasCover ? `
                    <div class="relative flex-shrink-0 search-card-img-container">
                        <img src="${escapeHtml(item.vod_pic)}" alt="${escapeHtml(item.vod_name)}"
                             class="h-full w-full object-cover transition-transform hover:scale-110"
                             onerror="this.onerror=null; this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22450%22><rect fill=%22%231a1a1a%22 width=%22300%22 height=%22450%22/><text fill=%22%23555%22 x=%22150%22 y=%22225%22 text-anchor=%22middle%22 font-size=%2216%22>无封面</text></svg>'; this.classList.add('object-contain');"
                             loading="lazy">
                        <div class="absolute inset-0 bg-gradient-to-r from-black/30 to-transparent"></div>
                    </div>` : ''}
                    <div class="p-2 flex flex-col flex-grow">
                        <div class="flex-grow">
                            <h3 class="font-semibold mb-2 break-words line-clamp-2 ${hasCover ? '' : 'text-center'}" title="${escapeHtml(item.vod_name)}">${escapeHtml(item.vod_name)}</h3>
                            <div class="flex flex-wrap ${hasCover ? '' : 'justify-center'} gap-1 mb-2">
                                ${item.type_name
                                    ? `<span class="text-xs py-0.5 px-1.5 rounded bg-opacity-20 bg-blue-500 text-blue-300">${escapeHtml(item.type_name)}</span>`
                                    : ''}
                                ${item.vod_year
                                    ? `<span class="text-xs py-0.5 px-1.5 rounded bg-opacity-20 bg-purple-500 text-purple-300">${escapeHtml(item.vod_year)}</span>`
                                    : ''}
                            </div>
                            <p class="text-gray-400 line-clamp-2 overflow-hidden ${hasCover ? '' : 'text-center'} mb-2">
                                ${escapeHtml(item.vod_remarks || '暂无介绍')}
                            </p>
                        </div>
                        <div class="flex justify-between items-center mt-1 pt-1 border-t border-gray-800">
                            ${sourceInfo ? `<div>${sourceInfo}</div>` : '<div></div>'}
                        </div>
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
