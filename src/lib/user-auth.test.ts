import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getRegistrationMode, validatePassword, validateUsername } from './user-auth';
import { makeFakeD1 } from './fake-d1';

/**
 * user-auth 单元测试：内存 D1（fake-d1）覆盖用户 CRUD、口令哈希、
 * 会话复查、管理员操作与邀请码。
 * 模块级缓存（pepper / 建表标记）通过 vi.resetModules + 动态 import 在用例间隔离。
 */

const GOOD = 'secret-pass-123';

/** 重新加载模块（隔离 pepper 缓存与建表缓存），返回新实例 */
async function load() {
  await vi.resetModules();
  return import('./user-auth');
}

beforeEach(() => {
  delete process.env.USER_REGISTRATION;
  delete process.env.PBKDF2_ITERATIONS;
});

describe('用户名与密码校验', () => {
  it.each([
    ['alice', 'alice'],
    ['user-1_ok', 'user-1_ok'],
    ['ab', 'ab'],
    ['a'.repeat(20), 'a'.repeat(20)],
    ['a', null], // 太短
    ['1abc', null], // 数字开头
    ['has space', null],
    ['a'.repeat(21), null], // 超长
    ['admin', null], // 保留名
  ])('validateUsername(%j) → %j', (name, expected) => {
    expect(validateUsername(name)).toBe(expected);
  });

  it.each([
    ['12345', false],
    ['123456', true],
    ['x'.repeat(128), true],
    ['x'.repeat(129), false],
  ])('validatePassword(len %j) → %j', (pw, ok) => {
    expect(validatePassword(pw)).toBe(ok);
  });
});

describe('注册模式', () => {
  it('默认 invite', () => {
    expect(getRegistrationMode()).toBe('invite');
  });

  it.each([
    ['open', 'open'],
    ['OFF', 'off'],
    [' invite ', 'invite'],
    ['nonsense', 'invite'],
  ])('USER_REGISTRATION=%j → %j', (env, expected) => {
    process.env.USER_REGISTRATION = env;
    expect(getRegistrationMode()).toBe(expected);
  });
});

describe('口令哈希（PBKDF2 + pepper）', () => {
  it('哈希格式 pbkdf2$<iter>$<salt>$<hash>；同口令两次哈希盐不同', async () => {
    const db = makeFakeD1();
    const mod = await load();
    const h1 = await mod.hashPassword(GOOD, db);
    const h2 = await mod.hashPassword(GOOD, db);
    expect(h1).toMatch(/^pbkdf2\$25000\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]{40,}$/);
    expect(h1).not.toBe(h2);
  });

  it('verifyPassword：正确/错误/篡改/格式非法', async () => {
    const db = makeFakeD1();
    const mod = await load();
    const h = await mod.hashPassword(GOOD, db);
    await expect(mod.verifyPassword(h, GOOD, db)).resolves.toBe(true);
    await expect(mod.verifyPassword(h, 'wrong-pass', db)).resolves.toBe(false);
    await expect(mod.verifyPassword(`${h.slice(0, -1)}A`, GOOD, db)).resolves.toBe(false);
    await expect(mod.verifyPassword('md5$1$aa$bb', GOOD, db)).resolves.toBe(false);
  });

  it('pepper 持久化于 D1：模拟 isolate 重启后旧哈希仍可验证', async () => {
    const db = makeFakeD1();
    const first = await load();
    const h = await first.hashPassword(GOOD, db);
    expect(db.shared.get('user_pepper')?.v).toBeTruthy();

    const second = await load(); // 新模块实例 = 新 pepper 缓存，同一 db
    await expect(second.verifyPassword(h, GOOD, db)).resolves.toBe(true);
  });

  it('PBKDF2_ITERATIONS 生效，超出范围回落默认 25000', async () => {
    const db = makeFakeD1();
    process.env.PBKDF2_ITERATIONS = '50000';
    const mod = await load();
    await expect(mod.hashPassword(GOOD, db)).resolves.toMatch(/^pbkdf2\$50000\$/);

    process.env.PBKDF2_ITERATIONS = '100'; // 低于下限 10k
    const mod2 = await load();
    await expect(mod2.hashPassword(GOOD, db)).resolves.toMatch(/^pbkdf2\$25000\$/);
  });
});

