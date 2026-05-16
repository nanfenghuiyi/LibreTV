// 播放器页面入口

import { $ } from '../../core/dom.js';
import { escapeHtml } from '../../core/utils.js';
import { storage } from '../../core/storage.js';
import { StorageKeys } from '../../core/constants.js';
import { historyService } from '../../services/history-service.js';
import { settingsService } from '../../services/settings-service.js';
import { showToast } from '../components/toast.js';
import { showLoading, hideLoading } from '../components/loading.js';
import { verifyPassword, isPasswordProtected, isPasswordVerified } from '../../services/auth-service.js';
import { sourceService } from '../../services/source-service.js';
import { API_SITES } from '../../core/config.js';
import { openModal, setModalTitle, setModalContent } from '../components/modal.js';

let player = null;
let currentEpisodes = [];
let currentIndex = 0;
let currentTitle = '';
let currentSource = '';
let isReversed = false;

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    initFromUrl();
    initPlayer();
    initEventListeners();
    saveHistory();
});

function initFromUrl() {
    const params = new URLSearchParams(window.location.search);
    currentTitle = params.get('title') || storage.get(StorageKeys.CURRENT_VIDEO_TITLE) || '未知视频';
    currentSource = params.get('source') || storage.get(StorageKeys.CURRENT_SOURCE_CODE) || '';
    currentIndex = parseInt(params.get('index') || storage.get(StorageKeys.CURRENT_EPISODE_INDEX) || '0', 10);

    const url = params.get('url');
    const storedEpisodes = storage.get(StorageKeys.CURRENT_EPISODES, []);

    if (url) {
        currentEpisodes = storedEpisodes.length > 0 ? storedEpisodes : [url];
    } else if (storedEpisodes.length > 0) {
        currentEpisodes = storedEpisodes;
    }

    isReversed = storage.get(StorageKeys.EPISODES_REVERSED, false);

    // 更新标题
    const titleEl = $('videoTitle');
    if (titleEl) titleEl.textContent = currentTitle;
}

function initPlayer() {
    if (!currentEpisodes.length) {
        showError('没有可播放的视频');
        return;
    }

    const container = $('player');
    if (!container) return;

    // 清空加载状态
    container.innerHTML = '';

    const videoUrl = currentEpisodes[currentIndex];

    // 根据 URL 后缀自动检测视频类型
    function detectVideoType(url) {
        const lowered = (url || '').toLowerCase();
        if (/\.mp4(\?|$)/.test(lowered)) return 'video/mp4';
        if (/\.webm(\?|$)/.test(lowered)) return 'video/webm';
        if (/\.ogg(\?|$)/.test(lowered)) return 'video/ogg';
        if (/\.mp3(\?|$)/.test(lowered)) return 'audio/mp3';
        if (/\.(flv|f4v)(\?|$)/.test(lowered)) return 'flv';
        return 'm3u8';
    }

    try {
        player = new Artplayer({
            container: container,
            url: videoUrl,
            type: detectVideoType(videoUrl),
            autoplay: settingsService.getSetting(StorageKeys.AUTOPLAY_ENABLED, true),
            fullscreen: true,
            fullscreenWeb: true,
            pip: true,
            setting: true,
            playbackRate: true,
            aspectRatio: true,
            theme: '#00ccff',
            lang: 'zh-cn',
            customType: {
                m3u8: function (video, url) {
                    if (Hls.isSupported()) {
                        const hls = new Hls();
                        hls.loadSource(url);
                        hls.attachMedia(video);
                    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                        video.src = url;
                    }
                }
            }
        });

        player.on('ready', () => {
            updateEpisodeInfo();
        });

        player.on('ended', () => {
            if (settingsService.getSetting(StorageKeys.AUTOPLAY_ENABLED, true)) {
                playNext();
            }
        });

        updateEpisodeInfo();
        renderEpisodeList();
        renderResourceInfoBar();
    } catch (error) {
        console.error('播放器初始化失败:', error);
        showError('播放器初始化失败');
    }
}

