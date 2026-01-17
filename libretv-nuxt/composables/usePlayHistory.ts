import { useState } from '#app';

export interface PlayHistoryItem {
    id: string;
    title: string;
    cover: string;
    url: string;
    episodeTitle?: string;
    episodeIndex: number;
    progress: number; // Percentage 0-100
    currentTime: number;
    totalTime: number;
    timestamp: number;
}

export const usePlayHistory = () => {
    const history = useState<PlayHistoryItem[]>('playHistory', () => []);

    // Load history from localStorage on client side
    const loadHistory = () => {
        if (import.meta.client) {
            const stored = localStorage.getItem('playHistory');
            if (stored) {
                try {
                    history.value = JSON.parse(stored);
                } catch (e) {
                    console.error('Failed to parse play history', e);
                }
            }
        }
    };

    const saveHistory = () => {
        if (import.meta.client) {
            localStorage.setItem('playHistory', JSON.stringify(history.value));
        }
    };

    const addHistory = (item: Omit<PlayHistoryItem, 'timestamp'>) => {
        const newItem: PlayHistoryItem = {
            ...item,
            timestamp: Date.now()
        };

        // Remove existing entry for the same video id
        const filtered = history.value.filter(h => h.id !== item.id);
        
        // Add to the front (most recent)
        history.value = [newItem, ...filtered].slice(0, 50); // Keep last 50
        saveHistory();
    };

    const updateProgress = (id: string, currentTime: number, totalTime: number) => {
        const progress = totalTime > 0 ? (currentTime / totalTime) * 100 : 0;
        const index = history.value.findIndex(h => h.id === id);
        if (index !== -1) {
            history.value[index].currentTime = currentTime;
            history.value[index].totalTime = totalTime;
            history.value[index].progress = Math.floor(progress);
            history.value[index].timestamp = Date.now();
            saveHistory();
        }
    };

    const removeHistory = (id: string) => {
        history.value = history.value.filter(h => h.id !== id);
        saveHistory();
    };

    const clearHistory = () => {
        history.value = [];
        if (import.meta.client) {
            localStorage.removeItem('playHistory');
        }
    };

    return {
        history,
        loadHistory,
        addHistory,
        updateProgress,
        removeHistory,
        clearHistory
    };
};
