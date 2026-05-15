// 观看历史服务

import { storage } from '../core/storage.js';
import { StorageKeys, Events } from '../core/constants.js';
import { MAX_HISTORY_ITEMS } from '../core/config.js';
import { eventBus } from '../core/events.js';

/**
 * 获取观看历史
 */
export function getHistory() {
    return storage.get(StorageKeys.VIEWING_HISTORY, []);
}

/**
 * 添加观看记录
 * @param {Object} record - { id, title, source, episodeIndex, episodeName, cover, url, timestamp }
 */
export function addHistory(record) {
    let history = getHistory();

    // 去重：如果已存在相同视频，移除旧的
    history = history.filter(item => item.id !== record.id || item.source !== record.source);

    // 添加到开头
    history.unshift({
        ...record,
        timestamp: record.timestamp || Date.now()
    });

    // 限制数量
    if (history.length > MAX_HISTORY_ITEMS * 10) {
        history = history.slice(0, MAX_HISTORY_ITEMS * 10);
    }

    storage.set(StorageKeys.VIEWING_HISTORY, history);
    eventBus.emit(Events.HISTORY_UPDATED, history);
    return history;
}

/**
 * 更新观看进度
 */
export function updateProgress(id, source, episodeIndex, currentTime = null) {
    const history = getHistory();
    const index = history.findIndex(item => item.id === id && item.source === source);
    if (index !== -1) {
        history[index].episodeIndex = episodeIndex;
        if (currentTime !== null) {
            history[index].currentTime = currentTime;
        }
        history[index].lastWatchTime = Date.now();
        storage.set(StorageKeys.VIEWING_HISTORY, history);
        eventBus.emit(Events.HISTORY_UPDATED, history);
    }
    return history;
}

/**
 * 删除单条历史
 */
export function removeHistory(id, source) {
    let history = getHistory();
    history = history.filter(item => !(item.id === id && item.source === source));
    storage.set(StorageKeys.VIEWING_HISTORY, history);
    eventBus.emit(Events.HISTORY_UPDATED, history);
    return history;
}

/**
 * 清空历史
 */
export function clearHistory() {
    storage.remove(StorageKeys.VIEWING_HISTORY);
    eventBus.emit(Events.HISTORY_UPDATED, []);
}

/**
 * 保存当前播放状态
 */
export function savePlaybackState(state) {
    if (state.title) storage.set(StorageKeys.CURRENT_VIDEO_TITLE, state.title);
    if (state.episodes) storage.set(StorageKeys.CURRENT_EPISODES, state.episodes);
    if (state.episodeIndex !== undefined) storage.set(StorageKeys.CURRENT_EPISODE_INDEX, state.episodeIndex);
    if (state.source) storage.set(StorageKeys.CURRENT_SOURCE_CODE, state.source);
    if (state.id) {
        storage.set(StorageKeys.CURRENT_PLAYING_ID, state.id);
        storage.set(StorageKeys.CURRENT_PLAYING_SOURCE, state.source);
    }
    storage.set('lastPlayTime', Date.now());
}

/**
 * 获取当前播放状态
 */
export function getPlaybackState() {
    return {
        title: storage.get(StorageKeys.CURRENT_VIDEO_TITLE, ''),
        episodes: storage.get(StorageKeys.CURRENT_EPISODES, []),
        episodeIndex: storage.get(StorageKeys.CURRENT_EPISODE_INDEX, 0),
        source: storage.get(StorageKeys.CURRENT_SOURCE_CODE, ''),
        id: storage.get(StorageKeys.CURRENT_PLAYING_ID, '')
    };
}

export const historyService = {
    getHistory,
    addHistory,
    updateProgress,
    removeHistory,
    clearHistory,
    savePlaybackState,
    getPlaybackState
};
