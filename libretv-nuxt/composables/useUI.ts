export const useUI = () => {
    const showSettings = useState('showSettings', () => false);
    const showHistory = useState('showHistory', () => false);

    const toggleSettings = () => showSettings.value = !showSettings.value;
    const toggleHistory = () => showHistory.value = !showHistory.value;

    return {
        showSettings,
        showHistory,
        toggleSettings,
        toggleHistory
    };
};
