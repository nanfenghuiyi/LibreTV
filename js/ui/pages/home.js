// 首页入口 - 整合所有新模块

import { $, delegate, toggleDisplay, setVisible, clearElement } from '../../core/dom.js';
import { eventBus } from '../../core/events.js';
import { Events, StorageKeys, DOM_IDS } from '../../core/constants.js';
import { escapeHtml, debounce, base58Decode } from '../../core/utils.js';
import { storage } from '../../core/storage.js';
import { settingsService } from '../../services/settings-service.js';
import { searchService } from '../../services/search-service.js';
import { historyService } from '../../services/history-service.js';
import { sourceService } from '../../services/source-service.js';
import { isPasswordProtected, isPasswordVerified, verifyPassword } from '../../services/auth-service.js';
import { showToast } from '../components/toast.js';
import { showLoading, hideLoading } from '../components/loading.js';
import { openModal, closeModal, setModalTitle, setModalContent, setupModalBackdrop } from '../components/modal.js';
import { showPasswordModal } from '../components/password-modal.js';
import { renderSearchResults, renderTypeFilters, updateResultsCount } from '../renderers/search-results.js';
import { renderHistoryList } from '../renderers/history-list.js';
import { fetchHot } from '../../api/douban-client.js';

// 页面状态
let currentQuery = '';
let currentTypeFilter = '';
let editingCustomApiIndex = -1;

// 挂载到 window 供内联 onclick 使用
window.LibreTV = window.LibreTV || {};
window.LibreTV.openDetail = openDetail;
window.LibreTV.toggleDetailEpisodeOrder = function() {
    window.__detailReversed = !window.__detailReversed;
    if (window.__currentDetail) {
        const { episodes, videoInfo } = window.__currentDetail;
        const reversed = window.__detailReversed;
        const sortedEpisodes = reversed ? [...episodes].reverse() : episodes;

        const items = sortedEpisodes.map((url, i) => {
            const realIndex = reversed ? episodes.length - 1 - i : i;
            return `<div class="episode-item cursor-pointer p-3 bg-[#1a1a1a] rounded hover:bg-[#222] transition-colors border border-transparent hover:border-[#444]"
                         data-index="${realIndex}" data-url="${escapeHtml(url)}">
                        <span class="text-sm text-gray-300">第 ${realIndex + 1} 集</span>
                    </div>`;
        }).join('');

        const grid = document.getElementById('episodesGrid');
        if (grid) grid.innerHTML = items;

        const orderText = document.getElementById('detailOrderText');
        const orderIcon = document.getElementById('detailOrderIcon');
        if (orderText) orderText.textContent = reversed ? '正序排列' : '倒序排列';
        if (orderIcon) orderIcon.style.transform = reversed ? 'rotate(180deg)' : '';

        // 重新绑定点击
        setTimeout(() => {
            document.querySelectorAll('.episode-item').forEach(el => {
                el.addEventListener('click', () => {
                    const idx = parseInt(el.dataset.index, 10);
                    playVideo(videoInfo.title, videoInfo.source_code || '', episodes, idx, videoInfo.id);
                });
            });
        }, 0);
    }
};
window.LibreTV.copyEpisodeLinks = function() {
    if (window.__currentDetail?.episodes) {
        const text = window.__currentDetail.episodes.join('\n');
        navigator.clipboard.writeText(text).then(() => {
            showToast('播放链接已复制到剪贴板', 'success');
        }).catch(() => {
            showToast('复制失败', 'error');
        });
    }
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    initPasswordProtection();
    initDefaults();
    initUI();
    initEventListeners();
    initDouban();
    initCustomApiForm();
    initDisclaimer();
    renderSearchHistory();
    initSearchFromUrl();
});

function initPasswordProtection() {
    if (isPasswordProtected() && !isPasswordVerified()) {
        showPasswordModal();
    }
}

function initDefaults() {
    settingsService.initializeDefaults();

    // 同步开关状态
    const yellowToggle = $('yellowFilterToggle');
    if (yellowToggle) yellowToggle.checked = settingsService.isYellowFilterEnabled();

    const adToggle = $('adFilterToggle');
    if (adToggle) adToggle.checked = settingsService.isAdFilteringEnabled();

    const doubanToggle = $('doubanToggle');
    if (doubanToggle) doubanToggle.checked = settingsService.isDoubanEnabled();

    const sortSelect = $('sortSelect');
    if (sortSelect) sortSelect.value = settingsService.getSearchSortOrder();
}

function initUI() {
    renderAPICheckboxes();
    updateSelectedCount();
    renderCustomAPIs();
    renderHistory();
}

