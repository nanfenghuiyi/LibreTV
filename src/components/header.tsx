'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ThemeToggle } from './theme';
import { SourceManagerDrawer } from './source-manager';
import { HistoryPanel } from './history-panel';
import { Icon, type IconName } from './icon';
import { SearchHistoryDropdown, useSearchHistory } from './search-history';
import { useAuth } from './auth';
import { useToast } from './toast';
import { api } from '@/lib/client-api';
import { cn } from '@/lib/utils';

/** 顶部导航：Logo、搜索框（首页外）、历史、设置、用户菜单 */
export function Header({ showSearch = false }: { showSearch?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const { verified, user, userSystemAvailable, logout } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);
  // 设置抽屉的强制初始页签：管理面板入口用，普通齿轮打开时为 undefined（恢复上次位置）
  const [initialPrimary, setInitialPrimary] = useState<'admin' | undefined>(undefined);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [query, setQuery] = useState('');
  const userMenuRef = useRef<HTMLDivElement>(null);
  // 与首页搜索框共用同一套「最近搜索」下拉逻辑
  const searchHistory = useSearchHistory(query);

  // 点击菜单外部时关闭用户菜单
  useEffect(() => {
    if (!userMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [userMenuOpen]);

  const submitSearch = (text: string) => {
    const q = text.trim().slice(0, 100);
    if (!q) return;
    searchHistory.close();
    router.push(`/?s=${encodeURIComponent(q)}`, { scroll: false });
    // 顶栏搜索一并写入最近搜索（此前只有首页会记录）
    searchHistory.record(q);
  };

  const pickHistory = (text: string) => {
    setQuery(text);
    submitSearch(text);
  };

  const openAdminPanel = () => {
    setUserMenuOpen(false);
    setInitialPrimary('admin');
    setSettingsOpen(true);
  };

  const isAdmin = userSystemAvailable && user?.role === 'admin';

  return (
    <>
      <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur border-b border-line">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/" aria-label="LibreTV 首页" className="flex items-center shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-512.png" alt="LibreTV" className="w-7 h-7 rounded-lg" />
          </Link>

          {showSearch && (
            <form
              className="flex-1 max-w-xl hidden sm:block"
              onSubmit={(e) => {
                e.preventDefault();
                submitSearch(query);
              }}
            >
              <div ref={searchHistory.containerRef} className="relative">
                <input
                  className={cn(
                    'input w-full h-9',
                    // 展开时：上圆角与外框沿用聚焦样式，底边改为内部分隔线，与下拉拼成同一面板
                    searchHistory.visible &&
                      'rounded-b-none border-accent border-b-line bg-surface-raised focus-visible:ring-0'
                  )}
                  aria-label="搜索影片"
                  placeholder="搜索影片..."
                  value={query}
                  maxLength={100}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    searchHistory.resetActive();
                  }}
                  onFocus={searchHistory.onFocus}
                  onKeyDown={(e) => searchHistory.onKeyDown(e, pickHistory)}
                  role="combobox"
                  aria-expanded={searchHistory.visible}
                  aria-controls="header-search-history"
                  aria-autocomplete="list"
                  aria-activedescendant={
                    searchHistory.visible && searchHistory.activeIndex >= 0
                      ? `header-search-history-${searchHistory.activeIndex}`
                      : undefined
                  }
                />
                {searchHistory.visible && (
                  <SearchHistoryDropdown
                    id="header-search-history"
                    matches={searchHistory.matches}
                    activeIndex={searchHistory.activeIndex}
                    onPick={pickHistory}
                    onRemove={searchHistory.remove}
                    onClearAll={searchHistory.clearAll}
                  />
                )}
              </div>
            </form>
          )}

          <div className="flex-1 sm:hidden" />

          <nav className="flex items-center gap-1 ml-auto">
            <HeaderLink href="/live" active={pathname === '/live'}>
              直播
            </HeaderLink>
            <HeaderLink href="/about" active={pathname === '/about'}>
              关于
            </HeaderLink>
            <ThemeToggle />
            <IconButton label="观看历史" onClick={() => setHistoryOpen(true)}>
              <Icon name="clock" />
            </IconButton>
            <IconButton label="设置" onClick={() => setSettingsOpen(true)}>
              <Icon name="gear" />
            </IconButton>
            {verified && user && (
              <div className="relative" ref={userMenuRef}>
                <button
                  className="p-1 rounded-md text-muted hover:text-content hover:bg-hover transition-colors"
                  aria-label="用户菜单"
                  aria-haspopup="menu"
                  aria-expanded={userMenuOpen}
                  onClick={() => setUserMenuOpen((v) => !v)}
                >
                  <span className="w-7 h-7 rounded-full bg-accent/15 text-accent text-xs font-semibold flex items-center justify-center">
                    {user.username.slice(0, 1).toUpperCase()}
                  </span>
                </button>
                {userMenuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-full mt-1.5 w-56 bg-surface-raised rounded-lg shadow-xl border border-line py-1.5 z-50"
                  >
                    <div className="px-3 py-2 min-w-0">
                      <div className="text-sm font-medium text-content truncate">{user.username}</div>
                      <div className="text-[11px] text-faint">{user.role === 'admin' ? '管理员' : '已登录'}</div>
                    </div>
                    <div className="h-px bg-line" />
                    {isAdmin && (
                      <UserMenuItem icon="bolt" label="管理面板" onClick={openAdminPanel} />
                    )}
                    {user.role === 'user' && (
                      <UserMenuItem
                        icon="edit"
                        label="修改密码"
                        onClick={() => {
                          setUserMenuOpen(false);
                          setPasswordOpen(true);
                        }}
                      />
                    )}
                    <UserMenuItem
                      icon="undo"
                      label="退出登录"
                      danger
                      onClick={() => {
                        setUserMenuOpen(false);
                        void logout();
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </nav>
        </div>
      </header>

      <SourceManagerDrawer
        open={settingsOpen}
        onClose={() => {
          setSettingsOpen(false);
          setInitialPrimary(undefined);
        }}
        initialPrimary={initialPrimary}
      />
      <HistoryPanel open={historyOpen} onClose={() => setHistoryOpen(false)} />
      {passwordOpen && <ChangePasswordDialog onClose={() => setPasswordOpen(false)} />}
    </>
  );
}

function HeaderLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        'px-2.5 py-1.5 rounded-md text-sm transition-colors',
        active ? 'text-content bg-hover' : 'text-muted hover:text-content'
      )}
    >
      {children}
    </Link>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      className="p-2 rounded-md text-muted hover:text-content hover:bg-hover transition-colors"
      title={label}
      aria-label={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function UserMenuItem({
  icon,
  label,
  danger,
  onClick,
}: {
  icon: IconName;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      role="menuitem"
      className={cn(
        'w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors',
        danger ? 'text-danger hover:bg-hover' : 'text-muted hover:text-content hover:bg-hover'
      )}
      onClick={onClick}
    >
      <Icon name={icon} className="w-4 h-4 shrink-0" />
      {label}
    </button>
  );
}

/** 修改密码对话框（仅账号用户；主密码在部署环境变量中管理，不在此提供） */
function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const submit = async () => {
    if (loading) return;
    if (newPassword.length < 6) {
      setError('新密码至少 6 位');
      return;
    }
    if (newPassword !== confirm) {
      setError('两次输入的新密码不一致');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.changePassword(oldPassword, newPassword);
      toast('密码已修改', 'success');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '修改失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/80 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-surface-raised rounded-xl p-6 w-full max-w-sm mx-4 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="修改密码"
      >
        <h2 className="text-lg font-semibold text-content mb-4">修改密码</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <input
            type="password"
            className="input w-full mb-3"
            placeholder="当前密码"
            autoComplete="current-password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
          />
          <input
            type="password"
            className="input w-full mb-3"
            placeholder="新密码（至少 6 位）"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <input
            type="password"
            className="input w-full"
            placeholder="确认新密码"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
          <div className="flex gap-2 justify-end mt-4">
            <button type="button" className="btn-ghost btn-sm" onClick={onClose}>
              取消
            </button>
            <button
              type="submit"
              className="btn-primary btn-sm"
              disabled={loading || !oldPassword || newPassword.length < 6 || !confirm}
            >
              {loading ? '提交中…' : '确认修改'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
