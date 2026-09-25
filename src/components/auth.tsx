'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, onUnauthorized, STATUS_QUERY_KEY } from '@/lib/client-api';
import { bootstrapSources } from '@/lib/subscription-sync';
import { startUserSync, stopUserSync } from '@/lib/user-sync';
import type { AuthStatusResponse, CurrentUser } from '@/lib/types';
import { useToast } from './toast';

/**
 * 认证上下文：
 * - 页面加载时查询 /api/status 判断会话有效性；
 * - 任何 API 返回 401/503 时全局打开登录框（客户端 API 层统一触发，不再散落检查）；
 * - 用户体系可用时提供主密码 / 账号登录 / 注册三种入口，登录后启动个人数据云同步。
 */

type RegistrationMode = NonNullable<AuthStatusResponse['registrationMode']>;

interface AuthContextValue {
  checked: boolean;
  verified: boolean;
  /** 服务器未设置 PASSWORD，需要管理员配置 */
  setupRequired: SetupRequired;
  /** /api/status 返回的应用版本（构建时从 package.json 注入） */
  version: string | null;
  /** 用户体系是否可用（Workers + D1 绑定） */
  userSystemAvailable: boolean;
  /** 注册模式：invite 需邀请码（默认）/ open 开放 / off 关闭 */
  registrationMode: RegistrationMode;
  /** 当前登录用户（主密码登录为 admin；未登录为 null） */
  user: CurrentUser | null;
  openLogin: () => void;
  logout: () => Promise<void>;
}

type SetupRequired = boolean;