function initEventListeners() {
    // 搜索
    const searchBtn = document.querySelector('button[aria-label="搜索按钮"]');
    if (searchBtn) searchBtn.addEventListener('click', handleSearch);

    const searchInput = $('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleSearch();
        });
        searchInput.addEventListener('input', debounce(() => {
            const clearBtn = $('clearSearchInput');
            if (clearBtn) {
                clearBtn.classList.toggle('hidden', !searchInput.value);
            }
        }, 100));
    }

    // 清空搜索
    const clearBtn = $('clearSearchInput');
    if (clearBtn) clearBtn.addEventListener('click', () => {
        const input = $('searchInput');
        if (input) {
            input.value = '';
            clearBtn.classList.add('hidden');
            input.focus();
        }
    });

    // 点击外部关闭面板
    document.addEventListener('click', (e) => {
        const settingsPanel = $('settingsPanel');
        const historyPanel = $('historyPanel');
        if (settingsPanel && !settingsPanel.contains(e.target) && !e.target.closest('button[aria-label="打开设置"]')) {
            settingsPanel.classList.remove('show');
        }
        if (historyPanel && !historyPanel.contains(e.target) && !e.target.closest('button[aria-label="观看历史"]')) {
            historyPanel.classList.add('-translate-x-full');
            historyPanel.classList.remove('translate-x-0');
        }
    });

    // 排序
    const sortSelect = $('sortSelect');
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            settingsService.setSearchSortOrder(e.target.value);
            sortAndRenderResults();
        });
    }

    // 开关
    const yellowFilterToggle = $('yellowFilterToggle');
    if (yellowFilterToggle) {
        yellowFilterToggle.addEventListener('change', (e) => {
            settingsService.setYellowFilterEnabled(e.target.checked);
        });
    }

    const adFilterToggle = $('adFilterToggle');
    if (adFilterToggle) {
        adFilterToggle.addEventListener('change', (e) => {
            settingsService.setSetting('adFilteringEnabled', e.target.checked);
        });
    }

    const doubanToggle = $('doubanToggle');
    if (doubanToggle) {
        doubanToggle.addEventListener('change', (e) => {
            settingsService.setSetting('doubanEnabled', e.target.checked);
            setVisible(DOM_IDS.DOUBAN_AREA, e.target.checked);
        });
    }

    // 弹窗关闭
    const modalCloseBtn = document.querySelector('#modal button[onclick="closeModal()"]');
    if (modalCloseBtn) {
        modalCloseBtn.removeAttribute('onclick');
        modalCloseBtn.addEventListener('click', () => closeModal('modal'));
    }
    setupModalBackdrop('modal', () => closeModal('modal'));

    // 事件总线监听
    eventBus.on(Events.SEARCH_STARTED, () => showLoading('搜索中...'));
    eventBus.on(Events.SEARCH_COMPLETED, ({ results }) => {
        hideLoading();
        currentTypeFilter = '';
        sortAndRenderResults();
    });
    eventBus.on(Events.SEARCH_ERROR, ({ error }) => {
        hideLoading();
        showToast(error.message || '搜索失败', 'error');
    });

    // 分类筛选 - 事件委托
    delegate('typeFilters', '[data-filter]', 'click', (e, target) => {
        currentTypeFilter = target.dataset.filter;
        filterAndRenderResults();
    });
}

async function handleSearch() {
    const input = $('searchInput');
    if (!input) return;
    const query = input.value.trim();
    if (!query) {
        showToast('请输入搜索关键词', 'warning');
        return;
    }

    currentQuery = query;
    addSearchHistory(query);

    // 调整搜索区域布局：从居中全屏变为顶部固定
    const searchArea = $(DOM_IDS.SEARCH_AREA);
    if (searchArea) {
        searchArea.classList.remove('flex-1', 'justify-center');
        searchArea.classList.add('mb-8');
    }

    setVisible(DOM_IDS.RESULTS_AREA, true);
    setVisible(DOM_IDS.DOUBAN_AREA, false);

    await searchService.executeSearch(query);
}

function sortAndRenderResults() {
    const results = searchService.getCurrentResults();
    const sortOrder = settingsService.getSearchSortOrder();
    let sorted = searchService.sortResults(results, sortOrder);

    if (currentTypeFilter) {
        sorted = searchService.filterByType(sorted, currentTypeFilter);
    }

    renderSearchResults(sorted);
    updateResultsCount(sorted.length);

    // 渲染分类标签
    const types = searchService.extractTypes(results);
    renderTypeFilters(types, currentTypeFilter);
}

function filterAndRenderResults() {
    sortAndRenderResults();
}

async function openDetail(vodId, source) {
    // 这里需要调用详情 API 并渲染弹窗
    showLoading('加载详情...');
    try {
        const { getDetail } = await import('../../api/vod.js');
        const data = await getDetail(vodId, source);
        hideLoading();

        if (data.code !== 200 || !data.episodes || data.episodes.length === 0) {
            showToast('未找到播放资源', 'error');
            return;
        }

        const title = data.videoInfo.title || vodId;
        const sourceName = data.videoInfo.source_name
            ? ` <span class="text-sm font-normal text-gray-400">(${escapeHtml(data.videoInfo.source_name)})</span>` : '';

        setModalTitle(`<span class="break-words">${escapeHtml(title)}</span>${sourceName}`);

        renderDetailModal(data.episodes, data.videoInfo);
        openModal('modal');
    } catch (error) {
        hideLoading();
        showToast('加载详情失败', 'error');
        console.error(error);
    }
}