function initEventListeners() {
    // 上一集
    const prevBtn = $('prevButton');
    if (prevBtn) prevBtn.addEventListener('click', playPrevious);

    // 下一集
    const nextBtn = $('nextButton');
    if (nextBtn) nextBtn.addEventListener('click', playNext);

    // 返回
    const goBack = $('goBack');
    if (goBack) {
        goBack.removeAttribute('onclick');
        goBack.addEventListener('click', (e) => {
            e.preventDefault();
            const lastPage = storage.get(StorageKeys.LAST_PAGE_URL, '/');
            window.location.href = lastPage;
        });
    }

    // 首页按钮
    const homeBtn = $('homeButton');
    if (homeBtn) {
        homeBtn.addEventListener('click', () => {
            window.location.href = '/';
        });
    }

    // 自动播放开关
    const autoplayToggle = $('autoplayToggle');
    if (autoplayToggle) {
        autoplayToggle.checked = settingsService.getSetting(StorageKeys.AUTOPLAY_ENABLED, true);
        autoplayToggle.addEventListener('change', (e) => {
            settingsService.setSetting(StorageKeys.AUTOPLAY_ENABLED, e.target.checked);
        });
    }

    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft' && e.ctrlKey) {
            e.preventDefault();
            playPrevious();
        } else if (e.key === 'ArrowRight' && e.ctrlKey) {
            e.preventDefault();
            playNext();
        }
    });
}

function playEpisode(index) {
    if (index < 0 || index >= currentEpisodes.length) return;
    currentIndex = index;

    const url = currentEpisodes[currentIndex];
    if (player) {
        player.switchUrl(url);
        player.play();
    }

    updateEpisodeInfo();
    saveHistory();
}

function playPrevious() {
    if (currentIndex > 0) {
        playEpisode(currentIndex - 1);
    } else {
        showToast('已经是第一集了', 'info');
    }
}

function playNext() {
    if (currentIndex < currentEpisodes.length - 1) {
        playEpisode(currentIndex + 1);
    } else {
        showToast('已经是最后一集了', 'info');
    }
}

function updateEpisodeInfo() {
    const infoEl = $('episodeInfo');
    if (infoEl) {
        infoEl.textContent = `第 ${currentIndex + 1} / ${currentEpisodes.length} 集`;
    }

    // 更新按钮状态
    const prevBtn = $('prevButton');
    const nextBtn = $('nextButton');
    if (prevBtn) prevBtn.disabled = currentIndex <= 0;
    if (nextBtn) nextBtn.disabled = currentIndex >= currentEpisodes.length - 1;
}

function renderEpisodeList() {
    // 如果页面有集数列表容器，渲染集数
    const container = document.getElementById('episodesList');
    if (!container) return;

    let episodes = [...currentEpisodes];
    if (isReversed) episodes.reverse();

    container.innerHTML = episodes.map((url, idx) => {
        const realIndex = isReversed ? episodes.length - 1 - idx : idx;
        const isActive = realIndex === currentIndex;
        return `
            <button class="episode-btn px-3 py-2 text-xs rounded transition-colors ${isActive ? 'bg-blue-600 text-white' : 'bg-[#222] text-gray-300 hover:bg-[#333]'}}"
                    data-index="${realIndex}"
            >
                第 ${realIndex + 1} 集
            </button>
        `;
    }).join('');

    container.querySelectorAll('.episode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            playEpisode(parseInt(btn.dataset.index, 10));
        });
    });
}

function saveHistory() {
    if (!currentTitle || !currentEpisodes.length) return;

    historyService.addHistory({
        id: storage.get(StorageKeys.CURRENT_PLAYING_ID, ''),
        title: currentTitle,
        source: currentSource,
        episodeIndex: currentIndex,
        episodeName: `第${currentIndex + 1}集`,
        url: window.location.href,
        timestamp: Date.now()
    });
}

function toggleReverse() {
    isReversed = !isReversed;
    storage.set(StorageKeys.EPISODES_REVERSED, isReversed);
    renderEpisodeList();
    showToast(isReversed ? '已倒序排列' : '已正序排列', 'info');
}

