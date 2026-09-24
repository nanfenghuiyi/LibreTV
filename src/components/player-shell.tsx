'use client';

import { useEffect, useRef, useState } from 'react';
import Artplayer from 'artplayer';
import Hls, { type HlsConfig } from 'hls.js';
import { filterAdsFromM3u8 } from '@/lib/m3u8';
import { formatTime } from '@/lib/utils';
import { useToast } from './toast';
import { useFocusTrap } from './use-focus-trap';
import { Icon } from './icon';

/**
 * 播放器外壳：ArtPlayer + hls.js（旧版 player.js 的 React 化）。
 * 保留：广告分片过滤、自动连播回调、进度回调、快捷键、移动端长按倍速、错误恢复。
 * 移除：DOM 手工操作、watch.html 跳转链、localStorage 状态总线。
 */

// 广告过滤 loader：拦截 manifest/level 响应文本，剔除 DISCONTINUITY 广告片段
class CustomHlsJsLoader extends Hls.DefaultConfig.loader {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(config: any) {
    super(config);
    const load = this.load.bind(this);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- hls.js loader 回调签名未导出精确类型
    this.load = function (context: any, config: any, callbacks: any) {
      if (context.type === 'manifest' || context.type === 'level') {
        const onSuccess = callbacks.onSuccess;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        callbacks.onSuccess = function (response: any, stats: any, ctx: any, networkDetails: any) {
          if (response.data && typeof response.data === 'string') {
            response.data = filterAdsFromM3u8(response.data);
          }
          return onSuccess(response, stats, ctx, networkDetails);
        };
      }
      load(context, config, callbacks);
    };
  }
}

// 复制到剪贴板：http 非安全上下文（局域网 IP 访问）下 navigator.clipboard 不可用，降级 execCommand
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  }
}

// 播放器控件图标（heroicons arrow-down-tray，描边风格，currentColor 随主题）
const COPY_LINK_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" width="22" height="22"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>';

// 强制走服务器代理：手机等环境直连 CDN 不稳定时由 NEXT_PUBLIC_FORCE_PROXY=1 开启
const FORCE_PROXY = process.env.NEXT_PUBLIC_FORCE_PROXY === '1';

// 代理偏好：用户在播放器设置里的选择（localStorage）优先，其次部署级默认环境变量
function proxyPreferred(): boolean {
  try {
    const saved = localStorage.getItem('forceProxy');
    if (saved !== null) return saved === '1';
  } catch { /* 隐私模式等 localStorage 不可用时退回部署默认 */ }
  return FORCE_PROXY;
}

interface PlayerShellProps {
  url: string;
  title: string;
  adFilter: boolean;
  autoplayNext: boolean;
  /** 进度恢复：优先 URL position，其次查询该回调（返回 0 表示无记录） */
  getRestorePosition?: () => number | Promise<number>;
  onTimeUpdate?: (position: number, duration: number) => void;
  onEnded?: () => void;
  onPause?: (position: number, duration: number) => void;
}

