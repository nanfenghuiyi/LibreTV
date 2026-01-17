
import { API_CONFIG, API_SITES, CUSTOM_API_CONFIG } from '~/utils/config';

export const useVideoApi = () => {
    const { getAuthParams } = useAuth();
    
    const fetchApi = async (url: string, options: any = {}) => {
        const authParams = getAuthParams();
        const query = new URLSearchParams(authParams as any).toString();
        
        // Proxy URL construction
        const proxyUrl = `/api/proxy/${encodeURIComponent(url)}?${query}`;
        
        const response = await $fetch(proxyUrl, {
            ...options,
            headers: {
                ...options.headers,
                'Accept': 'application/json'
            }
        });

        if (typeof response === 'string') {
            try {
                return JSON.parse(response);
            } catch (e) {
                console.warn('Failed to parse API response:', e);
                return response;
            }
        }
        return response;
    };

    const searchWithConfig = async (query: string, sourceKey: string, sourceConfig: any) => {
        if (!sourceConfig) return [];
        // Ensure URL ends with / if needed? Original code implies full URL in config for custom?
        // Actually builtin uses base + path.
        // Custom input is "API 地址 (http...)". Usually this is the 'provide/vod/' part.
        // Let's assume standard Maccms format.
        
        let apiUrl = sourceConfig.api;
        if (!apiUrl.endsWith('/')) apiUrl += '/'; // Try to ensure slash? Or not? 
        // Existing config has slash at end.
        
        // However, if user input full url like `.../api.php/provide/vod`, usually we append `?ac=videolist...`.
        // API_CONFIG.search.path starts with `?`.
        // So concatenating is fine.

        const url = `${apiUrl}${API_CONFIG.search.path}${encodeURIComponent(query)}`;
        
        try {
            const data: any = await fetchApi(url);
            console.log(`Search result for ${sourceKey}:`, data);
            if (!data || !data.list) return [];
            
            return data.list.map((item: any) => ({
                ...item,
                source_name: sourceConfig.name,
                source_code: sourceKey
            }));
        } catch (e) {
            console.error(`Search error for ${sourceKey}:`, e);
            return [];
        }
    };

    const search = async (query: string, sourceKey: string) => {
        // Legacy support if needed, or alias to searchWithConfig using global constant
        return searchWithConfig(query, sourceKey, API_SITES[sourceKey]);
    };

    const handleAggregatedSearch = async (query: string) => {
        const { customSources, showAdult } = useSettings();
        
        // Merge builtin sites and custom sources
        const allSites = { ...API_SITES };
        customSources.value.forEach((src: any, index: number) => {
            allSites[`custom_${index}`] = {
                api: src.url,
                name: src.name,
                adult: src.isAdult || false // Default to false if undefined
            };
        });

        // Filter keys
        let sourceKeys = Object.keys(allSites).filter(k => k !== 'testSource');
        
        // Filter by Enabled Sources (if initialized)
        const { enabledSources } = useSettings();
        if (enabledSources.value.length > 0) {
            sourceKeys = sourceKeys.filter(k => enabledSources.value.includes(k));
        }

        // Apply Adult Filter
        if (!showAdult.value) {
            sourceKeys = sourceKeys.filter(k => !allSites[k].adult);
        }

        // Use filtered keys for search
        const promises = sourceKeys.map(s => {
             // For custom sources, we need to handle them carefully. 
             // search() expects API_SITES[key] to be present.
             // But we just constructed `allSites` locally.
             // So we need to modify search() or pass the site config directly.
             // Better: Temporarily extend API_SITES or modify search() to look up in allSites?
             // Actually, API_SITES is constant. We should pass the site object to search().
             // But search(query, sourceKey) logic relies on API_SITES[sourceKey].
             // Let's modify search() signature or logic.
             return searchWithConfig(query, s, allSites[s]);
        });
        
        const results = await Promise.allSettled(promises);
        const flatResults: any[] = [];
        
        results.forEach(res => {
            if (res.status === 'fulfilled' && res.value) {
                flatResults.push(...res.value);
            }
        });
        
        // Deduplicate and sort
        const seen = new Set();
        return flatResults.filter(item => {
            const key = `${item.source_code}_${item.vod_id}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    };

    const getDetail = async (id: string, sourceKey: string) => {
         const { customSources } = useSettings();
         let source = API_SITES[sourceKey];
         
         if (!source && sourceKey.startsWith('custom_')) {
             const index = parseInt(sourceKey.replace('custom_', ''));
             const custom = customSources.value[index];
             if (custom) {
                 source = {
                     api: custom.url,
                     name: custom.name,
                     detail: custom.detail,
                     adult: custom.isAdult
                 };
             }
         }

         if (!source) throw new Error('Invalid source');
         
         // Use detail path if provided, otherwise standard
         const url = source.detail ? 
            `${source.detail}/api.php/provide/vod/?ac=detail&ids=${id}` :
            `${source.api}${API_CONFIG.detail.path}${id}`;
         
         try {
             const data: any = await fetchApi(url);
             console.log(`Detail response for ${id} from ${sourceKey}:`, data);
             if (!data || !data.list || !data.list[0]) throw new Error('No detail found');
             
             const detail = data.list[0];
             
             let episodes: string[] = [];
             let playList: { from: string, episodes: string[] }[] = [];
             
             if (detail.vod_play_url) {
                 const playSources = detail.vod_play_url.split('$$$');
                 const fromSources = detail.vod_play_from ? detail.vod_play_from.split('$$$') : [];
                 
                 playList = playSources.map((sourceStr: string, index: number) => {
                     const episodeList = sourceStr.split('#');
                     const parsedEpisodes = episodeList.map((ep: string) => {
                         return ep;
                     }).filter((ep: string) => ep.includes('http'));
                     
                     return {
                         from: fromSources[index] || `线路 ${index + 1}`,
                         episodes: parsedEpisodes
                     };
                 }).filter((src: any) => src.episodes.length > 0);
                 
                 // Default episodes for backward compatibility (matches UI expectation)
                 episodes = playList[0]?.episodes || [];
             }
             
             return {
                 ...detail,
                 episodes,
                 playList, // All sources for switcher
                 source_name: source.name,
                 source_code: sourceKey
             };
         } catch (e) {
             console.error(`Detail error name ${sourceKey}:`, e);
             throw e;
         }
    };

    return {
        search,
        handleAggregatedSearch,
        getDetail
    };
};
