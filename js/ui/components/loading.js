// Loading 加载组件

let loadingTimeoutId = null;
let loadingVisible = false;

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
        loading.className = 'fixed inset-0 bg-black/80 items-center justify-center z-50';
        loading.style.cssText = 'display:none;position:fixed;top:0;left:0;width:100%;height:100%;align-items:center;justify-content:center;z-index:9999;';
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

    loading.style.display = 'flex';
    loading.classList.remove('hidden');
    loadingVisible = true;
}

/**
 * 隐藏加载提示
 */
export function hideLoading() {
    const loading = document.getElementById('loading');
    if (!loading) return;

    loadingTimeoutId = setTimeout(() => {
        loading.style.display = 'none';
        loading.classList.add('hidden');
        loadingVisible = false;
    }, 200);
}
