// Loading 加载组件

let loadingTimeoutId = null;

/**
 * 显示加载提示
 * @param {string} message - 提示文字
 */
export function showLoading(message = '加载中...') {
    clearTimeout(loadingTimeoutId);

    let loading = document.getElementById('loading');
    if (!loading) {
        loading = document.createElement('div');
        loading.id = 'loading';
        loading.className = 'fixed inset-0 bg-black/80 hidden items-center justify-center z-50';
        loading.innerHTML = `
            <div class="bg-[#111] p-8 rounded-lg border border-[#333] flex items-center space-x-4">
                <div class="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                <p class="text-white text-lg" id="loadingText">加载中...</p>
            </div>
        `;
        document.body.appendChild(loading);
    }

    const textEl = document.getElementById('loadingText');
    if (textEl) textEl.textContent = message;

    loading.classList.remove('hidden');
    loading.classList.add('flex');
}

/**
 * 隐藏加载提示
 */
export function hideLoading() {
    const loading = document.getElementById('loading');
    if (loading) {
        loadingTimeoutId = setTimeout(() => {
            loading.classList.add('hidden');
            loading.classList.remove('flex');
        }, 200);
    }
}
