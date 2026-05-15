// 密码验证弹窗组件

import { $, createElement } from '../../core/dom.js';
import { verifyPassword } from '../../services/auth-service.js';
import { eventBus } from '../../core/events.js';

let modalEl = null;
let isRendered = false;

function render() {
    if (isRendered) return;

    // 检查页面是否已有密码弹窗（HTML中内置）
    modalEl = document.getElementById('passwordModal');
    if (modalEl) {
        isRendered = true;
        return;
    }

    modalEl = createElement('div', {
        id: 'passwordModal',
        class: 'fixed inset-0 bg-black/95 hidden items-center justify-center z-[65] transition-opacity duration-300'
    }, [
        createElement('div', {
            class: 'bg-[#111] p-8 rounded-lg w-11/12 max-w-md border border-[#333] max-h-[90vh] flex flex-col'
        }, [
            createElement('div', { class: 'flex justify-between items-center mb-6 flex-none' }, [
                createElement('h2', {
                    class: 'text-2xl font-bold gradient-text',
                    text: '访问验证'
                })
            ]),
            createElement('div', { class: 'mb-6' }, [
                createElement('p', {
                    class: 'text-gray-300 mb-4',
                    text: '请输入密码继续访问'
                }),
                createElement('form', { id: 'passwordForm' }, [
                    createElement('input', {
                        type: 'password',
                        id: 'passwordInput',
                        class: 'w-full bg-[#111] border border-[#333] text-white px-4 py-3 rounded-lg focus:outline-none focus:border-white transition-colors',
                        placeholder: '密码...',
                        autocomplete: 'new-password'
                    }),
                    createElement('div', { class: 'mt-4 w-full flex space-x-4' }, [
                        createElement('button', {
                            type: 'submit',
                            class: 'flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded'
                        }, ['提交']),
                        createElement('button', {
                            type: 'button',
                            id: 'passwordCancelBtn',
                            class: 'flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded'
                        }, ['取消'])
                    ])
                ]),
                createElement('p', {
                    id: 'passwordError',
                    class: 'text-red-500 mt-2 hidden',
                    text: '密码错误，请重试'
                })
            ])
        ])
    ]);

    document.body.appendChild(modalEl);

    // 绑定事件
    $('passwordForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = $('passwordInput');
        const error = $('passwordError');
        const btn = document.querySelector('#passwordForm button[type="submit"]');

        btn.disabled = true;
        btn.textContent = '验证中...';
        error.classList.add('hidden');

        const ok = await verifyPassword(input.value);
        if (ok) {
            hidePasswordModal();
            eventBus.emit('auth:success');
        } else {
            error.classList.remove('hidden');
            input.value = '';
            input.focus();
        }

        btn.disabled = false;
        btn.textContent = '提交';
    });

    $('passwordCancelBtn').addEventListener('click', () => {
        hidePasswordModal();
    });

    isRendered = true;
}

export function showPasswordModal() {
    render();
    modalEl.classList.remove('hidden');
    modalEl.classList.add('flex');
    const input = $('passwordInput');
    if (input) {
        input.value = '';
        setTimeout(() => input.focus(), 100);
    }
    const error = $('passwordError');
    if (error) error.classList.add('hidden');
}

export function hidePasswordModal() {
    if (modalEl) {
        modalEl.classList.add('hidden');
        modalEl.classList.remove('flex');
    }
}