function renderDetailModal(episodes, videoInfo) {
    const info = videoInfo || {};

    // 详情信息网格
    const hasGridContent = info.type || info.year || info.area || info.director || info.actor || info.remarks;
    const descText = info.desc ? info.desc.replace(/<[^>]+>/g, '').trim() : '';

    let detailHtml = '';
    if (hasGridContent || descText) {
        const gridItems = [
            info.type ? `<div class="detail-item"><span class="detail-label">类型:</span> <span class="detail-value">${escapeHtml(info.type)}</span></div>` : '',
            info.year ? `<div class="detail-item"><span class="detail-label">年份:</span> <span class="detail-value">${escapeHtml(String(info.year))}</span></div>` : '',
            info.area ? `<div class="detail-item"><span class="detail-label">地区:</span> <span class="detail-value">${escapeHtml(info.area)}</span></div>` : '',
            info.director ? `<div class="detail-item"><span class="detail-label">导演:</span> <span class="detail-value">${escapeHtml(info.director)}</span></div>` : '',
            info.actor ? `<div class="detail-item"><span class="detail-label">主演:</span> <span class="detail-value">${escapeHtml(info.actor)}</span></div>` : '',
            info.remarks ? `<div class="detail-item"><span class="detail-label">备注:</span> <span class="detail-value">${escapeHtml(info.remarks)}</span></div>` : ''
        ].filter(Boolean).join('');

        detailHtml = `
            <div class="modal-detail-info">
                ${hasGridContent ? `<div class="detail-grid">${gridItems}</div>` : ''}
                ${descText ? `<div class="detail-desc"><p class="detail-label">简介:</p><p class="detail-desc-content">${escapeHtml(descText)}</p></div>` : ''}
            </div>`;
    }

    // 集数按钮
    const episodeItems = episodes.map((url, index) => `
        <div class="episode-item cursor-pointer p-3 bg-[#1a1a1a] rounded hover:bg-[#222] transition-colors border border-transparent hover:border-[#444]"
             data-index="${index}" data-url="${escapeHtml(url)}">
            <span class="text-sm text-gray-300">第 ${index + 1} 集</span>
        </div>
    `).join('');

    setModalContent(`
        ${detailHtml}
        <div class="flex flex-wrap items-center justify-between mb-4 gap-2">
            <div class="flex items-center gap-2">
                <button onclick="LibreTV.toggleDetailEpisodeOrder()"
                        class="px-3 py-1.5 bg-[#333] hover:bg-[#444] border border-[#444] rounded text-sm transition-colors flex items-center gap-1">
                    <svg class="w-4 h-4" id="detailOrderIcon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
                    </svg>
                    <span id="detailOrderText">倒序排列</span>
                </button>
                <span class="text-gray-400 text-sm">共 ${episodes.length} 集</span>
            </div>
            <button onclick="LibreTV.copyEpisodeLinks()" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors">
                复制链接
            </button>
        </div>
        <div id="episodesGrid" class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
            ${episodeItems}
        </div>
    `);

    // 存储当前请求数据供倒序和播放使用
    window.__currentDetail = { episodes, videoInfo };
    window.__detailReversed = false;

    // 绑定集数点击
    setTimeout(() => {
        document.querySelectorAll('.episode-item').forEach(item => {
            item.addEventListener('click', () => {
                const index = parseInt(item.dataset.index, 10);
                playVideo(videoInfo.title, videoInfo.source_code || '', episodes, index);
            });
        });
    }, 0);
}

function playVideo(title, source, episodes, index, id = '') {
    historyService.savePlaybackState({
        title,
        source,
        episodes,
        episodeIndex: index,
        id
    });

    // 保存当前页面URL，便于播放器页返回
    storage.set(StorageKeys.LAST_PAGE_URL, window.location.href);

    const url = episodes[index];
    // 构建播放页面 URL
    const params = new URLSearchParams();
    params.set('title', title);
    params.set('source', source);
    params.set('url', url);
    params.set('index', String(index));
    if (id) params.set('id', id);

    window.location.href = `player.html?${params.toString()}`;
}

function renderAPICheckboxes() {
    const container = $('apiCheckboxes');
    if (!container) return;

    const selected = settingsService.getSelectedAPIs();
    const sources = sourceService.getAllSources();

    let html = '';

    // 普通源
    const normalSources = sources.filter(s => !s.adult);
    if (normalSources.length > 0) {
        html += `<div class="col-span-2 text-xs text-gray-500 mb-1">普通资源</div>`;
        normalSources.forEach(source => {
            const checked = selected.includes(source.key) ? 'checked' : '';
            html += `
                <div class="flex items-center">
                    <input type="checkbox" id="api_${source.key}" ${checked}
                           class="form-checkbox h-4 w-4 text-blue-500 bg-[#222] border border-[#333] rounded"
                           data-api-key="${source.key}">
                    <label for="api_${source.key}" class="ml-2 text-xs text-gray-300 truncate">${escapeHtml(source.name)}</label>
                </div>
            `;
        });
    }

    // 成人源
    const adultSources = sources.filter(s => s.adult);
    if (adultSources.length > 0) {
        html += `<div class="col-span-2 text-xs text-pink-500 mb-1 mt-2">特殊资源</div>`;
        adultSources.forEach(source => {
            const checked = selected.includes(source.key) ? 'checked' : '';
            html += `
                <div class="flex items-center">
                    <input type="checkbox" id="api_${source.key}" ${checked}
                           class="form-checkbox h-4 w-4 text-pink-500 bg-[#222] border border-[#333] rounded"
                           data-api-key="${source.key}">
                    <label for="api_${source.key}" class="ml-2 text-xs text-pink-400 truncate">${escapeHtml(source.name)}</label>
                </div>
            `;
        });
    }

    container.innerHTML = html;

    // 绑定变更事件
    container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', (e) => {
            sourceService.toggleSource(e.target.dataset.apiKey, e.target.checked);
            updateSelectedCount();
            checkAdultAPIsSelected();
        });
    });
}

function checkAdultAPIsSelected() {
    const selected = settingsService.getSelectedAPIs();
    const sources = sourceService.getAllSources();
    const hasAdult = sources.some(s => s.adult && selected.includes(s.key));
    const warningEl = document.getElementById('adultApiWarning');

    if (hasAdult) {
        if (!warningEl) {
            const container = $('apiCheckboxes');
            if (!container) return;
            const div = document.createElement('div');
            div.id = 'adultApiWarning';
            div.className = 'col-span-2 text-xs text-red-400 mt-1';
            div.textContent = '⚠️ 已选中成人内容源，请注意使用环境';
            container.appendChild(div);
        }
    } else if (warningEl) {
        warningEl.remove();
    }
}

