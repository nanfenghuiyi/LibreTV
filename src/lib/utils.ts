/** 站点名称与标题：layout metadata 与播放页 document.title 共用，避免硬编码重复 */
export const SITE_NAME = 'LibreTV';
export const SITE_DEFAULT_TITLE = `${SITE_NAME} - 免费在线视频搜索与观看平台`;
export function pageTitleOf(title: string): string {
  return `${title} - ${SITE_NAME}`;
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}小时前`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}天前`;
  const d = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 停用时长的可读文案：不足 1 小时按分钟，超过按小时（按剩余时间展示时向上取整） */
export function formatDisableTtl(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  return minutes >= 60 ? `${Math.round(minutes / 60)} 小时` : `${minutes} 分钟`;
}

export async function sha256Hex(input: string): Promise<string> {
  const buffer = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * 封面图加载地址：direct 直连 / proxy 内置代理 / custom 自定义模板（{url} 占位符或直接拼接）。
 * 默认 proxy（内置代理），规避豆瓣防盗链与部分采集站图床直连失败。
 */
export function buildImageUrl(
  url: string | undefined,
  mode: 'direct' | 'proxy' | 'custom',
  customTemplate: string
): string | undefined {
  if (!url) return undefined;
  if (mode === 'proxy') return `/api/proxy/${encodeURIComponent(url)}`;
  if (mode === 'custom' && customTemplate) {
    return customTemplate.includes('{url}')
      ? customTemplate.replace('{url}', encodeURIComponent(url))
      : customTemplate + encodeURIComponent(url);
  }
  return url;
}

export function normalizeSourceUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export function validateSourceUrl(url: string): boolean {
  return /^https?:\/\/.+/.test(url);
}

/** 取 hostname 作为名称兜底；地址非法时原样返回 */
export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/** 为分享链接等场景构造观看页 URL */
export function buildWatchUrl(params: {
  sourceKey: string;
  vodId?: string;
  index?: number;
  title?: string;
  episodeUrl?: string;
  sourceUrl?: string;
  detail?: string;
}): string {
  const sp = new URLSearchParams();
  sp.set('source', params.sourceKey);
  if (params.vodId) sp.set('id', params.vodId);
  if (typeof params.index === 'number') sp.set('index', String(params.index));
  if (params.title) sp.set('title', params.title);
  if (params.episodeUrl) sp.set('url', params.episodeUrl);
  if (params.sourceUrl) sp.set('sourceUrl', params.sourceUrl);
  if (params.detail) sp.set('detail', params.detail);
  return `/watch?${sp.toString()}`;
}

/** 下载文件名最大长度：超出的标题截断，避免超长文件名在各端表现异常 */
const MAX_FILENAME_LENGTH = 80;

/**
 * 清洗为可安全落盘的文件名：剔除控制字符与路径分隔符（防头部注入/目录穿越），
 * 去首尾空白与点号，超长截断；清洗后为空时回退到 fallback。
 * 供代理下载的 Content-Disposition 与前端 download 属性共用。
 */
export function sanitizeFilename(name: string, fallback = 'video'): string {
  const cleaned = name
    .replace(/[\x00-\x1f\x7f]/g, '')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(0, MAX_FILENAME_LENGTH)
    .trim();
  return cleaned || fallback;
}