const AuthContext = createContext<AuthContextValue>({
  checked: false,
  verified: false,
  setupRequired: false,
  version: null,
  userSystemAvailable: false,
  registrationMode: 'invite',
  user: null,
  openLogin: () => {},
  logout: async () => {},
});

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [checked, setChecked] = useState(false);
  const [verified, setVerified] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const [version, setVersion] = useState<string | null>(null);
  const [userSystemAvailable, setUserSystemAvailable] = useState(false);
  const [registrationMode, setRegistrationMode] = useState<RegistrationMode>('invite');
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 与 Providers 共用同一 query key 与缓存，避免 /api/status 被请求两次
  useEffect(() => {
    let cancelled = false;
    queryClient
      .fetchQuery({ queryKey: STATUS_QUERY_KEY, queryFn: () => api.status() })
      .then((s) => {
        if (cancelled) return;
        setVerified(s.verified);
        setSetupRequired(!s.passwordRequired);
        setVersion(s.version);
        setUserSystemAvailable(s.userSystemAvailable ?? false);
        setRegistrationMode(s.registrationMode ?? 'invite');
        setUser(s.me ?? null);
        setChecked(true);
      })
      .catch(() => {
        if (!cancelled) setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [queryClient]);

  useEffect(
    () =>
      onUnauthorized((event) => {
        const setup = (event as CustomEvent).detail === 'setup';
        setSetupRequired(setup);
        setVerified(false);
        setUser(null);
        setModalOpen(true);
      }),
    []
  );

  const openLogin = useCallback(() => setModalOpen(true), []);

  const logout = useCallback(async () => {
    stopUserSync();
    try {
      await api.logout();
    } finally {
      setVerified(false);
      setUser(null);
      toast('已退出登录', 'info');
    }
  }, [toast]);

  const handleLoginSuccess = useCallback(async () => {
    setVerified(true);
    setSetupRequired(false);
    setModalOpen(false);
    // 登录前以 401 失败的查询（如豆瓣推荐）需要重新拉取
    queryClient.invalidateQueries();
    toast('登录成功', 'success');
    // 登录改变了会话身份，status 缓存必然陈旧：强制重取一次拿最新身份与预置订阅
    try {
      const status = await queryClient.fetchQuery<AuthStatusResponse>({
        queryKey: STATUS_QUERY_KEY,
        queryFn: () => api.status(),
        staleTime: 0,
      });
      setUserSystemAvailable(status.userSystemAvailable ?? false);
      setRegistrationMode(status.registrationMode ?? 'invite');
      setUser(status.me ?? null);
      // 用户体系可用且以用户身份登录：启动个人数据云同步
      if (status.userSystemAvailable && status.me) startUserSync();
      // 源体系统一启动入口（与 Providers 首屏共用）：登录前 401 失败的
      // 预置订阅在此补跑；分配/共享源也在此完成决策与应用
      await bootstrapSources(status);
    } catch {
      // 补拉预置数据失败不影响登录后的正常使用
    }
  }, [toast, queryClient]);

  return (
    <AuthContext.Provider
      value={{
        checked,
        verified,
        setupRequired,
        version,
        userSystemAvailable,
        registrationMode,
        user,
        openLogin,
        logout,
      }}
    >
      {children}
      {modalOpen && (
        <LoginModal
          setupRequired={setupRequired}
          userSystemAvailable={userSystemAvailable}
          registrationMode={registrationMode}
          onSuccess={handleLoginSuccess}
          onClose={() => setModalOpen(false)}
        />
      )}
    </AuthContext.Provider>
  );
}

type LoginTab = 'admin' | 'login' | 'register';

function LoginModal({
  setupRequired,
  userSystemAvailable,
  registrationMode,
  onSuccess,
  onClose,
}: {
  setupRequired: boolean;
  userSystemAvailable: boolean;
  registrationMode: RegistrationMode;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<LoginTab>('admin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const tabs: { id: LoginTab; label: string }[] = [
    { id: 'admin', label: '主密码' },
    ...(userSystemAvailable
      ? [
          { id: 'login' as const, label: '账号登录' },
          ...(registrationMode !== 'off' ? [{ id: 'register' as const, label: '注册' }] : []),
        ]
      : []),
  ];

  useEffect(() => {
    inputRef.current?.focus();
  }, [tab]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const fail = (err: unknown, fallback: string) => {
    const msg = err instanceof Error ? err.message : fallback;
    setError(msg === '需要登录' ? '密码错误' : msg);
    setPassword('');
    inputRef.current?.focus();
  };

  const submitAdmin = async () => {
    if (!password.trim() || loading) return;
    setLoading(true);
    setError('');
    try {
      await api.login(password);
      onSuccess();
    } catch (err) {
      fail(err, '验证失败');
    } finally {
      setLoading(false);
    }
  };

  const submitLogin = async () => {
    if (!username.trim() || !password.trim() || loading) return;
    setLoading(true);
    setError('');
    try {
      await api.login(password, username.trim());
      onSuccess();
    } catch (err) {
      fail(err, '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const submitRegister = async () => {
    const name = username.trim();
    if (!name || !password || loading) return;
    if (registrationMode === 'invite' && !inviteCode.trim()) {
      setError('请输入邀请码');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.register({
        username: name,
        password,
        ...(registrationMode === 'invite' ? { inviteCode: inviteCode.trim() } : {}),
      });
      onSuccess();
    } catch (err) {
      fail(err, '注册失败');
    } finally {
      setLoading(false);
    }
  };

  const titles: Record<LoginTab, { title: string; subtitle: string }> = {
    admin: { title: '访问验证', subtitle: '请输入主密码继续访问' },
    login: { title: '账号登录', subtitle: '使用注册的用户名登录，数据跨设备同步' },
    register: { title: '创建账号', subtitle: '注册后观看记录与设置将云端同步' },
  };

  const submit = () => {
    if (tab === 'admin') void submitAdmin();
    else if (tab === 'login') void submitLogin();
    else void submitRegister();
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
        aria-label={setupRequired ? '需要配置密码' : titles[tab].title}
      >
        {setupRequired ? (
          <>
            <h2 className="text-lg font-semibold text-content mb-3">需要配置密码</h2>
            <p className="text-sm text-muted leading-relaxed">
              为确保安全，必须设置 <code className="text-accent">PASSWORD</code> 环境变量才能使用本服务。
              请联系管理员在部署配置中添加该变量后重启服务。
            </p>
          </>
        ) : (
          <>
            {tabs.length > 1 && (
              <div className="flex gap-1 mb-4 p-1 rounded-lg bg-surface border border-line" role="tablist">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={tab === t.id}
                    onClick={() => {
                      setTab(t.id);
                      setError('');
                    }}
                    className={`flex-1 py-1.5 text-sm rounded-md transition-colors ${
                      tab === t.id ? 'bg-accent/10 text-accent font-medium' : 'text-muted hover:text-content'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
            <h2 className="text-lg font-semibold text-content mb-1">{titles[tab].title}</h2>
            <p className="text-sm text-muted mb-4">{titles[tab].subtitle}</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              {tab !== 'admin' && (
                <input
                  ref={inputRef}
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input w-full mb-3"
                  placeholder="用户名（字母开头，2-20 位）"
                  autoComplete="username"
                />
              )}
              <input
                ref={tab === 'admin' ? inputRef : undefined}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input w-full"
                placeholder={tab === 'admin' ? '主密码' : tab === 'register' ? '密码（至少 6 位）' : '密码'}
                autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
              />
              {tab === 'register' && registrationMode === 'invite' && (
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  className="input w-full mt-3"
                  placeholder="邀请码（LTV-XXXXX-XXXXX）"
                />
              )}
              {error && <p className="mt-2 text-sm text-danger">{error}</p>}
              <button
                type="submit"
                className="btn-primary w-full mt-4"
                disabled={
                  loading ||
                  (tab === 'admin' && !password.trim()) ||
                  (tab === 'login' && (!username.trim() || !password.trim())) ||
                  (tab === 'register' && (!username.trim() || !password.trim()))
                }
              >
                {loading ? '请稍候...' : tab === 'register' ? '注册并登录' : '进入'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
