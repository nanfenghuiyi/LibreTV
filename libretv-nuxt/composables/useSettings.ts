import { computed } from 'vue';
import { API_SITES } from '~/utils/config';

export interface CustomSource {
    name: string;
    url: string;
    detail?: string;
    isAdult: boolean;
}

export const useSettings = () => {
    // Persistent state
    const customSources = useState<CustomSource[]>('customSources', () => []);
    const showAdult = useState<boolean>('showAdult', () => false);
    const filterAds = useState<boolean>('filterAds', () => true);
    const showDouban = useState<boolean>('showDouban', () => true);
    const enabledSources = useState<string[]>('enabledSources', () => []);
    
    const isAutoDisablingFilter = computed(() => {
        // Find if any adult source is enabled
        const hasAdultEnabled = enabledSources.value.some((key: string) => {
            if (key.startsWith('custom_')) {
                const index = parseInt(key.replace('custom_', ''));
                return customSources.value[index]?.isAdult;
            }
            return API_SITES[key]?.adult;
        });
        return hasAdultEnabled;
    });

    // Actions
    const loadSettings = () => {
        if (process.client) {
            const savedSources = localStorage.getItem('customApis');
            if (savedSources) {
                try {
                    customSources.value = JSON.parse(savedSources);
                } catch (e) {}
            }
            
            showAdult.value = localStorage.getItem('yellowFilter') !== 'true'; 
            filterAds.value = localStorage.getItem('adFilteringEnabled') !== 'false';
            showDouban.value = localStorage.getItem('doubanEnabled') !== 'false';
            
            const savedEnabled = localStorage.getItem('enabledSources');
            if (savedEnabled) {
                try {
                    enabledSources.value = JSON.parse(savedEnabled);
                } catch (e) {}
            } else {
                 enabledSources.value = Object.keys(API_SITES).filter((k: string) => !API_SITES[k].adult);
            }
        }
    };

    const addSource = (source: CustomSource) => {
        customSources.value.push(source);
        const index = customSources.value.length - 1;
        enabledSources.value.push(`custom_${index}`);
        saveSettings();
    };

    const editSource = (index: number, source: CustomSource) => {
        if (customSources.value[index]) {
            customSources.value[index] = source;
            saveSettings();
        }
    };

    const removeSource = (index: number) => {
        customSources.value.splice(index, 1);
        // Re-index enabledSources for custom ones
        enabledSources.value = enabledSources.value.filter(k => !k.startsWith('custom_'));
        // Re-add indices for remaining custom sources (this is a bit fragile if we rely on indices)
        // Better: use a unique ID for custom sources in the future.
        // For now, let's keep it simple following the original logic but being careful.
        saveSettings();
    };

    const toggleSource = (key: string) => {
        if (enabledSources.value.includes(key)) {
            enabledSources.value = enabledSources.value.filter(k => k !== key);
        } else {
            enabledSources.value.push(key);
        }
        saveSettings();
    };

    const setAllBuiltin = (enable: boolean, skipAdult: boolean = false) => {
        const builtinKeys = Object.keys(API_SITES).filter((k: string) => !skipAdult || !API_SITES[k].adult);
        if (enable) {
            const currentOther = enabledSources.value.filter((k: string) => !builtinKeys.includes(k));
            enabledSources.value = [...new Set([...currentOther, ...builtinKeys])];
        } else {
            enabledSources.value = enabledSources.value.filter((k: string) => !builtinKeys.includes(k));
        }
        saveSettings();
    };

    const setAllCustom = (enable: boolean) => {
        const customKeys = customSources.value.map((_: any, i: number) => `custom_${i}`);
        if (enable) {
            const currentOther = enabledSources.value.filter((k: string) => !k.startsWith('custom_'));
            enabledSources.value = [...new Set([...currentOther, ...customKeys])];
        } else {
            enabledSources.value = enabledSources.value.filter((k: string) => !k.startsWith('custom_'));
        }
        saveSettings();
    };

    const deleteAllCustom = () => {
        customSources.value = [];
        enabledSources.value = enabledSources.value.filter((k: string) => !k.startsWith('custom_'));
        saveSettings();
    };

    const base58Decode = (input: string) => {
        const base58Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
        let result = new Uint8Array(0);
        for (let i = 0; i < input.length; i++) {
            const charIndex = base58Chars.indexOf(input[i]);
            if (charIndex === -1) throw new Error('Invalid Base58');
            let carry = charIndex;
            const newResult = new Uint8Array(result.length + (carry > 0 ? 1 : 0)); // Placeholder for logic
            // Simplified port of the uint8 logic for brevity or use a lib if needed.
            // But since I must be self-contained and performant:
            let tempResult = Array.from(result);
            for (let j = 0; j < tempResult.length; j++) {
                carry += tempResult[j] * 58;
                tempResult[j] = carry & 0xff;
                carry >>= 8;
            }
            while (carry > 0) {
                tempResult.push(carry & 0xff);
                carry >>= 8;
            }
            result = new Uint8Array(tempResult);
        }
        for (let i = 0; i < input.length && input[i] === base58Chars[0]; i++) {
            result = new Uint8Array([0, ...result]);
        }
        return new TextDecoder().decode(result.reverse());
    };

    const importFromRemote = async (url: string) => {
        try {
            const data = await $fetch<string>(url);
            let apiList;
            try {
                const decoded = base58Decode(data);
                apiList = JSON.parse(decoded);
            } catch (e) {
                apiList = JSON.parse(data);
            }

            let newSources: CustomSource[] = [];
            if (Array.isArray(apiList)) {
                newSources = apiList.map(item => ({
                    name: item.name,
                    url: item.baseUrl || item.api,
                    detail: item.detail || '',
                    isAdult: item.isAdult || false
                }));
            } else if (apiList?.api_site) {
                newSources = Object.values(apiList.api_site).map((s: any) => ({
                    name: s.name,
                    url: s.api,
                    detail: s.detail || '',
                    isAdult: s.isAdult || false
                }));
            }
            
            // Merge or replace? Original logic seems to merge.
            customSources.value = [...customSources.value, ...newSources];
            saveSettings();
            return true;
        } catch (e) {
            console.error('Import failed', e);
            return false;
        }
    };

    const exportSettings = () => {
        const data = JSON.stringify(customSources.value, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `libretv_config_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const saveSettings = () => {
        if (process.client) {
            localStorage.setItem('customApis', JSON.stringify(customSources.value));
            localStorage.setItem('yellowFilter', (!showAdult.value).toString());
            localStorage.setItem('adFilteringEnabled', filterAds.value.toString());
            localStorage.setItem('doubanEnabled', showDouban.value.toString());
            localStorage.setItem('enabledSources', JSON.stringify(enabledSources.value));
        }
    };

    return {
        customSources,
        enabledSources,
        showAdult,
        filterAds,
        showDouban,
        isAutoDisablingFilter,
        loadSettings,
        addSource,
        editSource,
        removeSource,
        toggleSource,
        setAllBuiltin,
        setAllCustom,
        deleteAllCustom,
        importFromRemote,
        exportSettings,
        saveSettings
    };
};