async function switchResource(sourceKey, vodId) {
    showLoading('切换资源中...');
    try {
        const { getDetail } = await import('../../api/vod.js');
        const data = await getDetail(vodId, sourceKey);
        hideLoading();

        if (data.code !== 200 || !data.episodes || data.episodes.length === 0) {
            showToast('未找到播放资源', 'error');
            return;
        }

        currentEpisodes = data.episodes;
        currentIndex = 0;
        currentSource = sourceKey;
        currentTitle = data.videoInfo.title || currentTitle;

        const titleEl = $('videoTitle');
        if (titleEl) titleEl.textContent = currentTitle;

        playEpisode(0);
        renderEpisodeList();
        saveHistory();
    } catch (error) {
        hideLoading();
        showToast('切换资源失败', 'error');
        console.error(error);
    }
}

function showError(message) {
    const loadingEl = $('player-loading');
    if (loadingEl) loadingEl.style.display = 'none';
    hideLoading();

    const errorEl = $('error');
    const msgEl = $('error-message');
    if (errorEl) {
        errorEl.style.display = 'flex';
        errorEl.style.alignItems = 'center';
        errorEl.style.justifyContent = 'center';
    }
    if (msgEl) msgEl.textContent = message;
}

function renderResourceInfoBar() {
    const container = $('resourceInfoBarContainer');
    if (!container) return;

    let resourceName = currentSource;
    if (currentSource && API_SITES[currentSource]) {
        resourceName = API_SITES[currentSource].name;
    }
    if (resourceName === currentSource) {
        const customAPIs = settingsService.getCustomAPIs();
        const customIndex = parseInt(currentSource.replace('custom_', ''), 10);
        if (customAPIs[customIndex]) {
            resourceName = customAPIs[customIndex].name || '自定义资源';
        }
    }
    if (!resourceName) resourceName = '未知资源';

    container.innerHTML = `
      <div class="resource-info-bar-left flex">
        <span>${escapeHtml(resourceName)}</span>
        <span class="resource-info-bar-videos">${currentEpisodes.length} 个视频</span>
      </div>
      <button class="resource-switch-btn flex" id="switchResourceBtn" onclick="showSwitchResourceModal()">
        <span class="resource-switch-icon">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 4v16m0 0l-6-6m6 6l6-6" stroke="#a67c2d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </span>
        切换资源
      </button>
    `;
}

async function showSwitchResourceModal() {
    const urlParams = new URLSearchParams(window.location.search);
    const currentSourceCode = urlParams.get('source');
    const currentVideoId = urlParams.get('id');

    if (!currentTitle) {
        showToast('无法获取当前视频信息', 'warning');
        return;
    }

    setModalTitle(currentTitle);
    setModalContent('<div style="text-align:center;padding:20px;color:#aaa;grid-column:1/-1;">正在搜索资源...</div>');
    openModal('modal');

    try {
        const { search } = await import('../../api/vod.js');
        const selectedAPIs = settingsService.getSelectedAPIs();
        const sources = sourceService.getAllSources().filter(s => selectedAPIs.includes(s.key));

        const results = await Promise.all(
            sources.map(async (source) => {
                try {
                    const res = await search(currentTitle, source.isCustom ? 'custom' : source.key, source.isCustom ? source.url : undefined);
                    if (res.code === 200 && res.list && res.list.length > 0) {
                        // 优先取完全同名资源
                        const exactMatch = res.list.find(r => r.vod_name === currentTitle);
                        return { source, result: exactMatch || res.list[0] };
                    }
                } catch (e) {
                    console.warn(`${source.name} 搜索失败:`, e);
                }
                return null;
            })
        );

        const validResults = results.filter(r => r !== null);
        if (validResults.length === 0) {
            setModalContent('<div style="text-align:center;padding:20px;color:#aaa;">未找到可用资源</div>');
            return;
        }

        let html = '<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 p-4">';
        for (const { source, result } of validResults) {
            const isCurrent = String(source.key) === String(currentSourceCode) && String(result.vod_id) === String(currentVideoId);
            html += `
                <div class="relative group ${isCurrent ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105 transition-transform'}"
                     ${!isCurrent ? `onclick="switchToResource('${source.key}', '${result.vod_id}')"` : ''}>
                    <div class="aspect-[2/3] rounded-lg overflow-hidden bg-gray-800 relative">
                        <img src="${escapeHtml(result.vod_pic || '')}"
                             alt="${escapeHtml(result.vod_name || '')}"
                             class="w-full h-full object-cover"
                             onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjNjY2IiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHJlY3QgeD0iMyIgeT0iMyIgd2lkdGg9IjE4IiBoZWlnaHQ9IjE4IiByeD0iMiIgcnk9IjIiPjwvcmVjdD48cGF0aCBkPSJNMjEgMTV2NGEyIDIgMCAwIDEtMiAySDVhMiAyIDAgMCAxLTItMnYtNCI+PC9wYXRoPjxwb2x5bGluZSBwb2ludHM9IjE3IDggMTIgMyA3IDgiPjwvcG9seWxpbmU+PHBhdGggZD0iTTEyIDN2MTIiPjwvcGF0aD48L3N2Zz4='">
                    </div>
                    <div class="mt-2">
                        <div class="text-xs font-medium text-gray-200 truncate">${escapeHtml(result.vod_name || '')}</div>
                        <div class="text-[10px] text-gray-400 truncate">${escapeHtml(source.name)}</div>
                    </div>
                    ${isCurrent ? `
                        <div class="absolute inset-0 flex items-center justify-center">
                            <div class="bg-blue-600 bg-opacity-75 rounded-lg px-2 py-0.5 text-xs text-white font-medium">
                                当前播放
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        }
        html += '</div>';
        setModalContent(html);
    } catch (error) {
        console.error('加载资源列表失败:', error);
        setModalContent('<div style="text-align:center;padding:20px;color:#aaa;">加载失败</div>');
    }
}