describe('createUser', () => {
  it('open 模式注册成功：role=user、epoch=0', async () => {
    const db = makeFakeD1();
    const mod = await load();
    const row = await mod.createUser(db, { username: 'alice', password: GOOD, mode: 'open' });
    expect(row).toMatchObject({ username: 'alice', role: 'user', epoch: 0, disabled: 0 });
    expect(db.users.get('alice')?.password_hash).toBe(row.password_hash);
  });

  it('invite 模式：缺码/无效码拒绝，有效码消费且 used_count+1', async () => {
    const db = makeFakeD1();
    const mod = await load();
    await expect(
      mod.createUser(db, { username: 'alice', password: GOOD, mode: 'invite' })
    ).rejects.toThrow(/需要邀请码/);

    await expect(
      mod.createUser(db, { username: 'alice', password: GOOD, inviteCode: 'LTV-NOPE-00000', mode: 'invite' })
    ).rejects.toThrow(/邀请码无效/);

    const inv = await mod.createInviteCode(db);
    const row = await mod.createUser(db, {
      username: 'alice',
      password: GOOD,
      inviteCode: inv.code,
      mode: 'invite',
    });
    expect(row.username).toBe('alice');
    expect(db.invites.get(inv.code)?.used_count).toBe(1);
  });

  it('用户名重复拒绝', async () => {
    const db = makeFakeD1();
    const mod = await load();
    await mod.createUser(db, { username: 'alice', password: GOOD, mode: 'open' });
    await expect(
      mod.createUser(db, { username: 'alice', password: GOOD, mode: 'open' })
    ).rejects.toThrow(/已被占用/);
  });

  it('mode=off / 弱密码 / 用户数超上限拒绝', async () => {
    const db = makeFakeD1();
    const mod = await load();
    await expect(
      mod.createUser(db, { username: 'alice', password: GOOD, mode: 'off' })
    ).rejects.toThrow(/未开放注册/);
    await expect(
      mod.createUser(db, { username: 'alice', password: '12345', mode: 'open' })
    ).rejects.toThrow(/6-128/);

    const now = Date.now();
    for (let i = 0; i < 50; i++) {
      db.users.set(`u${i}`, {
        username: `u${i}`,
        password_hash: 'x',
        role: 'user',
        epoch: 0,
        disabled: 0,
        created_at: now + i,
        last_login_at: null,
      });
    }
    await expect(
      mod.createUser(db, { username: 'alice', password: GOOD, mode: 'open' })
    ).rejects.toThrow(/上限/);
  });
});

describe('verifyUserCredentials', () => {
  async function seed() {
    const db = makeFakeD1();
    const mod = await load();
    await mod.createUser(db, { username: 'alice', password: GOOD, mode: 'open' });
    return { db, mod };
  }

  it('正确密码返回行并记录 last_login_at', async () => {
    const { db, mod } = await seed();
    const row = await mod.verifyUserCredentials(db, 'alice', GOOD);
    expect(row?.username).toBe('alice');
    await new Promise((r) => setTimeout(r, 0)); // last_login_at 更新是 fire-and-forget
    expect(Number(db.users.get('alice')?.last_login_at)).toBeGreaterThan(0);
  });

  it('错误密码 / 不存在用户返回 null', async () => {
    const { db, mod } = await seed();
    await expect(mod.verifyUserCredentials(db, 'alice', 'wrong-pass')).resolves.toBeNull();
    await expect(mod.verifyUserCredentials(db, 'nobody', GOOD)).resolves.toBeNull();
  });

  it('禁用用户与 admin 角色行拒绝登录', async () => {
    const { db, mod } = await seed();
    db.users.get('alice')!.disabled = 1;
    await expect(mod.verifyUserCredentials(db, 'alice', GOOD)).resolves.toBeNull();

    db.users.set('boss', {
      username: 'boss',
      password_hash: 'pbkdf2$25000$AAAA$BBBB',
      role: 'admin',
      epoch: 0,
      disabled: 0,
      created_at: Date.now(),
      last_login_at: null,
    });
    await expect(mod.verifyUserCredentials(db, 'boss', GOOD)).resolves.toBeNull();
  });
});