function renderCustomAPIs() {
    const container = $('customApisList');
    if (!container) return;

    const apis = settingsService.getCustomAPIs();
    if (apis.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-500 text-xs py-2">暂无自定义API</div>';
        return;
    }

    const selected = settingsService.getSelectedAPIs();
    container.innerHTML = apis.map((api, index) => {
        const key = `custom_${index}`;
        const checked = selected.includes(key) ? 'checked' : '';
        return `
            <div class="flex items-center justify-between p-2 bg-[#1a1a1a] rounded mb-1">
                <div class="flex items-center min-w-0">
                    <input type="checkbox" ${checked}
                           class="form-checkbox h-4 w-4 text-blue-500 bg-[#222] border border-[#333] rounded"
                           data-api-key="${key}">
                    <span class="ml-2 text-xs text-gray-300 truncate">${escapeHtml(api.name || api.url)}</span>
                </div>
                <div class="flex items-center gap-1">
                    <button data-index="${index}" class="edit-custom-api text-blue-400 hover:text-blue-300 text-xs"
                            title="编辑">✎</button>
                    <button data-index="${index}" class="delete-custom-api text-red-400 hover:text-red-300 text-xs"
                            title="删除">×</button>
                </div>
            </div>
        `;
    }).join('');

    // 绑定事件
    container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', (e) => {
            sourceService.toggleSource(e.target.dataset.apiKey, e.target.checked);
        });
    });

    container.querySelectorAll('.edit-custom-api').forEach(btn => {
        btn.addEventListener('click', () => {
            editCustomApi(parseInt(btn.dataset.index, 10));
        });
    });

    container.querySelectorAll('.delete-custom-api').forEach(btn => {
        btn.addEventListener('click', () => {
            sourceService.removeCustomSource(parseInt(btn.dataset.index, 10));
            renderCustomAPIs();
            renderAPICheckboxes();
        });
    });
}

function updateSelectedCount() {
    const selected = settingsService.getSelectedAPIs();
    const el = $('selectedApiCount');
    if (el) el.textContent = selected.length;
}

function renderHistory() {
    const history = historyService.getHistory();
    renderHistoryList(history, 'historyList', null, (item) => {
        // 点击历史记录跳转
        if (item.url) {
            window.location.href = item.url;
        }
    });
}

function togglePanel(panelId) {
    const panel = $(panelId);
    if (!panel) return;
    if (panelId === 'settingsPanel') {
        panel.classList.toggle('show');
    } else if (panelId === 'historyPanel') {
        panel.classList.toggle('-translate-x-full');
        panel.classList.toggle('translate-x-0');
    }
}

function initSearchFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const keyword = params.get('s') || params.get('wd');
    if (keyword) {
        const input = $('searchInput');
        if (input) input.value = keyword;
        toggleClearButton();
        handleSearch();
    }
}

// ==================== 搜索历史 ====================

const MAX_SEARCH_HISTORY = 5;

function getSearchHistory() {
    return storage.get(StorageKeys.SEARCH_HISTORY, []);
}

function addSearchHistory(query) {
    let history = getSearchHistory();
    history = history.filter(q => q !== query);
    history.unshift(query);
    if (history.length > MAX_SEARCH_HISTORY) {
        history = history.slice(0, MAX_SEARCH_HISTORY);
    }
    storage.set(StorageKeys.SEARCH_HISTORY, history);
    renderSearchHistory();
}

function renderSearchHistory() {
    const container = $(DOM_IDS.RECENT_SEARCHES);
    if (!container) return;

    const history = getSearchHistory();
    if (history.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = history.map(q => `
        <button class="search-history-tag px-3 py-1 text-xs rounded-full bg-[#222] text-gray-400 border border-[#333] hover:border-white hover:text-white transition-colors"
                data-query="${escapeHtml(q)}">
            ${escapeHtml(q)}
        </button>
    `).join('');

    container.querySelectorAll('.search-history-tag').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = $('searchInput');
            if (input) input.value = btn.dataset.query;
            handleSearch();
        });
    });
}

// ==================== 配置导入/导出 ====================

function exportConfig() {
    const data = settingsService.exportSettings();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `libretv-config-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('配置已导出', 'success');
}

function importConfig() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            settingsService.importSettings(data);
            showToast('配置已导入', 'success');
            // 刷新UI
            initDefaults();
            renderAPICheckboxes();
            renderCustomAPIs();
        } catch (err) {
            showToast('配置文件格式错误', 'error');
        }
    };
    input.click();
}

function clearLocalStorage() {
    if (confirm('确定要清除所有本地数据吗？此操作不可恢复。')) {
        settingsService.clearAllSettings();
        showToast('本地数据已清除', 'success');
        setTimeout(() => location.reload(), 500);
    }
}

// ==================== 免责声明弹窗 ====================

function initDisclaimer() {
    const hasSeen = storage.get(StorageKeys.HAS_SEEN_DISCLAIMER, false);
    if (!hasSeen) {
        showDisclaimerModal();
    }
}

function showDisclaimerModal() {
    let modal = $('disclaimerModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'disclaimerModal';
        modal.className = 'fixed inset-0 bg-black/90 hidden items-center justify-center z-[60]';
        modal.innerHTML = `
            <div class="bg-[#111] p-8 rounded-lg border border-[#333] w-11/12 max-w-2xl max-h-[90vh] overflow-y-auto">
                <h2 class="text-2xl font-bold gradient-text mb-6 text-center">使用声明</h2>
                <div class="text-gray-300 space-y-4 text-sm">
                    <p><strong class="text-blue-400">服务性质：</strong> LibreTV 仅提供视频搜索服务，不直接提供、存储或上传任何视频内容。</p>
                    <p><strong class="text-blue-400">用户责任：</strong> 用户在使用本站服务时，须遵守相关法律法规。</p>
                    <p><strong class="text-blue-400">广告风险提示：</strong> 所有视频均来自第三方采集站，视频中出现的广告与本站无关。</p>
                </div>
                <div class="mt-6 flex justify-center">
                    <button id="acceptDisclaimerBtn" class="px-6 py-3 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white font-semibold rounded-lg hover:shadow-lg transition-all duration-300">
                        我已了解并接受
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    // 绑定接受按钮事件（无论动态创建还是 HTML 中已存在）
    const acceptBtn = $('acceptDisclaimerBtn');
    if (acceptBtn && !acceptBtn._disclaimerBound) {
        acceptBtn._disclaimerBound = true;
        acceptBtn.addEventListener('click', () => {
            storage.set(StorageKeys.HAS_SEEN_DISCLAIMER, true);
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        });
    }
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

// ==================== 豆瓣标签切换与刷新 ====================

let doubanCurrentType = 'movie';
let doubanCurrentTag = '热门';
let doubanPageStart = 0;
const doubanPageSize = 18;

function initDoubanControls() {
    const movieToggle = $('douban-movie-toggle');
    const tvToggle = $('douban-tv-toggle');
    const refreshBtn = $('douban-refresh');

    if (movieToggle) {
        movieToggle.addEventListener('click', () => {
            doubanCurrentType = 'movie';
            doubanPageStart = 0;
            updateDoubanToggleUI();
            loadDouban();
        });
    }

    if (tvToggle) {
        tvToggle.addEventListener('click', () => {
            doubanCurrentType = 'tv';
            doubanPageStart = 0;
            updateDoubanToggleUI();
            loadDouban();
        });
    }

    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            doubanPageStart += doubanPageSize;
            loadDouban();
        });
    }
}

