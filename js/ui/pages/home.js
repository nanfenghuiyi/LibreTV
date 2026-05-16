// 首页入口 - 整合所有新模块

import { $, delegate, toggleDisplay, setVisible, clearElement } from '../../core/dom.js';
import { eventBus } from '../../core/events.js';
import { Events, StorageKeys, DOM_IDS } from '../../core/constants.js';
import { escapeHtml, debounce } from '../../core/utils.js';
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

// 挂载到 window 供内联 onclick 使用
window.LibreTV = window.LibreTV || {};
window.LibreTV.openDetail = openDetail;

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

    // 面板切换
    const settingsBtn = document.querySelector('button[aria-label="打开设置"]');
    if (settingsBtn) settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePanel('settingsPanel');
    });

    const historyBtn = document.querySelector('button[aria-label="观看历史"]');
    if (historyBtn) historyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePanel('historyPanel');
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
    setVisible(DOM_IDS.SEARCH_AREA, false);
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

        setModalTitle(data.videoInfo.title || '视频详情');
        renderEpisodeList(data.episodes, data.videoInfo);
        openModal('modal');
    } catch (error) {
        hideLoading();
        showToast('加载详情失败', 'error');
        console.error(error);
    }
}

function renderEpisodeList(episodes, videoInfo) {
    const html = episodes.map((url, index) => `
        <div class="episode-item cursor-pointer p-3 bg-[#1a1a1a] rounded hover:bg-[#222] transition-colors border border-transparent hover:border-[#444]"
             data-index="${index}" data-url="${escapeHtml(url)}">
            <span class="text-sm text-gray-300">第 ${index + 1} 集</span>
        </div>
    `).join('');

    setModalContent(`
        <div class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
            ${html}
        </div>
    `);

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

function playVideo(title, source, episodes, index) {
    historyService.savePlaybackState({
        title,
        source,
        episodes,
        episodeIndex: index
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
                <button data-index="${index}" class="delete-custom-api text-red-400 hover:text-red-300 text-xs"
                        title="删除">×</button>
            </div>
        `;
    }).join('');

    // 绑定事件
    container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', (e) => {
            sourceService.toggleSource(e.target.dataset.apiKey, e.target.checked);
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

        $('acceptDisclaimerBtn').addEventListener('click', () => {
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

function showAddCustomApiForm() {
    const form = $('addCustomApiForm');
    if (form) form.classList.remove('hidden');
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

    if (searchArea) searchArea.classList.remove('hidden');
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
window.showImportCustomApiForm = showImportCustomApiForm;
window.cancelImportCustomApiForm = cancelImportCustomApiForm;
window.importCustomApis = importCustomApis;
window.showUrlImportModal = showUrlImportModal;
window.closeUrlImportModal = closeUrlImportModal;
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

// URL 导入 API（简化实现）
window.fetchApiDataFromUrl = async function() {
    const urlInput = $('urlImportInput');
    const url = urlInput?.value.trim();
    if (!url) {
        showToast('请输入配置URL', 'warning');
        return;
    }
    if (!/^https?:\/\/.+/.test(url)) {
        showToast('URL格式不正确', 'warning');
        return;
    }

    showLoading('获取数据中...');
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('网络请求失败');
        const data = await response.json();

        let apiArray = [];
        if (Array.isArray(data)) {
            apiArray = data.map(api => ({
                name: api.name,
                baseUrl: api.baseUrl || api.api,
                detail: api.detail,
                isAdult: api.isAdult || false
            }));
        } else if (data && typeof data === 'object' && data.api_site) {
            apiArray = Object.values(data.api_site).map(api => ({
                name: api.name,
                baseUrl: api.api,
                detail: api.detail,
                isAdult: api.isAdult || false
            }));
        } else {
            throw new Error('数据格式不正确');
        }

        renderUrlApiList(apiArray);
    } catch (error) {
        showToast('获取数据失败: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
};

function renderUrlApiList(apiList) {
    const listContainer = $('urlImportList');
    const importBtn = $('importSelectedApiBtn');
    if (!listContainer) return;

    if (apiList.length === 0) {
        listContainer.innerHTML = '<p class="text-gray-400">未找到API数据</p>';
        listContainer.classList.remove('hidden');
        if (importBtn) importBtn.classList.add('hidden');
        return;
    }

    listContainer.innerHTML = `
        <ul class="space-y-2">
            ${apiList.map((api, index) => `
                <li class="flex items-center p-3 bg-[#222] rounded-lg">
                    <input type="checkbox" id="urlApi_${index}" value="${escapeHtml(JSON.stringify(api))}"
                           class="w-4 h-4 text-blue-600 bg-[#333] border-[#444] rounded">
                    <label for="urlApi_${index}" class="ml-3 text-sm flex-grow">
                        <div class="font-semibold ${api.isAdult ? 'text-pink-400' : 'text-gray-300'}">${api.isAdult ? '(18+) ' : ''}${escapeHtml(api.name)}</div>
                        <div class="text-xs text-gray-500">${escapeHtml(api.baseUrl)}</div>
                    </label>
                </li>
            `).join('')}
        </ul>
    `;
    listContainer.classList.remove('hidden');
    if (importBtn) importBtn.classList.remove('hidden');
}

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