describe('checkSessionAlive', () => {
  async function seed() {
    const db = makeFakeD1();
    const mod = await load();
    await mod.createUser(db, { username: 'alice', password: GOOD, mode: 'open' });
    return { db, mod };
  }

  it('epoch 不低于库内值 → 存活；库内 epoch 更高 → 已撤销', async () => {
    const { db, mod } = await seed();
    await expect(mod.checkSessionAlive(db, 'alice', 'user', 0)).resolves.toBe(true);

    await mod.changeUserPassword(db, 'alice', GOOD, 'new-pass-99'); // epoch → 1
    await expect(mod.checkSessionAlive(db, 'alice', 'user', 0)).resolves.toBe(false);
    await expect(mod.checkSessionAlive(db, 'alice', 'user', 1)).resolves.toBe(true);
  });

  it('禁用用户拒绝', async () => {
    const { db, mod } = await seed();
    await mod.adminUpdateUser(db, { username: 'alice', disabled: true });
    await expect(mod.checkSessionAlive(db, 'alice', 'user', 0)).resolves.toBe(false);
  });

  it('admin 虚拟账号：行不存在放行（纯主密码部署过渡态）', async () => {
    const db = makeFakeD1();
    const mod = await load();
    await expect(mod.checkSessionAlive(db, 'admin', 'admin', 0)).resolves.toBe(true);
  });

  it('admin 行存在时同样受 epoch 约束', async () => {
    const db = makeFakeD1();
    const mod = await load();
    await mod.ensureAdminRow(db);
    await expect(mod.checkSessionAlive(db, 'admin', 'admin', 0)).resolves.toBe(true);

    await mod.adminUpdateUser(db, { username: 'admin', bumpEpoch: true });
    await expect(mod.checkSessionAlive(db, 'admin', 'admin', 0)).resolves.toBe(false);
    await expect(mod.checkSessionAlive(db, 'admin', 'admin', 1)).resolves.toBe(true);
  });
});

describe('changeUserPassword', () => {
  async function seed() {
    const db = makeFakeD1();
    const mod = await load();
    await mod.createUser(db, { username: 'alice', password: GOOD, mode: 'open' });
    return { db, mod };
  }

  it('旧密码错误拒绝', async () => {
    const { db, mod } = await seed();
    await expect(mod.changeUserPassword(db, 'alice', 'wrong-old', 'new-pass-99')).rejects.toThrow(
      /当前密码错误/
    );
  });

  it('新密码过短拒绝', async () => {
    const { db, mod } = await seed();
    await expect(mod.changeUserPassword(db, 'alice', GOOD, '12345')).rejects.toThrow(/6-128/);
  });

  it('成功改密：新密码可登录、旧密码失效、epoch+1 使旧会话失效', async () => {
    const { db, mod } = await seed();
    const { epoch } = await mod.changeUserPassword(db, 'alice', GOOD, 'new-pass-99');
    expect(epoch).toBe(1);

    await expect(mod.verifyUserCredentials(db, 'alice', GOOD)).resolves.toBeNull();
    const row = await mod.verifyUserCredentials(db, 'alice', 'new-pass-99');
    expect(row?.epoch).toBe(1);

    await expect(mod.checkSessionAlive(db, 'alice', 'user', 0)).resolves.toBe(false);
  });

  it('admin 角色行拒绝改密（走 PASSWORD 环境变量）', async () => {
    const db = makeFakeD1();
    const mod = await load();
    await mod.ensureAdminRow(db);
    await expect(mod.changeUserPassword(db, 'admin', 'x', 'new-pass-99')).rejects.toThrow(
      /主管理员/
    );
  });
});

describe('管理员操作', () => {
  async function seed() {
    const db = makeFakeD1();
    const mod = await load();
    await mod.createUser(db, { username: 'alice', password: GOOD, mode: 'open' });
    await mod.createUser(db, { username: 'bob', password: GOOD, mode: 'open' });
    return { db, mod };
  }

  it('listUsers 按创建时间倒序', async () => {
    const { db, mod } = await seed();
    const users = await mod.listUsers(db);
    expect(users.map((u) => u.username)).toEqual(['bob', 'alice']);
  });

  it('ensureAdminRow 幂等：重复调用不覆盖既有 epoch', async () => {
    const { db, mod } = await seed();
    await mod.ensureAdminRow(db);
    await mod.adminUpdateUser(db, { username: 'admin', bumpEpoch: true });
    await mod.ensureAdminRow(db);
    expect(db.users.get('admin')?.epoch).toBe(1);
    expect(db.users.get('admin')?.role).toBe('admin');
  });

  it('禁用/启用用户', async () => {
    const { db, mod } = await seed();
    const row = await mod.adminUpdateUser(db, { username: 'alice', disabled: true });
    expect(row?.disabled).toBe(1);
    await mod.adminUpdateUser(db, { username: 'alice', disabled: false });
    expect(db.users.get('alice')?.disabled).toBe(0);
  });

  it('踢下线：bumpEpoch 使旧 epoch 会话失效', async () => {
    const { db, mod } = await seed();
    await mod.adminUpdateUser(db, { username: 'alice', bumpEpoch: true });
    await expect(mod.checkSessionAlive(db, 'alice', 'user', 0)).resolves.toBe(false);
  });

  it('不存在的用户返回 null', async () => {
    const { db, mod } = await seed();
    await expect(mod.adminUpdateUser(db, { username: 'nobody', disabled: true })).resolves.toBeNull();
  });

  it('内置管理员禁止禁用/删除', async () => {
    const db = makeFakeD1();
    const mod = await load();
    await mod.ensureAdminRow(db);
    await expect(mod.adminUpdateUser(db, { username: 'admin', disabled: true })).rejects.toThrow(
      /不允许禁用/
    );
    await expect(mod.adminDeleteUser(db, 'admin')).rejects.toThrow(/不允许删除/);
  });

  it('删除用户连带清空其 user_data', async () => {
    const { db, mod } = await seed();
    db.userData.set('alice|history|h1', {
      user_id: 'alice',
      type: 'history',
      k: 'h1',
      v: 'v',
      updated_at: 1,
    });
    await mod.adminDeleteUser(db, 'alice');
    expect(db.users.has('alice')).toBe(false);
    expect([...db.userData.keys()].some((k) => k.startsWith('alice|'))).toBe(false);
    expect(db.users.has('bob')).toBe(true);
  });
});

