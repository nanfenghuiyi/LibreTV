// localStorage key 统一管理
// 旧版 key 无前缀，新版通过 storage.js 自动迁移

export const StorageKeys = Object.freeze({
    // API 与数据源
    SELECTED_APIS: 'selectedAPIs',
    CUSTOM_APIS: 'customAPIs',

    // 播放器状态
    CURRENT_VIDEO_TITLE: 'currentVideoTitle',
    CURRENT_EPISODES: 'currentEpisodes',
    CURRENT_EPISODE_INDEX: 'currentEpisodeIndex',
    CURRENT_SOURCE_CODE: 'currentSourceCode',
    CURRENT_PLAYING_ID: 'currentPlayingId',
    CURRENT_PLAYING_SOURCE: 'currentPlayingSource',
    AUTOPLAY_ENABLED: 'autoplayEnabled',
    EPISODES_REVERSED: 'episodesReversed',

    // 历史记录
    VIEWING_HISTORY: 'viewingHistory',
    SEARCH_HISTORY: 'videoSearchHistory',

    // 设置与开关
    YELLOW_FILTER_ENABLED: 'yellowFilterEnabled',
    DOUBAN_ENABLED: 'doubanEnabled',
    SEARCH_SORT_ORDER: 'searchSortOrder',

    // 认证
    PASSWORD_VERIFIED: 'passwordVerified',
    PASSWORD_HASH: 'passwordHash',
    PROXY_AUTH_HASH: 'proxyAuthHash',
    USER_PASSWORD: 'userPassword',

    // 页面导航
    LAST_PAGE_URL: 'lastPageUrl',
    LAST_SEARCH_PAGE: 'lastSearchPage',
    CAME_FROM_SEARCH: 'cameFromSearch',
    SEARCH_PAGE_URL: 'searchPageUrl',

    // 豆瓣标签
    USER_MOVIE_TAGS: 'userMovieTags',
    USER_TV_TAGS: 'userTvTags',

    // 初始化标记
    HAS_INITIALIZED_DEFAULTS: 'hasInitializedDefaults',

    // 弹窗
    HAS_SEEN_DISCLAIMER: 'hasSeenDisclaimer'
});

// DOM 元素 ID 常量
export const DOM_IDS = Object.freeze({
    // 搜索
    SEARCH_INPUT: 'searchInput',
    SEARCH_RESULTS: 'results',
    RESULTS_AREA: 'resultsArea',
    SEARCH_AREA: 'searchArea',
    SEARCH_RESULTS_COUNT: 'searchResultsCount',
    SORT_SELECT: 'sortSelect',
    TYPE_FILTERS: 'typeFilters',
    RECENT_SEARCHES: 'recentSearches',
    CLEAR_SEARCH_INPUT: 'clearSearchInput',

    // 面板
    SETTINGS_PANEL: 'settingsPanel',
    HISTORY_PANEL: 'historyPanel',
    HISTORY_LIST: 'historyList',

    // API 管理
    API_CHECKBOXES: 'apiCheckboxes',
    CUSTOM_APIS_LIST: 'customApisList',
    ADD_CUSTOM_API_FORM: 'addCustomApiForm',
    IMPORT_CUSTOM_API_FORM: 'importCustomApiForm',
    SELECTED_API_COUNT: 'selectedApiCount',

    // 豆瓣
    DOUBAN_AREA: 'doubanArea',
    DOUBAN_RESULTS: 'douban-results',
    DOUBAN_TAGS: 'douban-tags',

    // 弹窗
    MODAL: 'modal',
    MODAL_TITLE: 'modalTitle',
    MODAL_CONTENT: 'modalContent',
    PASSWORD_MODAL: 'passwordModal',
    PASSWORD_INPUT: 'passwordInput',
    PASSWORD_ERROR: 'passwordError',
    DISCLAIMER_MODAL: 'disclaimerModal',
    URL_IMPORT_MODAL: 'urlImportModal',

    // 反馈
    TOAST: 'toast',
    TOAST_MESSAGE: 'toastMessage',
    LOADING: 'loading',
    SITE_STATUS: 'siteStatus',

    // 播放器
    PLAYER: 'player',
    PLAYER_CONTAINER: 'playerContainer',
    PLAYER_LOADING: 'player-loading',
    ERROR: 'error',
    ERROR_MESSAGE: 'error-message',
    VIDEO_TITLE: 'videoTitle',
    EPISODE_INFO: 'episodeInfo',
    RESOURCE_INFO_BAR: 'resourceInfoBarContainer',
    PREV_BUTTON: 'prevButton',
    NEXT_BUTTON: 'nextButton'
});

// 事件名称
export const Events = Object.freeze({
    SEARCH_STARTED: 'search:started',
    SEARCH_COMPLETED: 'search:completed',
    SEARCH_ERROR: 'search:error',
    SETTINGS_CHANGED: 'settings:changed',
    HISTORY_UPDATED: 'history:updated',
    EPISODE_CHANGED: 'episode:changed',
    SOURCE_SWITCHED: 'source:switched'
});
