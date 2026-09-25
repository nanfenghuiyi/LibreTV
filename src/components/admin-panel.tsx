'use client';

import { useCallback, useEffect, useState } from 'react';
import { ConfirmDialog } from './confirm-dialog';
import { Icon } from './icon';
import { SectionTitle, Switch } from './settings-shared';
import { EmptyState, Spinner } from './states';
import { useToast } from './toast';
import { api } from '@/lib/client-api';
import type { AdminInviteRow, AdminUserRow } from '@/lib/types';
import { cn, formatRelativeTime, hostnameOf, validateSourceUrl } from '@/lib/utils';

/**
 * 管理面板（设置抽屉「管理」页签，仅管理员可见）：
 * - 用户管理：禁用/启用、踢下线（使会话失效）、删除、分配专属数据源；
 * - 邀请码管理：创建（次数 / 有效期 / 备注）、复制、删除。
 * 数据存于 Cloudflare D1；未配置 D1 绑定的部署显示不可用说明。
 */
export function AdminPanel() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [available, setAvailable] = useState(true);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [invites, setInvites] = useState<AdminInviteRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [pendingDeleteUser, setPendingDeleteUser] = useState<AdminUserRow | null>(null);
  const [pendingDeleteInvite, setPendingDeleteInvite] = useState<AdminInviteRow | null>(null);
  const [creating, setCreating] = useState(false);
  /** 正在分配数据源的用户名；非空时整页切换为分配面板 */
  const [assigning, setAssigning] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [u, i] = await Promise.all([api.adminListUsers(), api.adminListInvites()]);
      setUsers(u.users);
      setInvites(i.invites);
      setAvailable(u.available);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** 统一的用户行操作：成功后以服务端返回的最新行更新列表 */
  const mutateUser = async (username: string, patch: { disabled?: boolean; bumpEpoch?: boolean }) => {
    if (busy) return;
    setBusy(true);
    try {
      const { user } = await api.adminUpdateUser(username, patch);
      setUsers((prev) => prev.map((u) => (u.username === username ? user : u)));
    } catch (err) {
      toast(err instanceof Error ? err.message : '操作失败', 'error');
    } finally {
      setBusy(false);
    }
  };

  const deleteUser = async (username: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await api.adminDeleteUser(username);
      setUsers((prev) => prev.filter((u) => u.username !== username));
      toast(`已删除用户 ${username}`, 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : '删除失败', 'error');
    } finally {
      setBusy(false);
    }
  };

  const createInvite = async (opts: { maxUses: number; expiresInDays: number; note?: string }) => {
    if (busy) return;
    setBusy(true);
    try {
      const { invite } = await api.adminCreateInvite(opts);
      setInvites((prev) => [invite, ...prev]);
      setCreating(false);
      toast('邀请码已创建', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : '创建失败', 'error');
    } finally {
      setBusy(false);
    }
  };

  const deleteInvite = async (code: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await api.adminDeleteInvite(code);
      setInvites((prev) => prev.filter((i) => i.code !== code));
      toast('邀请码已删除', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : '删除失败', 'error');
    } finally {
      setBusy(false);
    }
  };

  const copyInvite = (code: string) => {
    navigator.clipboard
      .writeText(code)
      .then(() => toast('邀请码已复制', 'success'))
      .catch(() => toast('复制失败，请手动选中复制', 'warning'));
  };

  if (loading) {
    return (
      <div className="py-10 flex justify-center">
        <Spinner />
      </div>
    );
  }

  if (loadError) {
    return (
      <EmptyState
        icon="alert"
        title="管理数据加载失败"
        description="请确认网络连接后重试。"
        action={
          <button className="btn-primary btn-sm" onClick={() => void load()}>
            重试
          </button>
        }
      />
    );
  }

  if (!available) {
    return (
      <EmptyState
        icon="gear"
        title="当前部署未启用用户体系"
        description="仅在配置了 Cloudflare D1 数据库绑定的部署上可用。"
      />
    );
  }

  // 分配面板整页呈现：承载三区块编辑，返回时恢复用户/邀请码列表
  if (assigning) {
    return (
      <UserSourcesPanel
        username={assigning}
        onClose={() => setAssigning(null)}
        onAssigned={(assigned) =>
          setUsers((prev) => prev.map((u) => (u.username === assigning ? { ...u, sourceAssigned: assigned } : u)))
        }
      />
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <SectionTitle title="用户" hint={`${users.length} 个账号`} />
        {users.length === 0 ? (
          <p className="text-xs text-faint">暂无账号。</p>
        ) : (
          <ul className="space-y-2">
            {users.map((u) => (
              <li key={u.username} className={cn('bg-card rounded-lg p-3 flex items-center gap-2', u.disabled && 'opacity-70')}>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-content truncate">
                    {u.username}
                    {u.role === 'admin' && (
                      <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent align-middle">
                        管理员
                      </span>
                    )}
                    {u.disabled && (
                      <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-warning/15 text-warning align-middle">
                        已禁用
                      </span>
                    )}
                    {u.sourceAssigned && (
                      <span
                        className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent align-middle"
                        title="已为该用户分配专属数据源，其登录后仅看到分配的源"
                      >
                        已分配源
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-faint truncate">
                    注册于 {formatRelativeTime(u.createdAt)} ·{' '}
                    {u.lastLoginAt ? `最后登录 ${formatRelativeTime(u.lastLoginAt)}` : '从未登录'}
                  </div>
                </div>
                {/* 管理员（部署者主密码账号）不可在此停用/删除，也无需分配数据源 */}
                {u.role === 'user' && (
                  <>
                    <button
                      className="btn-ghost btn-sm shrink-0"
                      onClick={() => setAssigning(u.username)}
                      aria-label={`分配数据源 ${u.username}`}
                      title="为该用户分配专属数据源；分配后该用户仅看到分配的源"
                    >
                      分配数据源
                    </button>
                    <Switch
                      checked={!u.disabled}
                      onChange={() => void mutateUser(u.username, { disabled: !u.disabled })}
                      label={u.disabled ? `启用用户 ${u.username}` : `禁用用户 ${u.username}`}
                      title={u.disabled ? '重新允许该账号登录' : '禁止该账号登录（已登录的会话也会失效）'}
                    />
                    <button
                      className="rounded-md p-2 text-muted transition-colors hover:bg-hover hover:text-accent shrink-0 disabled:opacity-40"
                      disabled={busy}
                      onClick={() => void mutateUser(u.username, { bumpEpoch: true })}
                      aria-label={`踢下线 ${u.username}`}
                      title="踢下线：使其所有已登录会话立即失效，需重新登录"
                    >
                      <Icon name="undo" className="w-4 h-4" />
                    </button>
                    <button
                      className="rounded-md p-2 text-muted transition-colors hover:bg-hover hover:text-danger shrink-0"
                      onClick={() => setPendingDeleteUser(u)}
                      aria-label={`删除用户 ${u.username}`}
                      title="删除账号及其云端数据（不可恢复）"
                    >
                      <Icon name="trash" className="w-4 h-4" />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <SectionTitle
          title="邀请码"
          hint="注册模式为「需邀请码」时，新用户注册须持有有效邀请码"
          extra={
            <button className="btn-primary btn-sm" onClick={() => setCreating(true)}>
              <Icon name="plus" className="w-3.5 h-3.5" />
              生成邀请码
            </button>
          }
        />
        {creating && <InviteCreateForm busy={busy} onCancel={() => setCreating(false)} onSubmit={createInvite} />}
        {invites.length === 0 && !creating ? (
          <p className="text-xs text-faint">还没有邀请码。生成后发给新用户即可完成注册。</p>
        ) : (
          <ul className="space-y-2">
            {invites.map((inv) => (
              <li key={inv.code} className="bg-card rounded-lg p-3 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <code className="text-sm font-mono text-content">{inv.code}</code>
                    <InviteBadge invite={inv} />
                  </div>
                  <div className="text-xs text-faint truncate">
                    已用 {inv.usedCount}/{inv.maxUses} ·{' '}
                    {inv.expiresAt ? `${formatDate(inv.expiresAt)} 到期` : '永不过期'}
                    {inv.note ? ` · ${inv.note}` : ''}
                  </div>
                </div>
                <button
                  className="btn-ghost btn-sm shrink-0"
                  onClick={() => copyInvite(inv.code)}
                  aria-label={`复制邀请码 ${inv.code}`}
                >
                  复制
                </button>
                <button
                  className="rounded-md p-2 text-muted transition-colors hover:bg-hover hover:text-danger shrink-0"
                  onClick={() => void deleteInvite(inv.code)}
                  aria-label={`删除邀请码 ${inv.code}`}
                  title="删除邀请码（已注册的用户不受影响）"
                >
                  <Icon name="trash" className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 重操作：删除用户会连带清掉其云端同步数据，先确认 */}
      <ConfirmDialog
        open={pendingDeleteUser !== null}
        danger
        title="删除该用户？"
        message={
          pendingDeleteUser
            ? `将删除用户「${pendingDeleteUser.username}」及其云端同步的全部数据，此操作不可恢复。`
            : undefined
        }
        confirmLabel="删除用户"
        onCancel={() => setPendingDeleteUser(null)}
        onConfirm={() => {
          const target = pendingDeleteUser;
          setPendingDeleteUser(null);
          if (target) void deleteUser(target.username);
        }}
      />

      <ConfirmDialog
        open={pendingDeleteInvite !== null}
        danger
        title="删除该邀请码？"
        message={
          pendingDeleteInvite
            ? `删除后「${pendingDeleteInvite.code}」无法再用于注册，已注册的用户不受影响。`
            : undefined
        }
        confirmLabel="删除邀请码"
        onCancel={() => setPendingDeleteInvite(null)}
        onConfirm={() => {
          const target = pendingDeleteInvite;
          setPendingDeleteInvite(null);
          if (target) void deleteInvite(target.code);
        }}
      />
    </section>
  );
}

/** 邀请码状态徽章：过期 > 用尽 > 可用 */
function InviteBadge({ invite }: { invite: AdminInviteRow }) {
  if (invite.expiresAt !== null && invite.expiresAt <= Date.now()) {
    return <span className="text-[10px] px-1.5 py-0.5 rounded bg-danger/15 text-danger shrink-0">已过期</span>;
  }
  if (invite.usedCount >= invite.maxUses) {
    return <span className="text-[10px] px-1.5 py-0.5 rounded bg-chip text-faint shrink-0">已用尽</span>;
  }
  return <span className="text-[10px] px-1.5 py-0.5 rounded bg-success/15 text-success shrink-0">可用</span>;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 创建邀请码表单：次数 / 有效期 / 备注（与服务端校验规则一致） */
function InviteCreateForm({
  busy,
  onCancel,
  onSubmit,
}: {
  busy: boolean;
  onCancel: () => void;
  onSubmit: (opts: { maxUses: number; expiresInDays: number; note?: string }) => void;
}) {
  const { toast } = useToast();
  const [maxUses, setMaxUses] = useState('1');
  const [expiresInDays, setExpiresInDays] = useState('30');
  const [note, setNote] = useState('');

  const submit = () => {
    const uses = parseInt(maxUses, 10);
    const days = parseInt(expiresInDays, 10);
    if (!Number.isInteger(uses) || uses < 1 || uses > 999) {
      toast('可用次数需为 1-999 的整数', 'warning');
      return;
    }
    if (!Number.isInteger(days) || days < 1 || days > 3650) {
      toast('有效期需为 1-3650 的整数天', 'warning');
      return;
    }
    const trimmed = note.trim();
    onSubmit({ maxUses: uses, expiresInDays: days, ...(trimmed ? { note: trimmed.slice(0, 100) } : {}) });
  };

  return (
    <div className="space-y-2 border border-line rounded-lg p-3 bg-chip mb-2">
      <div className="flex gap-2">
        <label className="flex-1 min-w-0">
          <span className="block text-xs text-muted mb-1">可用次数（1-999）</span>
          <input
            type="number"
            min={1}
            max={999}
            className="input w-full"
            aria-label="可用次数"
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
          />
        </label>
        <label className="flex-1 min-w-0">
          <span className="block text-xs text-muted mb-1">有效期（天，1-3650）</span>
          <input
            type="number"
            min={1}
            max={3650}
            className="input w-full"
            aria-label="有效期（天）"
            value={expiresInDays}
            onChange={(e) => setExpiresInDays(e.target.value)}
          />
        </label>
      </div>
      <input
        className="input w-full"
        aria-label="备注（可选）"
        placeholder="备注（可选），如「给小王的邀请码」"
        maxLength={100}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex gap-2 justify-end">
        <button className="btn-ghost btn-sm" onClick={onCancel}>
          取消
        </button>
        <button className="btn-primary btn-sm" disabled={busy} onClick={submit}>
          生成
        </button>
      </div>
    </div>
  );
}

type AssignedVod = { name: string; url: string; detail?: string; isAdult?: boolean };
type AssignedLive = { name?: string; url: string; epg?: string };
type AssignedSub = { url: string; name?: string };

/**
 * 用户数据源分配面板：为指定用户配置专属采集源 / 直播源 / 订阅。
 * 保存后该用户进入「替换模式」：不再接收环境预置源与站点共享源，仅呈现分配的源
 * （用户自己添加的自定义源不受影响）；清除分配即恢复常规下发。
 * 「导入站点共享源」可把站点级配置一键填入作为编辑起点。
 */
function UserSourcesPanel({
  username,
  onClose,
  onAssigned,
}: {
  username: string;
  onClose: () => void;
  /** 保存/清除后回调，同步用户行的「已分配源」徽标 */
  onAssigned: (assigned: boolean) => void;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasAssigned, setHasAssigned] = useState(false);
  const [pendingClear, setPendingClear] = useState(false);
  const [vodSources, setVodSources] = useState<AssignedVod[]>([]);
  const [liveSources, setLiveSources] = useState<AssignedLive[]>([]);
  const [subscriptions, setSubscriptions] = useState<AssignedSub[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    setUnavailable(false);
    api
      .adminGetUserSources(username)
      .then(({ available, assigned }) => {
        if (cancelled) return;
        if (!available) {
          setUnavailable(true);
          return;
        }
        if (assigned) {
          setHasAssigned(true);
          setVodSources(assigned.sources.map(({ name, url, detail, isAdult }) => ({ name, url, detail, isAdult })));
          setLiveSources(assigned.liveSources.map(({ name, url, epg }) => ({ name, url, epg })));
          setSubscriptions(assigned.subscriptions.map(({ url, name }) => ({ url, name })));
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [username]);

  /** 一键导入站点共享源（含站点订阅）作为编辑起点，覆盖当前草稿 */
  const importShared = async () => {
    try {
      const { available, config } = await api.getSharedSources();
      if (!available || !config) {
        toast('站点共享源不可用或尚未配置', 'warning');
        return;
      }
      setVodSources(config.sources.map(({ name, url, detail, isAdult }) => ({ name, url, detail, isAdult })));
      setLiveSources(config.liveSources.map(({ name, url, epg }) => ({ name, url, epg })));
      setSubscriptions(config.subscriptions.map(({ url, name }) => ({ url, name })));
      toast(
        `已导入 ${config.sources.length} 个采集源、${config.liveSources.length} 个直播源、${config.subscriptions.length} 个订阅`,
        'success'
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : '导入失败', 'error');
    }
  };

  /** 清洗草稿：去空行、去非法 URL，返回可提交数据与剔除数量 */
  const cleanDraft = () => {
    let dropped = 0;
    const sources = vodSources
      .map((s) => ({ ...s, name: s.name.trim(), url: s.url.trim() }))
      .filter((s) => {
        if (!s.url) return false;
        if (!validateSourceUrl(s.url)) {
          dropped += 1;
          return false;
        }
        return true;
      });
    const live = liveSources
      .map((s) => ({ ...s, name: s.name?.trim() || undefined, url: s.url.trim(), epg: s.epg?.trim() || undefined }))
      .filter((s) => {
        if (!s.url) return false;
        if (!validateSourceUrl(s.url)) {
          dropped += 1;
          return false;
        }
        return true;
      });
    const subs = subscriptions
      .map((s) => ({ url: s.url.trim(), name: s.name?.trim() || undefined }))
      .filter((s) => {
        if (!s.url) return false;
        if (!validateSourceUrl(s.url)) {
          dropped += 1;
          return false;
        }
        return true;
      });
    return { sources, live, subs, dropped };
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const { sources, live, subs, dropped } = cleanDraft();
      const { assigned } = await api.adminSaveUserSources(username, {
        sources,
        liveSources: live.map((s) => ({ ...s, name: s.name || hostnameOf(s.url) })),
        subscriptions: subs,
      });
      const total = assigned.sources.length + assigned.liveSources.length + assigned.subscriptions.length;
      setHasAssigned(total > 0);
      onAssigned(total > 0);
      if (dropped > 0) toast(`已保存，但跳过了 ${dropped} 个无效地址`, 'warning');
      else toast(total > 0 ? `已为 ${username} 分配 ${total} 项数据源` : '已保存空配置', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : '保存失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  const clearAssignment = async () => {
    setPendingClear(false);
    try {
      await api.adminDeleteUserSources(username);
      setHasAssigned(false);
      setVodSources([]);
      setLiveSources([]);
      setSubscriptions([]);
      onAssigned(false);
      toast(`已清除 ${username} 的数据源分配`, 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : '清除失败', 'error');
    }
  };

  if (loading) {
    return (
      <div className="py-10 flex justify-center">
        <Spinner />
      </div>
    );
  }

  if (loadError) {
    return (
      <EmptyState
        icon="alert"
        title="分配配置加载失败"
        description="请确认网络连接后重试。"
        action={
          <button className="btn-primary btn-sm" onClick={onClose}>
            返回
          </button>
        }
      />
    );
  }

  if (unavailable) {
    return (
      <EmptyState
        icon="link"
        title="当前部署不支持数据源分配"
        description="仅在配置了 Cloudflare D1 数据库绑定的部署上可用。"
        action={
          <button className="btn-primary btn-sm" onClick={onClose}>
            返回
          </button>
        }
      />
    );
  }

  return (
    <section>
      <SectionTitle
        title={`为 ${username} 分配数据源`}
        hint="保存后该用户仅看到分配的源（替换模式）"
        extra={
          <div className="flex items-center gap-1.5">
            <button className="btn-ghost btn-sm" onClick={() => void importShared()}>
              导入站点共享源
            </button>
            <button className="btn-primary btn-sm" onClick={() => void save()} disabled={saving}>
              {saving ? '保存中…' : '保存'}
            </button>
            <button className="btn-ghost btn-sm" onClick={onClose}>
              返回
            </button>
          </div>
        }
      />
      <p className="text-xs text-faint mb-3 leading-relaxed">
        分配后该用户不再接收部署者预置源与站点共享源，仅呈现此处分配的源；其自行添加的自定义源不受影响。
        撤销分配（清除）后恢复常规下发，原有勾选状态会自动还原。
      </p>
      {hasAssigned && (
        <div className="mb-3">
          <button className="btn-ghost btn-sm hover:text-danger" onClick={() => setPendingClear(true)}>
            <Icon name="trash" className="w-3.5 h-3.5" />
            清除分配
          </button>
        </div>
      )}

      {/* 采集源（点播） */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-content">采集源（点播）{vodSources.length > 0 && ` · ${vodSources.length} 个`}</h3>
        <button className="btn-ghost btn-sm" onClick={() => setVodSources((prev) => [...prev, { name: '', url: '' }])}>
          <Icon name="plus" className="w-3.5 h-3.5" />
          添加
        </button>
      </div>
      {vodSources.length === 0 ? (
        <p className="text-xs text-faint mb-4">未分配采集源。</p>
      ) : (
        <ul className="space-y-2 mb-4">
          {vodSources.map((s, i) => (
            <li key={i} className="bg-card rounded-lg p-2.5 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <input
                  className="input flex-1 min-w-0"
                  placeholder="名称"
                  value={s.name}
                  onChange={(e) => setVodSources((prev) => prev.map((v, idx) => (idx === i ? { ...v, name: e.target.value } : v)))}
                />
                <label className="flex items-center gap-1 text-xs text-muted shrink-0" title="成人内容源（受访客过滤开关影响）">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-accent"
                    checked={!!s.isAdult}
                    onChange={(e) =>
                      setVodSources((prev) => prev.map((v, idx) => (idx === i ? { ...v, isAdult: e.target.checked } : v)))
                    }
                  />
                  18+
                </label>
                <button
                  className="rounded-md p-2 text-muted transition-colors hover:bg-hover hover:text-danger shrink-0"
                  onClick={() => setVodSources((prev) => prev.filter((_, idx) => idx !== i))}
                  aria-label="删除"
                  title="删除（保存后生效）"
                >
                  <Icon name="trash" className="w-4 h-4" />
                </button>
              </div>
              <input
                className="input w-full"
                placeholder="API 地址（Apple CMS JSON 接口）"
                value={s.url}
                onChange={(e) => setVodSources((prev) => prev.map((v, idx) => (idx === i ? { ...v, url: e.target.value } : v)))}
              />
            </li>
          ))}
        </ul>
      )}

      {/* 直播源 */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-content">直播源{liveSources.length > 0 && ` · ${liveSources.length} 个`}</h3>
        <button className="btn-ghost btn-sm" onClick={() => setLiveSources((prev) => [...prev, { url: '' }])}>
          <Icon name="plus" className="w-3.5 h-3.5" />
          添加
        </button>
      </div>
      {liveSources.length === 0 ? (
        <p className="text-xs text-faint mb-4">未分配直播源。</p>
      ) : (
        <ul className="space-y-2 mb-4">
          {liveSources.map((s, i) => (
            <li key={i} className="bg-card rounded-lg p-2.5 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <input
                  className="input flex-1 min-w-0"
                  placeholder="名称（可选，默认显示域名）"
                  value={s.name ?? ''}
                  onChange={(e) =>
                    setLiveSources((prev) => prev.map((v, idx) => (idx === i ? { ...v, name: e.target.value } : v)))
                  }
                />
                <button
                  className="rounded-md p-2 text-muted transition-colors hover:bg-hover hover:text-danger shrink-0"
                  onClick={() => setLiveSources((prev) => prev.filter((_, idx) => idx !== i))}
                  aria-label="删除"
                  title="删除（保存后生效）"
                >
                  <Icon name="trash" className="w-4 h-4" />
                </button>
              </div>
              <input
                className="input w-full"
                placeholder="M3U 订阅地址"
                value={s.url}
                onChange={(e) => setLiveSources((prev) => prev.map((v, idx) => (idx === i ? { ...v, url: e.target.value } : v)))}
              />
              <input
                className="input w-full"
                placeholder="节目单 EPG 地址（可选）"
                value={s.epg ?? ''}
                onChange={(e) => setLiveSources((prev) => prev.map((v, idx) => (idx === i ? { ...v, epg: e.target.value } : v)))}
              />
            </li>
          ))}
        </ul>
      )}

      {/* 订阅 */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-content">订阅{subscriptions.length > 0 && ` · ${subscriptions.length} 个`}</h3>
        <button className="btn-ghost btn-sm" onClick={() => setSubscriptions((prev) => [...prev, { url: '' }])}>
          <Icon name="plus" className="w-3.5 h-3.5" />
          添加
        </button>
      </div>
      {subscriptions.length === 0 ? (
        <p className="text-xs text-faint">未分配订阅。</p>
      ) : (
        <ul className="space-y-2">
          {subscriptions.map((s, i) => (
            <li key={i} className="bg-card rounded-lg p-2.5 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <input
                  className="input flex-1 min-w-0"
                  placeholder="备注名称（可选，默认显示域名）"
                  value={s.name ?? ''}
                  onChange={(e) =>
                    setSubscriptions((prev) => prev.map((v, idx) => (idx === i ? { ...v, name: e.target.value } : v)))
                  }
                />
                <button
                  className="rounded-md p-2 text-muted transition-colors hover:bg-hover hover:text-danger shrink-0"
                  onClick={() => setSubscriptions((prev) => prev.filter((_, idx) => idx !== i))}
                  aria-label="删除"
                  title="删除（保存后生效）"
                >
                  <Icon name="trash" className="w-4 h-4" />
                </button>
              </div>
              <input
                className="input w-full"
                placeholder="订阅地址（LibreTV 源列表或 TVBOX 配置的 JSON URL）"
                value={s.url}
                onChange={(e) => setSubscriptions((prev) => prev.map((v, idx) => (idx === i ? { ...v, url: e.target.value } : v)))}
              />
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pendingClear}
        danger
        title="清除该用户的数据源分配？"
        message={`将删除为「${username}」分配的全部专属数据源，该用户恢复接收部署者预置源与站点共享源。`}
        confirmLabel="清除分配"
        onCancel={() => setPendingClear(false)}
        onConfirm={() => void clearAssignment()}
      />
    </section>
  );
}
