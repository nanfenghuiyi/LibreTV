import type { D1DatabaseLike } from './d1';

/**
 * 测试专用内存 D1：按项目实际使用的 SQL 模式做 dispatch，而非实现完整 SQL 引擎。
 * 覆盖 shared-config / user-auth / user-data 用到的全部语句语义。
 * 仅测试文件引用，不参与生产构建。
 */

type Row = Record<string, unknown>;

export interface FakeD1 extends D1DatabaseLike {
  /** shared_config：k -> 行 */
  shared: Map<string, { v: string; updated_at: number }>;
  /** users：username -> 行 */
  users: Map<string, Row>;
  /** invite_codes：code -> 行 */
  invites: Map<string, Row>;
  /** user_data：`${user_id}|${type}|${k}` -> 行 */
  userData: Map<string, Row>;
  /** user_sources：username -> 行 */
  userSources: Map<string, { v: string; updated_at: number }>;
  /** 已执行的语句（截断，断言用） */
  executed: string[];
}

export function makeFakeD1(): FakeD1 {
  const shared = new Map<string, { v: string; updated_at: number }>();
  const users = new Map<string, Row>();
  const invites = new Map<string, Row>();
  const userData = new Map<string, Row>();
  const userSources = new Map<string, { v: string; updated_at: number }>();
  const executed: string[] = [];

  function userRowsFor(userId: string): Row[] {
    const prefix = `${userId}|`;
    return [...userData.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([, row]) => row);
  }

  function selectRows(query: string, b: (string | number | null)[]): Row[] {
    if (/SELECT v FROM shared_config WHERE k = \?/i.test(query)) {
      const row = shared.get(String(b[0]));
      return row ? [{ v: row.v }] : [];
    }
    if (/SELECT COUNT\(\*\) AS c FROM users/i.test(query)) return [{ c: users.size }];
    if (/SELECT \* FROM users WHERE username = \?/i.test(query)) {
      const row = users.get(String(b[0]));
      return row ? [row] : [];
    }
    if (/SELECT \* FROM users ORDER BY created_at DESC/i.test(query)) {
      return [...users.values()].sort((x, y) => Number(y.created_at) - Number(x.created_at));
    }
    if (/SELECT \* FROM invite_codes WHERE code = \?/i.test(query)) {
      const row = invites.get(String(b[0]));
      return row ? [row] : [];
    }
    if (/SELECT \* FROM invite_codes ORDER BY created_at DESC/i.test(query)) {
      return [...invites.values()].sort((x, y) => Number(y.created_at) - Number(x.created_at));
    }
    if (/SELECT used_count FROM invite_codes WHERE code = \?/i.test(query)) {
      const row = invites.get(String(b[0]));
      return row ? [{ used_count: row.used_count }] : [];
    }
    if (/SELECT type, k, v, updated_at AS updatedAt FROM user_data/i.test(query)) {
      return userRowsFor(String(b[0]))
        .sort((x, y) => Number(y.updated_at) - Number(x.updated_at))
        .map((r) => ({
          type: r.type,
          k: r.k,
          v: r.v,
          updatedAt: r.updated_at,
        }));
    }
    if (/SELECT type, k, updated_at FROM user_data/i.test(query)) {
      return userRowsFor(String(b[0])).map((r) => ({
        type: r.type,
        k: r.k,
        updated_at: r.updated_at,
      }));
    }
    if (/SELECT v, updated_at FROM user_sources WHERE username = \?/i.test(query)) {
      const row = userSources.get(String(b[0]));
      return row ? [{ v: row.v, updated_at: row.updated_at }] : [];
    }
    if (/SELECT username FROM user_sources/i.test(query)) {
      return [...userSources.keys()].map((username) => ({ username }));
    }
    throw new Error(`fake-d1: 未实现的 SELECT：${query}`);
  }

  function mutate(query: string, b: (string | number | null)[]): { meta?: { changes?: number } } | void {
    executed.push(query.replace(/\s+/g, ' ').slice(0, 80));
    if (/^CREATE TABLE/i.test(query)) return;

    if (/INSERT INTO shared_config/i.test(query)) {
      const [k, v, ts] = b as [string, string, number];
      if (!shared.has(k)) shared.set(k, { v, updated_at: ts });
      return;
    }
    if (/INSERT INTO users/i.test(query)) {
      if (/admin-master/.test(query)) {
        // ensureAdminRow：ON CONFLICT DO NOTHING，epoch 保持已有值
        const [username, createdAt] = b as [string, number];
        if (!users.has(username)) {
          users.set(username, {
            username,
            password_hash: 'admin-master',
            role: 'admin',
            epoch: 0,
            disabled: 0,
            created_at: createdAt,
            last_login_at: null,
          });
        }
        return;
      }
      const [username, passwordHash, createdAt] = b as [string, string, number];
      if (users.has(username)) throw new Error('UNIQUE constraint failed: users.username');
      users.set(username, {
        username,
        password_hash: passwordHash,
        role: 'user',
        epoch: 0,
        disabled: 0,
        created_at: createdAt,
        last_login_at: null,
      });
      return;
    }
    if (/UPDATE users SET last_login_at = \? WHERE username = \?/i.test(query)) {
      const row = users.get(String(b[1]));
      if (row) row.last_login_at = b[0];
      return;
    }
    if (/UPDATE users SET disabled = \?, epoch = \? WHERE username = \?/i.test(query)) {
      const row = users.get(String(b[2]));
      if (row) {
        row.disabled = b[0];
        row.epoch = b[1];
      }
      return;
    }
    if (/UPDATE users SET password_hash = \?, epoch = \? WHERE username = \?/i.test(query)) {
      const row = users.get(String(b[2]));
      if (row) {
        row.password_hash = b[0];
        row.epoch = b[1];
      }
      return;
    }
    if (/DELETE FROM users WHERE username = \? AND role = \?/i.test(query)) {
      const username = String(b[0]);
      const row = users.get(username);
      if (row && row.role === b[1]) users.delete(username);
      return;
    }
    if (/INSERT INTO invite_codes/i.test(query)) {
      const [code, createdAt, expiresAt, maxUses, note] = b as [
        string,
        number,
        number | null,
        number,
        string | null,
      ];
      if (invites.has(code)) throw new Error('UNIQUE constraint failed: invite_codes.code');
      invites.set(code, {
        code,
        created_at: createdAt,
        expires_at: expiresAt,
        used_count: 0,
        max_uses: maxUses,
        note,
      });
      return;
    }
    if (/UPDATE invite_codes SET used_count = used_count \+ 1/i.test(query)) {
      const [code, usedCount, now] = b as [string, number, number];
      const row = invites.get(code);
      if (!row) return;
      if (Number(row.used_count) !== usedCount) return; // 条件更新：读取值已变化则放弃
      if (Number(row.used_count) >= Number(row.max_uses)) return;
      if (row.expires_at !== null && Number(row.expires_at) <= now) return;
      row.used_count = Number(row.used_count) + 1;
      return;
    }
    if (/DELETE FROM invite_codes WHERE code = \?/i.test(query)) {
      invites.delete(String(b[0]));
      return;
    }
    if (/DELETE FROM user_data WHERE user_id = \? AND type = \? AND k IN \(/i.test(query)) {
      const userId = String(b[0]);
      const type = String(b[1]);
      for (const k of b.slice(2)) userData.delete(`${userId}|${type}|${String(k)}`);
      return;
    }
    if (/DELETE FROM user_data WHERE user_id = \? AND type = \?/i.test(query)) {
      const prefix = `${String(b[0])}|${String(b[1])}|`;
      for (const key of [...userData.keys()]) if (key.startsWith(prefix)) userData.delete(key);
      return;
    }
    if (/DELETE FROM user_data WHERE user_id = \?/i.test(query)) {
      const prefix = `${String(b[0])}|`;
      for (const key of [...userData.keys()]) if (key.startsWith(prefix)) userData.delete(key);
      return;
    }
    if (/INSERT INTO user_data/i.test(query)) {
      const [userId, type, k, v, updatedAt] = b as [string, string, string, string, number];
      userData.set(`${userId}|${type}|${k}`, { user_id: userId, type, k, v, updated_at: updatedAt });
      return;
    }
    if (/INSERT INTO user_sources/i.test(query)) {
      const [username, v, ts] = b as [string, string, number];
      userSources.set(username, { v, updated_at: ts }); // UPSERT：冲突时整行覆盖
      return;
    }
    if (/DELETE FROM user_sources WHERE username = \?/i.test(query)) {
      const deleted = userSources.delete(String(b[0]));
      return { meta: { changes: deleted ? 1 : 0 } };
    }
    throw new Error(`fake-d1: 未实现语句：${query}`);
  }

  function makeStmt(query: string) {
    // 生产代码里的 SQL 是多行模板字符串，归一化空白后再做模式匹配
    const q = query.replace(/\s+/g, ' ');
    let bound: (string | number | null)[] = [];
    const api = {
      bind(...values: (string | number | null)[]) {
        bound = values;
        return api;
      },
      async first<T = unknown>(): Promise<T | null> {
        // 返回行快照而非 Map 内的活引用（真实 D1 语义），否则写入后再读旧变量会"凭空"变化
        const row = selectRows(q, bound)[0] as T | undefined;
        return row ? ({ ...(row as object) } as T) : null;
      },
      async all<T = unknown>(): Promise<{ results: T[] }> {
        const rows = selectRows(q, bound) as T[];
        return { results: rows.map((r) => ({ ...(r as object) })) as T[] };
      },
      async run(): Promise<unknown> {
        return mutate(q, bound);
      },
    };
    return api;
  }

  return {
    prepare: makeStmt,
    async batch(statements) {
      for (const s of statements) await s.run();
    },
    shared,
    users,
    invites,
    userData,
    userSources,
    executed,
  };
}
