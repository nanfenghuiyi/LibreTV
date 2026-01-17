
export const useDouban = () => {
    const { getAuthParams } = useAuth();
    
    // State
    const currentType = useState<string>('currDoubanType', () => 'movie');
    const currentTag = useState<string>('currDoubanTag', () => '热门');
    const tags = useState<string[]>('doubanTags', () => []);
    const subjects = useState<any[]>('doubanSubjects', () => []);
    const pageStart = useState<number>('doubanPageStart', () => 0);
    const loading = useState<boolean>('doubanLoading', () => false);

    const pageSize = 16;

    // Actions
    const fetchTags = async () => {
        const url = `https://movie.douban.com/j/search_tags?type=${currentType.value}&source=`;
        try {
            const authParams = getAuthParams();
            const query = new URLSearchParams(authParams as any).toString();
            const proxyUrl = `/api/proxy/${encodeURIComponent(url)}?${query}`;
            const data: any = await $fetch(proxyUrl, {
                headers: {
                    'Referer': 'https://movie.douban.com/'
                }
            });
            if (data && data.tags) {
                tags.value = data.tags;
                if (!tags.value.includes(currentTag.value)) {
                    currentTag.value = tags.value[0] || '热门';
                }
            }
        } catch (e) {
            console.error('Failed to fetch tags', e);
        }
    };

    const fetchSubjects = async (append = false) => {
        if (loading.value) return;
        loading.value = true;
        
        const url = `https://movie.douban.com/j/search_subjects?type=${currentType.value}&tag=${encodeURIComponent(currentTag.value)}&sort=recommend&page_limit=${pageSize}&page_start=${pageStart.value}`;
        
        try {
            const authParams = getAuthParams();
            const query = new URLSearchParams(authParams as any).toString();
            const proxyUrl = `/api/proxy/${encodeURIComponent(url)}?${query}`;
            
            const data: any = await $fetch(proxyUrl, {
                headers: {
                    'Referer': 'https://movie.douban.com/'
                }
            });
            
            if (data && data.subjects) {
                if (append) {
                    subjects.value = [...subjects.value, ...data.subjects];
                } else {
                    subjects.value = data.subjects;
                }
            }
        } catch (e) {
            console.error('Failed to fetch subjects', e);
        } finally {
            loading.value = false;
        }
    };

    const switchType = (type: string) => {
        if (currentType.value === type) return;
        currentType.value = type;
        currentTag.value = '热门';
        pageStart.value = 0;
        subjects.value = [];
        fetchTags().then(() => fetchSubjects());
    };

    const switchTag = (tag: string) => {
        if (currentTag.value === tag) return;
        currentTag.value = tag;
        pageStart.value = 0;
        fetchSubjects();
    };

    const loadMore = () => {
        pageStart.value += pageSize;
        fetchSubjects(true);
    };

    const refresh = () => {
         // "换一批" logic: just jump page
         pageStart.value += pageSize;
         if (pageStart.value > 100) pageStart.value = 0; // Reset after some pages
         fetchSubjects(false);
    };

    return {
        currentType,
        currentTag,
        tags,
        subjects,
        loading,
        fetchTags,
        fetchSubjects,
        switchType,
        switchTag,
        loadMore,
        refresh
    };
};