export function PlayerShell({
  url,
  title,
  adFilter,
  autoplayNext,
  getRestorePosition,
  onTimeUpdate,
  onEnded,
  onPause,
}: PlayerShellProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const artRef = useRef<any>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [error, setError] = useState('');
  const [hint, setHint] = useState('');
  // 视频链接弹窗：点击工具栏按钮后展示（iframe 内嵌预览 + 复制入口）
  const [urlModalOpen, setUrlModalOpen] = useState(false);
  const urlModalPanelRef = useRef<HTMLDivElement>(null);
  // 起播前的品牌占位图（沿用旧版 nomedia 素材），实际开始播放后隐藏
  const [showPoster, setShowPoster] = useState(true);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 用 ref 持有最新回调，避免重建播放器
  const cbs = useRef({ onTimeUpdate, onEnded, onPause, getRestorePosition });
  cbs.current = { onTimeUpdate, onEnded, onPause, getRestorePosition };
  const autoplayRef = useRef(autoplayNext);
  autoplayRef.current = autoplayNext;
  // 弹窗打开期间屏蔽播放器快捷键，避免空格/方向键穿透作用到底层播放器
  const urlModalOpenRef = useRef(false);
  urlModalOpenRef.current = urlModalOpen;
  const { toast } = useToast();

  // 弹窗打开期间：锁定背景滚动 + Esc 关闭（焦点圈闭由 useFocusTrap 负责）
  useEffect(() => {
    if (!urlModalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setUrlModalOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', handler);
    };
  }, [urlModalOpen]);
  useFocusTrap(urlModalOpen, urlModalPanelRef);

  const handleCopyUrl = () => {
    copyToClipboard(url).then((ok) =>
      toast(
        ok ? '视频链接已复制，可用下载工具直接下载' : '复制失败，请手动复制地址栏链接',
        ok ? 'success' : 'error',
      ),
    );
  };

  useEffect(() => {
    if (!containerRef.current || !url) return;
    setError('');
    setShowPoster(true);

    // 换集时清理函数在「新回调已挂到 ref 上」之后才执行，
    // 卸载前保存进度必须用本次挂载（本集）的回调，否则会把上一集的
    // 播放位置写进新集数的进度记录，导致换集后从上一集的时间点继续播放
    const mountCbs = { onTimeUpdate, onEnded, onPause, getRestorePosition };

    let lastSave = 0;
    let playbackStarted = false;
    let errorCount = 0;
    let ended = false;

    const showHint = (text: string) => {
      setHint(text);
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
      hintTimerRef.current = setTimeout(() => setHint(''), 2500);
    };

    const hlsConfig: Partial<HlsConfig> = {
      debug: false,
      enableWorker: true,
      backBufferLength: 90,
      maxBufferLength: 30,
      maxMaxBufferLength: 60,
      maxBufferSize: 30 * 1000 * 1000,
      maxBufferHole: 0.5,
      // 直连快速失败：manifest 8s 单次超时即报错，让代理回退尽快触发，避免长时间转圈
      manifestLoadingTimeOut: 8000,
      manifestLoadingMaxRetry: 0,
      manifestLoadingRetryDelay: 500,
      levelLoadingTimeOut: 8000,
      levelLoadingMaxRetry: 0,
      fragLoadingTimeOut: 15000,
      fragLoadingMaxRetry: 2,
      fragLoadingRetryDelay: 1000,
      startLevel: -1,
      abrEwmaDefaultEstimate: 500_000,
      appendErrorMaxRetry: 5,
    };
    if (adFilter) hlsConfig.loader = CustomHlsJsLoader as unknown as HlsConfig['loader'];

    /**
     * 初始化 HLS。allowProxyFallback：直连致命网络错误（CORS/防盗链/分片被拒）时，
     * 自动改走同源 cookie 鉴权的 /api/proxy 重试一次。
     * resumeAt：切代理/直连重建加载时恢复的播放位置（秒），0 表示从头开始。
     */
    const setupHls = (
      video: HTMLVideoElement,
      mediaUrl: string,
      allowProxyFallback: boolean,
      resumeAt = 0,
    ) => {
      hlsRef.current?.destroy();
      const hls = new Hls(hlsConfig);
      hlsRef.current = hls;

      hls.loadSource(mediaUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (resumeAt > 1) video.currentTime = resumeAt;
        video.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_evt, data) => {
        errorCount++;
        if (data.fatal && !playbackStarted) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              if (
                allowProxyFallback &&
                !mediaUrl.startsWith('/api/proxy/') &&
                (errorCount >= 2 || data.details === 'manifestLoadError')
              ) {
                showHint('直连失败，改用代理重试...');
                setupHls(video, `/api/proxy/${encodeURIComponent(mediaUrl)}`, false);
                return;
              }
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              if (errorCount > 3) {
                setError('视频加载失败，可能是格式不兼容或源不可用，请尝试其他视频源');
              }
          }
        }
      });
    };

    const art = new Artplayer({
      container: containerRef.current,
      url,
      type: 'm3u8',
      volume: 0.8,
      autoplay: true,
      pip: true,
      autoMini: true,
      screenshot: true,
      setting: true,
      playbackRate: true,
      aspectRatio: true,
      fullscreen: true,
      fullscreenWeb: true,
      miniProgressBar: true,
      mutex: true,
      backdrop: true,
      playsInline: true,
      airplay: true,
      hotkey: false,
      theme: '#2563eb',
      lang: navigator.language.toLowerCase().startsWith('zh') ? 'zh-cn' : 'en',
      moreVideoAttr: { crossOrigin: 'anonymous', playsInline: true },
      controls: [
        {
          name: 'copy-link',
          index: 20,
          position: 'right',
          html: COPY_LINK_ICON,
          tooltip: '查看视频链接',
          click: () => {
            // 原生全屏只渲染播放器容器，弹窗会被遮挡，先退出全屏再打开
            art.fullscreen = false;
            art.fullscreenWeb = false;
            setUrlModalOpen(true);
          },
        },
      ],
      customType: {
        m3u8: (video: HTMLVideoElement, mediaUrl: string) => {
          if (proxyPreferred()) {
            setupHls(video, `/api/proxy/${encodeURIComponent(mediaUrl)}`, false);
          } else {
            setupHls(video, mediaUrl, true);
          }
        },
      },
    });
    artRef.current = art;
    // 设置项用运行时 API 添加（构造参数的 setting 仅接受 boolean）
    art.setting.add({
      html: '服务器代理',
      tooltip: '直连失败时更稳定',
      switch: proxyPreferred(),
      onSwitch: () => {
        const next = !proxyPreferred();
        try {
          localStorage.setItem('forceProxy', next ? '1' : '0');
        } catch { /* 隐私模式等 localStorage 不可用时仅本次生效 */ }
        const video = art.video as HTMLVideoElement | undefined;
        if (video) {
          // 从当前进度无缝重建：直连失败时切换此开关可立即恢复播放
          setupHls(
            video,
            next ? `/api/proxy/${encodeURIComponent(url)}` : url,
            false,
            video.currentTime,
          );
        }
        // 返回值会被 ArtPlayer 赋给 item.switch，控制开关 UI 翻转
        return next;
      },
    });
    art.on('video:loadedmetadata', () => {
      // ArtPlayer 运行时支持 title 选项（类型定义未覆盖），用于界面标题展示
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (art as any).title = title;
      } catch { /* 忽略 */ }
    });

    art.on('ready', () => {
      // 进度恢复
      const restore = async () => {
        const saved = (await cbs.current.getRestorePosition?.()) ?? 0;
        const duration = art.duration || 0;
        if (saved > 10 && duration > 0 && saved < duration - 2) {
          art.currentTime = saved;
          showHint(`已从 ${formatTime(saved)} 继续播放`);
        }
      };
      restore();
    });

    art.on('video:playing', () => {
      playbackStarted = true;
      setShowPoster(false);
      setError('');
    });
    art.on('video:error', () => {
      setError('视频播放失败，请尝试其他视频源');
    });
    art.on('video:timeupdate', () => {
      const now = Date.now();
      if (now - lastSave > 5000) {
        lastSave = now;
        cbs.current.onTimeUpdate?.(art.currentTime, art.duration);
      }
    });
    art.on('video:pause', () => {
      cbs.current.onPause?.(art.currentTime, art.duration);
    });
    art.on('video:ended', () => {
      ended = true;
      cbs.current.onEnded?.();
    });

    // —— 键盘快捷键（旧版 hotkey:false + 自定义逻辑的移植） ——
    const shortcuts = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // 输入框或按钮获得焦点时不劫持按键：否则空格会吞掉按钮的默认激活
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.closest('button')) return;
      // 链接弹窗打开时不劫持按键：空格/方向键/全屏快捷键不应作用到底层播放器
      if (urlModalOpenRef.current) return;
      const current = artRef.current;
      if (!current) return;
      if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); return; } // 由父层处理集数切换
      if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); return; }
      switch (e.key) {
        case 'ArrowLeft':
          if (current.currentTime > 5) { current.currentTime -= 5; showHint('快退 5s'); e.preventDefault(); }
          break;
        case 'ArrowRight':
          if (current.duration - current.currentTime > 5) { current.currentTime += 5; showHint('快进 5s'); e.preventDefault(); }
          break;
        case 'ArrowUp':
          if (current.volume < 1) { current.volume = Math.min(1, current.volume + 0.1); showHint(`音量 ${Math.round(current.volume * 100)}%`); e.preventDefault(); }
          break;
        case 'ArrowDown':
          if (current.volume > 0) { current.volume = Math.max(0, current.volume - 0.1); showHint(`音量 ${Math.round(current.volume * 100)}%`); e.preventDefault(); }
          break;
        case ' ':
          current.toggle(); showHint('播放/暂停'); e.preventDefault();
          break;
        case 'f': case 'F':
          current.fullscreen = !current.fullscreen; e.preventDefault();
          break;
      }
    };
    document.addEventListener('keydown', shortcuts);

    // —— 移动端长按 3 倍速 ——
    let longPressTimer: ReturnType<typeof setTimeout> | null = null;
    let isLongPress = false;
    let originalRate = 1.0;
    const el = containerRef.current;

    const onTouchStart = (e: TouchEvent) => {
      if (art.video?.paused) return;
      originalRate = art.video.playbackRate;
      longPressTimer = setTimeout(() => {
        if (art.video?.paused) return;
        art.video.playbackRate = 3.0;
        isLongPress = true;
        showHint('3 倍速');
        e.preventDefault();
      }, 500);
    };
    const onTouchEnd = () => {
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
      if (isLongPress) {
        art.video.playbackRate = originalRate;
        isLongPress = false;
        showHint(`${originalRate} 倍速`);
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (isLongPress) e.preventDefault();
    };
    el?.addEventListener('touchstart', onTouchStart, { passive: false });
    el?.addEventListener('touchend', onTouchEnd);
    el?.addEventListener('touchcancel', onTouchEnd);
    el?.addEventListener('touchmove', onTouchMove, { passive: false });

    // 双击全屏由 ArtPlayer 原生 DBCLICK_FULLSCREEN 处理（video:dblclick 不在其事件代理列表中，监听无效）

    // 卸载与页面隐藏时保存进度
    const saveOnHide = () => {
      if (document.visibilityState === 'hidden') {
        cbs.current.onPause?.(art.currentTime, art.duration);
      }
    };
    document.addEventListener('visibilitychange', saveOnHide);

    return () => {
      // 卸载前刷一次最终进度，避免丢失最后几秒。
      // 注意用 mountCbs（本集回调）而非 cbs.current（已是下一集的回调）；
      // 已自然播完的集数不回写，避免覆盖 onEnded 里清除的「已看完」记录
      if (!ended) {
        try {
          mountCbs.onPause?.(art.currentTime, art.duration);
        } catch { /* 忽略 */ }
      }
      document.removeEventListener('keydown', shortcuts);
      document.removeEventListener('visibilitychange', saveOnHide);
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
      el?.removeEventListener('touchstart', onTouchStart);
      el?.removeEventListener('touchend', onTouchEnd);
      el?.removeEventListener('touchcancel', onTouchEnd);
      el?.removeEventListener('touchmove', onTouchMove);
      hlsRef.current?.destroy();
      hlsRef.current = null;
      art.destroy();
      artRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, adFilter]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      {showPoster && !error && (
        <div
          className="absolute inset-0 bg-black pointer-events-none"
          style={{
            backgroundImage: 'url(/player-poster.png)',
            backgroundSize: 'contain',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        />
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80">
          <p className="text-danger text-sm">{error}</p>
          <button className="btn-ghost text-xs" onClick={() => location.reload()}>
            重新加载
          </button>
        </div>
      )}
      {hint && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 text-white text-sm px-3 py-1.5 rounded-full pointer-events-none animate-fade-in">
          {hint}
        </div>
      )}
      {autoplayNext && !error && (
        <div className="absolute bottom-16 right-3 text-[10px] text-muted bg-black/50 px-2 py-0.5 rounded pointer-events-none">
          自动连播已开启
        </div>
      )}
      {urlModalOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setUrlModalOpen(false);
          }}
        >
          <div
            ref={urlModalPanelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="视频链接"
            className="bg-surface-raised rounded-xl w-full max-w-2xl shadow-2xl animate-slide-up outline-none flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-line shrink-0">
              <h2 className="text-base font-semibold text-content">视频链接</h2>
              <button
                className="p-1.5 rounded-md text-muted hover:text-content hover:bg-hover"
                onClick={() => setUrlModalOpen(false)}
                aria-label="关闭"
              >
                <Icon name="close" />
              </button>
            </div>
            <iframe src={url} title="视频链接预览" className="w-full h-[60vh] bg-white" />
            <div className="px-5 py-3 border-t border-line space-y-1.5 shrink-0">
              <div className="flex items-center gap-2">
                <p className="flex-1 min-w-0 text-xs text-faint truncate select-text" title={url}>
                  {url}
                </p>
                <button
                  className="btn text-sm text-white bg-accent hover:bg-accent-hover shrink-0"
                  onClick={handleCopyUrl}
                >
                  复制链接
                </button>
              </div>
              <p className="text-xs text-faint">若上方空白，说明源站禁止内嵌展示，可复制链接交给下载工具直接下载</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
