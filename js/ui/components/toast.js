// Toast 提示组件

const queue = [];
let isShowing = false;

function showNext() {
    if (queue.length === 0) {
        isShowing = false;
        return;
    }

    isShowing = true;
    const { message, type } = queue.shift();

    let toast = document.getElementById('toast');
    let toastMessage = document.getElementById('toastMessage');

    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%) translateY(-100%);z-index:2147483647;opacity:0;transition:all 0.3s ease;';
        toastMessage = document.createElement('p');
        toastMessage.id = 'toastMessage';
        toast.appendChild(toastMessage);
        document.body.appendChild(toast);
    }

    const bgColors = {
        error: 'bg-red-500',
        success: 'bg-green-500',
        info: 'bg-blue-500',
        warning: 'bg-yellow-500'
    };

    toast.className = `px-6 py-3 rounded-lg shadow-lg text-white ${bgColors[type] || bgColors.error}`;
    toastMessage.textContent = message;

    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
    });

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(-100%)';
        setTimeout(showNext, 300);
    }, 3000);
}

/**
 * 显示 Toast 提示
 * @param {string} message - 提示内容
 * @param {string} type - 类型: error | success | info | warning
 */
export function showToast(message, type = 'error') {
    queue.push({ message, type });
    if (!isShowing) showNext();
}