// 挂载到 window 供内联 onclick 使用
window.playPreviousEpisode = playPrevious;
window.playNextEpisode = playNext;
window.toggleEpisodeOrder = toggleReverse;
window.switchToResource = switchResource;
window.showSwitchResourceModal = showSwitchResourceModal;

window.closeModal = function() {
    const modal = document.getElementById('modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
};

window.copyLinks = function() {
    if (!currentEpisodes.length) {
        showToast('没有可复制的链接', 'warning');
        return;
    }
    const text = currentEpisodes.join('\n');
    navigator.clipboard.writeText(text).then(() => {
        showToast('播放链接已复制到剪贴板', 'success');
    }).catch(() => {
        showToast('复制失败', 'error');
    });
};

window.downloadVideo = function() {
    if (!currentEpisodes.length) {
        showToast('没有可下载的视频', 'warning');
        return;
    }
    const url = currentEpisodes[currentIndex];
    if (!url) {
        showToast('无法获取视频链接', 'error');
        return;
    }

    let ext = '.mp4';
    try {
        const pathname = new URL(url).pathname;
        const match = pathname.match(/\.(\w+)(?:\?|$)/);
        if (match) ext = '.' + match[1].toLowerCase();
    } catch (e) {}

    const safeName = (currentTitle || 'video').replace(/[/\\?%*:|"<>]/g, '');

    const a = document.createElement('a');
    a.href = url;
    a.download = safeName + ext;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    showToast('如果下载未开始，请检查浏览器弹窗设置后重试', 'success');
};

let controlsLocked = false;
window.toggleControlsLock = function() {
    controlsLocked = !controlsLocked;
    const icon = document.getElementById('lockIcon');
    if (icon) {
        if (controlsLocked) {
            icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />';
        } else {
            icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11V7a3 3 0 00-6 0v4m-3 4h12v6H6v-6z" />';
        }
    }
    showToast(controlsLocked ? '控制栏已锁定' : '控制栏已解锁', 'info');
};

window.goBack = function(e) {
    if (e) e.preventDefault();
    const lastPage = storage.get(StorageKeys.LAST_PAGE_URL, '/');
    window.location.href = lastPage;
};

window.handlePasswordSubmit = async function() {
    const input = document.getElementById('passwordInput');
    const error = document.getElementById('passwordError');
    const btn = document.getElementById('passwordSubmitBtn');
    if (!input) return;

    btn.disabled = true;
    btn.textContent = '验证中...';
    if (error) error.classList.add('hidden');

    const ok = await verifyPassword(input.value);
    if (ok) {
        const modal = document.getElementById('passwordModal');
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
    const modal = document.getElementById('passwordModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
};

// 初始化密码保护
document.addEventListener('DOMContentLoaded', () => {
    if (isPasswordProtected() && !isPasswordVerified()) {
        const modal = document.getElementById('passwordModal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    }
});