function updateDoubanToggleUI() {
    const movieToggle = $('douban-movie-toggle');
    const tvToggle = $('douban-tv-toggle');
    if (movieToggle) {
        movieToggle.className = `px-3 py-1 text-sm rounded-full ${doubanCurrentType === 'movie' ? 'bg-pink-600 text-white' : 'text-gray-300 hover:text-white'}`;
    }
    if (tvToggle) {
        tvToggle.className = `px-3 py-1 text-sm rounded-full ${doubanCurrentType === 'tv' ? 'bg-pink-600 text-white' : 'text-gray-300 hover:text-white'}`;
    }
}

async function loadDouban() {
    const container = $(DOM_IDS.DOUBAN_RESULTS);
    if (!container) return;
    container.innerHTML = '<div class="col-span-full text-center text-gray-500 py-8">加载中...</div>';

    try {
        const subjects = await fetchHot(doubanCurrentType, doubanCurrentTag, doubanPageSize, doubanPageStart);
        if (!subjects || subjects.length === 0) {
            container.innerHTML = '<div class="col-span-full text-center text-gray-500 py-8">暂无数据</div>';
            return;
        }

        container.innerHTML = subjects.map(item => `
            <div class="douban-card cursor-pointer group" data-title="${escapeHtml(item.title)}">
                <div class="relative aspect-[2/3] rounded-lg overflow-hidden bg-[#1a1a1a]">
                    <img src="${escapeHtml(item.cover)}" alt="${escapeHtml(item.title)}"
                         class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy">
                    ${item.rate ? `<div class="absolute top-1 right-1 bg-yellow-500 text-black text-xs font-bold px-1.5 py-0.5 rounded">${item.rate}</div>` : ''}
                </div>
                <p class="text-xs text-gray-300 mt-1 line-clamp-1">${escapeHtml(item.title)}</p>
            </div>
        `).join('');

        container.querySelectorAll('.douban-card').forEach(card => {
            card.addEventListener('click', () => {
                const input = $('searchInput');
                if (input) input.value = card.dataset.title;
                handleSearch();
            });
        });
    } catch (error) {
        console.error('豆瓣加载失败:', error);
        container.innerHTML = '<div class="col-span-full text-center text-gray-500 py-8">加载失败</div>';
    }
}

async function initDouban() {
    if (!settingsService.isDoubanEnabled()) {
        setVisible(DOM_IDS.DOUBAN_AREA, false);
        return;
    }
    setVisible(DOM_IDS.DOUBAN_AREA, true);
    initDoubanControls();
    await renderDoubanTags();
    await loadDouban();
}

async function renderDoubanTags() {
    const container = $('douban-tags');
    if (!container) return;

    try {
        const { fetchTags } = await import('../../api/douban-client.js');
        const tags = await fetchTags(doubanCurrentType);
        if (!tags || tags.length === 0) return;

        container.innerHTML = tags.map(tag => `
            <button class="douban-tag px-3 py-1 text-xs rounded-full transition-colors ${tag === doubanCurrentTag ? 'bg-pink-600 text-white' : 'bg-[#222] text-gray-400 hover:text-white border border-[#333]'}"
                    data-tag="${escapeHtml(tag)}">
                ${escapeHtml(tag)}
            </button>
        `).join('');

        container.querySelectorAll('.douban-tag').forEach(btn => {
            btn.addEventListener('click', () => {
                doubanCurrentTag = btn.dataset.tag;
                doubanPageStart = 0;
                renderDoubanTags();
                loadDouban();
            });
        });
    } catch (error) {
        console.error('豆瓣标签加载失败:', error);
    }
}

// ==================== 自定义API表单 ====================

function initCustomApiForm() {
    const addBtn = document.querySelector('button[onclick="showAddCustomApiForm()"]');
    if (addBtn) {
        addBtn.removeAttribute('onclick');
        addBtn.addEventListener('click', showAddCustomApiForm);
    }

    const importBtn = document.querySelector('button[onclick="showImportCustomApiForm()"]');
    if (importBtn) {
        importBtn.removeAttribute('onclick');
        importBtn.addEventListener('click', showImportCustomApiForm);
    }

    const urlImportBtn = document.querySelector('button[onclick="showUrlImportModal()"]');
    if (urlImportBtn) {
        urlImportBtn.removeAttribute('onclick');
        urlImportBtn.addEventListener('click', showUrlImportModal);
    }
}

function editCustomApi(index) {
    const apis = settingsService.getCustomAPIs();
    const api = apis[index];
    if (!api) return;

    editingCustomApiIndex = index;

    const nameInput = $('customApiName');
    const urlInput = $('customApiUrl');
    const detailInput = $('customApiDetail');
    const adultInput = $('customApiIsAdult');
    if (nameInput) nameInput.value = api.name || '';
    if (urlInput) urlInput.value = api.url || '';
    if (detailInput) detailInput.value = api.detail || '';
    if (adultInput) adultInput.checked = api.isAdult || false;

    const form = $('addCustomApiForm');
    if (form) form.classList.remove('hidden');

    const addBtn = document.getElementById('addCustomApiBtn');
    const cancelBtn = document.getElementById('cancelCustomApiBtn');
    if (addBtn) {
        addBtn.textContent = '更新';
        addBtn.setAttribute('onclick', 'updateCustomApi()');
    }
    if (cancelBtn) {
        cancelBtn.textContent = '取消编辑';
        cancelBtn.setAttribute('onclick', 'cancelEditCustomApi()');
    }
}

