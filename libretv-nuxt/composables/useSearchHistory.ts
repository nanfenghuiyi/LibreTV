import { useState, onMounted } from '#imports';

export const useSearchHistory = () => {
    const SEARCH_HISTORY_KEY = 'searchHistory';
    const MAX_HISTORY_ITEMS = 15;
    
    interface HistoryItem {
        text: string;
        timestamp: number;
    }

    // We use useState to have a shared state across components
    const history = useState<HistoryItem[]>(SEARCH_HISTORY_KEY, () => []);

    // Initialize from localStorage on client side
    onMounted(() => {
        const data = localStorage.getItem(SEARCH_HISTORY_KEY);
        if (data) {
            try {
                const parsed = JSON.parse(data);
                if (Array.isArray(parsed)) {
                    history.value = parsed;
                }
            } catch (e) {
                console.error('Failed to parse search history', e);
            }
        }
    });

    const addHistory = (text: string) => {
        if (!text || !text.trim()) return;
        const query = text.trim();
        
        // Remove existing same query
        const newHistory = history.value.filter((item: HistoryItem) => item.text !== query);
        
        // Add to beginning
        newHistory.unshift({
            text: query,
            timestamp: Date.now()
        });
        
        // Limit size
        if (newHistory.length > MAX_HISTORY_ITEMS) {
            history.value = newHistory.slice(0, MAX_HISTORY_ITEMS);
        } else {
            history.value = newHistory;
        }
        
        // Persist
        localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history.value));
    };

    const removeHistory = (text: string) => {
        history.value = history.value.filter((item: HistoryItem) => item.text !== text);
        localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history.value));
    };

    const clearHistory = () => {
        history.value = [];
        localStorage.removeItem(SEARCH_HISTORY_KEY);
    };

    return {
        history,
        addHistory,
        removeHistory,
        clearHistory
    };
};