describe('邀请码', () => {
  it('创建：默认 max_uses=1 永不过期；参数 clamp 1-999 次', async () => {
    const db = makeFakeD1();
    const mod = await load();

    const def = await mod.createInviteCode(db);
    expect(def).toMatchObject({ max_uses: 1, used_count: 0, expires_at: null, note: null });
    expect(def.code).toMatch(/^LTV-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{5}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{5}$/);

    const zero = await mod.createInviteCode(db, { maxUses: 0 });
    expect(zero.max_uses).toBe(1);
    const big = await mod.createInviteCode(db, { maxUses: 1000 });
    expect(big.max_uses).toBe(999);
  });

  it('创建：expiresInDays 换算 expires_at，note 保存', async () => {
    const db = makeFakeD1();
    const mod = await load();
    const before = Date.now();
    const inv = await mod.createInviteCode(db, { expiresInDays: 7, note: ' 测试备注 ' });
    expect(inv.note).toBe('测试备注');
    expect(inv.expires_at!).toBeGreaterThanOrEqual(before + 7 * 86_400_000);
  });

  it('消费：成功 +1；一次性码第二次拒绝；多次码用尽后拒绝', async () => {
    const db = makeFakeD1();
    const mod = await load();

    const one = await mod.createInviteCode(db);
    await expect(mod.consumeInviteCode(db, one.code)).resolves.toBe(true);
    await expect(mod.consumeInviteCode(db, one.code)).resolves.toBe(false);

    const multi = await mod.createInviteCode(db, { maxUses: 3 });
    await expect(mod.consumeInviteCode(db, multi.code)).resolves.toBe(true);
    await expect(mod.consumeInviteCode(db, multi.code)).resolves.toBe(true);
    await expect(mod.consumeInviteCode(db, multi.code)).resolves.toBe(true);
    await expect(mod.consumeInviteCode(db, multi.code)).resolves.toBe(false);
    expect(db.invites.get(multi.code)?.used_count).toBe(3);
  });

  it('过期码拒绝消费', async () => {
    const db = makeFakeD1();
    const mod = await load();
    db.invites.set('LTV-EXPIRE-00000', {
      code: 'LTV-EXPIRE-00000',
      created_at: Date.now() - 10_000,
      expires_at: Date.now() - 1000,
      used_count: 0,
      max_uses: 1,
      note: null,
    });
    await expect(mod.consumeInviteCode(db, 'LTV-EXPIRE-00000')).resolves.toBe(false);
  });

  it('删除后无法消费；列表按创建时间倒序', async () => {
    const db = makeFakeD1();
    const mod = await load();
    const a = await mod.createInviteCode(db, { note: 'a' });
    const b = await mod.createInviteCode(db, { note: 'b' });
    // 同毫秒创建时 created_at 相同，DESC 排序不稳定；错开时间戳保证确定性
    (db.invites.get(b.code) as { created_at: number }).created_at = a.created_at + 1;

    expect((await mod.listInviteCodes(db)).map((i) => i.code)).toEqual([b.code, a.code]);

    await mod.deleteInviteCode(db, a.code);
    await expect(mod.consumeInviteCode(db, a.code)).resolves.toBe(false);
    expect(await mod.listInviteCodes(db)).toHaveLength(1);
  });
});