function updateCustomApi() {
    const nameInput = $('customApiName');
    const urlInput = $('customApiUrl');
    const detailInput = $('customApiDetail');
    const adultInput = $('customApiIsAdult');

    const name = nameInput?.value.trim();
    const url = urlInput?.value.trim();
    const detail = detailInput?.value.trim();
    const isAdult = adultInput?.checked || false;

    if (!name || !url) {
        showToast('请填写名称和地址', 'warning');
        return;
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        showToast('API地址必须以http://或https://开头', 'warning');
        return;
    }

    try {
        sourceService.updateCustomSource(editingCustomApiIndex, name, url, detail, isAdult);
        showToast('自定义API更新成功', 'success');
        cancelEditCustomApi();
        renderCustomAPIs();
        renderAPICheckboxes();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function cancelEditCustomApi() {
    const form = $('addCustomApiForm');
    if (form) {
        form.querySelectorAll('input').forEach(input => {
            if (input.type !== 'checkbox') input.value = '';
            else input.checked = false;
        });
    }
    editingCustomApiIndex = -1;
    restoreAddCustomApiButtons();
}

function restoreAddCustomApiButtons() {
    const addBtn = document.getElementById('addCustomApiBtn');
    const cancelBtn = document.getElementById('cancelCustomApiBtn');
    if (addBtn) {
        addBtn.textContent = '添加';
        addBtn.setAttribute('onclick', 'addCustomApi()');
    }
    if (cancelBtn) {
        cancelBtn.textContent = '取消';
        cancelBtn.setAttribute('onclick', 'cancelAddCustomApi()');
    }
}

function showAddCustomApiForm() {
    const form = $('addCustomApiForm');
    if (form) form.classList.remove('hidden');
    cancelEditCustomApi();
}

function cancelAddCustomApi() {
    const form = $('addCustomApiForm');
    if (form) {
        form.classList.add('hidden');
        form.querySelectorAll('input').forEach(input => input.value = '');
    }
}

function addCustomApi() {
    const nameInput = $('customApiName');
    const urlInput = $('customApiUrl');
    const detailInput = $('customApiDetail');
    const adultInput = $('customApiIsAdult');

    const name = nameInput?.value.trim();
    const url = urlInput?.value.trim();
    const detail = detailInput?.value.trim();
    const isAdult = adultInput?.checked || false;

    if (!name || !url) {
        showToast('请填写名称和地址', 'warning');
        return;
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        showToast('API地址必须以http://或https://开头', 'warning');
        return;
    }

    try {
        sourceService.addCustomSource(name, url, detail, isAdult);
        showToast('自定义API添加成功', 'success');
        cancelAddCustomApi();
        renderCustomAPIs();
        renderAPICheckboxes();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function showImportCustomApiForm() {
    const form = $('importCustomApiForm');
    if (form) form.classList.remove('hidden');
}

function cancelImportCustomApiForm() {
    const form = $('importCustomApiForm');
    if (form) form.classList.add('hidden');
}

async function importCustomApis() {
    const fileInput = $('importFileInput');
    if (!fileInput || !fileInput.files[0]) {
        showToast('请选择文件', 'warning');
        return;
    }
    try {
        const text = await fileInput.files[0].text();
        const data = JSON.parse(text);
        if (Array.isArray(data)) {
            const current = settingsService.getCustomAPIs();
            const merged = [...current, ...data].slice(0, 5);
            settingsService.updateCustomAPIs(merged);
            showToast('导入成功', 'success');
            cancelImportCustomApiForm();
            renderCustomAPIs();
            renderAPICheckboxes();
        }
    } catch (err) {
        showToast('文件格式错误', 'error');
    }
}

function showUrlImportModal() {
    openModal('urlImportModal');
}

function closeUrlImportModal() {
    closeModal('urlImportModal');
    // 重置弹窗状态
    const urlInput = $('urlImportInput');
    const listContainer = $('urlImportList');
    const importBtn = $('importSelectedApiBtn');
    if (urlInput) urlInput.value = 'https://lunatv-config.htnf.dpdns.org/?format=3&source=jin18';
    if (listContainer) {
        listContainer.classList.add('hidden');
        listContainer.innerHTML = '';
    }
    if (importBtn) importBtn.classList.add('hidden');
}

function renderUrlApiList(apiList) {
    const listContainer = $('urlImportList');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    if (apiList.length === 0) {
        listContainer.innerHTML = '<p class="text-gray-400">未找到API数据</p>';
        listContainer.classList.remove('hidden');
        return;
    }

    const ul = document.createElement('ul');
    ul.className = 'space-y-2';

    apiList.forEach((api, index) => {
        if (api.name && api.baseUrl) {
            const li = document.createElement('li');
            li.className = 'flex flex-col p-3 bg-[#222] rounded-lg';

            const mainRow = document.createElement('div');
            mainRow.className = 'flex items-center';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = 'urlApi_' + index;
            checkbox.className = 'w-4 h-4 text-blue-600 bg-[#333] border-[#444] rounded focus:ring-blue-500 focus:ring-offset-[#222]';
            checkbox.value = JSON.stringify(api);

            const label = document.createElement('label');
            label.htmlFor = 'urlApi_' + index;
            const textColorClass = api.isAdult ? 'text-pink-400' : 'text-gray-300';
            const adultTag = api.isAdult ? '<span class="text-xs text-pink-400 mr-1">(18+)</span>' : '';
            label.className = `ml-3 text-sm font-medium ${textColorClass} flex-grow`;
            label.innerHTML = `<div class="font-semibold">${adultTag}${escapeHtml(api.name)}</div><div class="text-xs text-gray-500">${escapeHtml(api.baseUrl)}</div>`;

            mainRow.appendChild(checkbox);
            mainRow.appendChild(label);

            const adultCheckboxRow = document.createElement('div');
            adultCheckboxRow.className = 'flex items-center mt-2 ml-7';

            const adultCheckbox = document.createElement('input');
            adultCheckbox.type = 'checkbox';
            adultCheckbox.id = 'urlApiAdult_' + index;
            adultCheckbox.className = 'w-4 h-4 text-pink-600 bg-[#333] border-[#444] rounded focus:ring-pink-500 focus:ring-offset-[#222]';
            adultCheckbox.checked = api.isAdult || false;

            adultCheckbox.addEventListener('change', (e) => {
                api.isAdult = e.target.checked;
                checkbox.value = JSON.stringify(api);
                const newTextColorClass = e.target.checked ? 'text-pink-400' : 'text-gray-300';
                const newAdultTag = e.target.checked ? '<span class="text-xs text-pink-400 mr-1">(18+)</span>' : '';
                label.className = `ml-3 text-sm font-medium ${newTextColorClass} flex-grow`;
                label.innerHTML = `<div class="font-semibold">${newAdultTag}${escapeHtml(api.name)}</div><div class="text-xs text-gray-500">${escapeHtml(api.baseUrl)}</div>`;
            });

            const adultLabel = document.createElement('label');
            adultLabel.htmlFor = 'urlApiAdult_' + index;
            adultLabel.className = 'ml-2 text-xs text-pink-400';
            adultLabel.textContent = '黄色资源站';

            adultCheckboxRow.appendChild(adultCheckbox);
            adultCheckboxRow.appendChild(adultLabel);

            li.appendChild(mainRow);
            li.appendChild(adultCheckboxRow);
            ul.appendChild(li);
        }
    });

    listContainer.appendChild(ul);
    listContainer.classList.remove('hidden');

    const importBtn = $('importSelectedApiBtn');
    if (importBtn) importBtn.classList.remove('hidden');

    ul.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', updateImportBtnStatus);
    });
}

function updateImportBtnStatus() {
    const checkboxes = document.querySelectorAll('#urlImportList input[type="checkbox"]:not([id^="urlApiAdult_"])');
    const hasChecked = Array.from(checkboxes).some(cb => cb.checked);
    const importBtn = $('importSelectedApiBtn');
    if (importBtn) {
        importBtn.classList.toggle('hidden', !hasChecked);
    }
}

function importSelectedApis() {
    const checkboxes = document.querySelectorAll('#urlImportList input[type="checkbox"]:checked:not([id^="urlApiAdult_"])');
    if (checkboxes.length === 0) {
        showToast('请先选择要导入的API', 'warning');
        return;
    }

    let importedCount = 0;
    let existingCount = 0;
    const apis = settingsService.getCustomAPIs();
    const selected = settingsService.getSelectedAPIs();

    checkboxes.forEach(checkbox => {
        try {
            const api = JSON.parse(checkbox.value);
            if (api.name && api.baseUrl) {
                const exists = apis.some(item => item.url === api.baseUrl);
                if (!exists) {
                    let url = api.baseUrl;
                    if (url.endsWith('/')) url = url.slice(0, -1);
                    apis.push({ name: api.name, url, detail: api.detail || '', isAdult: api.isAdult || false });
                    importedCount++;
                } else {
                    existingCount++;
                }
            }
        } catch (error) {
            console.error('解析API数据失败:', error);
        }
    });

    if (importedCount > 0) {
        settingsService.updateCustomAPIs(apis);
        // 自动选中新导入的API
        const newKeys = [];
        for (let i = apis.length - importedCount; i < apis.length; i++) {
            newKeys.push(`custom_${i}`);
        }
        settingsService.setSelectedAPIs([...new Set([...selected, ...newKeys])]);
        renderCustomAPIs();
        renderAPICheckboxes();
        updateSelectedCount();
    }

    let message = `成功导入 ${importedCount} 个API`;
    if (existingCount > 0) message += `，${existingCount} 个API已存在`;
    showToast(message, 'success');
    closeUrlImportModal();
}

// ==================== API批量操作 ====================

function selectAllAPIs(selected, onlyNormal = false) {
    sourceService.selectAllSources(selected, onlyNormal);
    renderAPICheckboxes();
    updateSelectedCount();
}

function selectAllCustomAPIs(selected, onlyNormal = false) {
    const custom = sourceService.getAllSources().filter(s => s.isCustom && (!onlyNormal || !s.adult));
    const keys = custom.map(s => s.key);
    const current = settingsService.getSelectedAPIs();
    if (selected) {
        settingsService.setSelectedAPIs([...new Set([...current, ...keys])]);
    } else {
        settingsService.setSelectedAPIs(current.filter(k => !keys.includes(k)));
    }
    renderCustomAPIs();
    renderAPICheckboxes();
}

function deleteAllCustomAPIs() {
    if (confirm('确定要删除所有自定义API吗？')) {
        settingsService.updateCustomAPIs([]);
        renderCustomAPIs();
        renderAPICheckboxes();
        showToast('已删除所有自定义API', 'success');
    }
}

// ==================== 首页重置 ====================

function resetToHome() {
    const searchArea = $('searchArea');
    const resultsArea = $('resultsArea');
    const doubanArea = $('doubanArea');

    if (searchArea) {
        searchArea.classList.remove('hidden', 'mb-8');
        searchArea.classList.add('flex-1', 'justify-center');
    }
    if (resultsArea) resultsArea.classList.add('hidden');
    if (doubanArea && settingsService.isDoubanEnabled()) doubanArea.classList.remove('hidden');

    const input = $('searchInput');
    if (input) input.value = '';

    const clearBtn = $('clearSearchInput');
    if (clearBtn) clearBtn.classList.add('hidden');

    currentQuery = '';
    currentTypeFilter = '';
}

// 将全局函数挂载到 window（兼容内联 onclick）
window.resetToHome = resetToHome;
window.toggleHistory = () => togglePanel('historyPanel');
window.toggleSettings = () => togglePanel('settingsPanel');
window.search = handleSearch;
window.clearSearchInput = () => {
    const input = $('searchInput');
    if (input) input.value = '';
    const clearBtn = $('clearSearchInput');
    if (clearBtn) clearBtn.classList.add('hidden');
};
window.clearViewingHistory = () => {
    historyService.clearHistory();
    renderHistory();
    showToast('历史记录已清空', 'success');
};
window.selectAllAPIs = selectAllAPIs;
window.selectAllCustomAPIs = selectAllCustomAPIs;
window.deleteAllCustomAPIs = deleteAllCustomAPIs;
window.showAddCustomApiForm = showAddCustomApiForm;
window.cancelAddCustomApi = cancelAddCustomApi;
window.addCustomApi = addCustomApi;
window.editCustomApi = editCustomApi;
window.updateCustomApi = updateCustomApi;
window.cancelEditCustomApi = cancelEditCustomApi;
window.showImportCustomApiForm = showImportCustomApiForm;
window.cancelImportCustomApiForm = cancelImportCustomApiForm;
window.importCustomApis = importCustomApis;
window.showUrlImportModal = showUrlImportModal;
window.closeUrlImportModal = closeUrlImportModal;
window.importSelectedApis = importSelectedApis;
window.importConfig = importConfig;
window.exportConfig = exportConfig;
window.clearLocalStorage = clearLocalStorage;
window.closeModal = () => closeModal('modal');
window.toggleClearButton = () => {
    const input = $('searchInput');
    const clearBtn = $('clearSearchInput');
    if (clearBtn) clearBtn.classList.toggle('hidden', !input?.value);
};

// 密码验证（兼容 index.html 内联弹窗）
window.handlePasswordSubmit = async function() {
    const input = $('passwordInput');
    const error = $('passwordError');
    const btn = $('passwordSubmitBtn');
    if (!input) return;

    btn.disabled = true;
    btn.textContent = '验证中...';
    if (error) error.classList.add('hidden');

    const ok = await verifyPassword(input.value);
    if (ok) {
        const modal = $('passwordModal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    } else {
        if (error) error.classList.remove('hidden');
        input.value = '';
        input.focus();
    }

    btn.disabled = false;
    btn.textContent = '提交';
};

window.hidePasswordModal = function() {
    const modal = $('passwordModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
};

// 排序变更（兼容内联 onchange）
window.handleSortChange = function(value) {
    settingsService.setSearchSortOrder(value);
    sortAndRenderResults();
};

window.fetchApiDataFromUrl = async function() {
    const urlInput = $('urlImportInput');
    const url = urlInput?.value.trim();
    if (!url) {
        showToast('请输入配置URL', 'warning');
        return;
    }
    if (!/^https?:\/\/.+/.test(url)) {
        showToast('URL格式不正确，需以http://或https://开头', 'warning');
        return;
    }

    const fetchBtn = document.querySelector('#urlImportModal button[onclick="fetchApiDataFromUrl()"]');
    if (fetchBtn) {
        fetchBtn.disabled = true;
        fetchBtn.textContent = '获取中...';
    }

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('网络请求失败');
        const text = await response.text();

        let apiList;
        try {
            const decodedData = base58Decode(text);
            apiList = JSON.parse(decodedData);
        } catch (decodeError) {
            apiList = JSON.parse(text);
        }

        let apiArray = [];
        if (Array.isArray(apiList)) {
            apiArray = apiList.map(api => ({ ...api, isAdult: api.isAdult || false }));
        } else if (apiList && typeof apiList === 'object' && apiList.api_site) {
            const apiSites = apiList.api_site;
            apiArray = Object.values(apiSites).map(apiSite => ({
                name: apiSite.name,
                baseUrl: apiSite.api,
                detail: apiSite.detail,
                isAdult: apiSite.isAdult || false
            }));
        } else {
            throw new Error('解码后数据格式不正确，应为数组类型或包含api_site的对象');
        }

        renderUrlApiList(apiArray);
    } catch (error) {
        showToast('获取数据失败: ' + error.message, 'error');
    } finally {
        if (fetchBtn) {
            fetchBtn.disabled = false;
            fetchBtn.textContent = '获取数据';
        }
    }
};

window.importSelectedApis = function() {
    const checkboxes = document.querySelectorAll('#urlImportList input[type="checkbox"]:checked');
    if (checkboxes.length === 0) {
        showToast('请先选择要导入的API', 'warning');
        return;
    }

    let importedCount = 0;
    checkboxes.forEach(checkbox => {
        try {
            const api = JSON.parse(checkbox.value);
            if (api.name && api.baseUrl) {
                const current = settingsService.getCustomAPIs();
                const exists = current.some(item => item.url === api.baseUrl);
                if (!exists) {
                    sourceService.addCustomSource(
                        api.name,
                        api.baseUrl.replace(/\/$/, ''),
                        api.detail || '',
                        api.isAdult || false
                    );
                    importedCount++;
                }
            }
        } catch (e) {
            console.error('导入API出错:', e);
        }
    });

    if (importedCount > 0) {
        showToast(`成功导入 ${importedCount} 个API`, 'success');
        renderCustomAPIs();
        renderAPICheckboxes();
        closeModal('urlImportModal');
    } else {
        showToast('没有新API被导入（可能已存在）', 'info');
    }
};

// 站点状态更新
window.updateSiteStatus = function(isAvailable) {
    const statusEl = $('siteStatus');
    if (!statusEl) return;
    if (isAvailable) {
        statusEl.innerHTML = '<span class="text-green-500">●</span> 可用';
    } else {
        statusEl.innerHTML = '<span class="text-red-500">●</span> 不可用';
    }
};
