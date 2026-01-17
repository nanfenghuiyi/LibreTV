import { useState } from '#app';
import { onMounted, watch } from 'vue';

export const useSearchState = () => {
    const results = useState<any[]>('search-results', () => []);
    const searchPerformed = useState<boolean>('search-performed', () => false);
    const lastQuery = useState<string>('last-search-query', () => '');
    const loading = useState<boolean>('search-loading', () => false);

    // Persistence
    onMounted(() => {
        const savedResults = localStorage.getItem('libretv-search-results');
        if (savedResults && results.value.length === 0) {
            try {
                results.value = JSON.parse(savedResults);
                const savedQuery = localStorage.getItem('libretv-last-query');
                if (savedQuery) lastQuery.value = savedQuery;
                searchPerformed.value = results.value.length > 0;
            } catch (e) {}
        }
    });

    watch(results, (newVal: any[]) => {
        localStorage.setItem('libretv-search-results', JSON.stringify(newVal));
    }, { deep: true });

    watch(lastQuery, (newVal: string) => {
        localStorage.setItem('libretv-last-query', newVal);
    });

    const clearSearch = () => {
        results.value = [];
        searchPerformed.value = false;
        lastQuery.value = '';
        localStorage.removeItem('libretv-search-results');
        localStorage.removeItem('libretv-last-query');
    };

    return {
        results,
        searchPerformed,
        lastQuery,
        loading,
        clearSearch
    };
};
