export interface QueryStateLike {
  data?: unknown;
  status?: string;
  fetchStatus?: string;
}

export interface QueryLike {
  queryKey: unknown;
  state?: QueryStateLike;
}

export interface QueryCacheLike {
  findAll: () => QueryLike[];
}

export interface QueryClientLikeWithCache {
  getQueryCache: () => QueryCacheLike;
}

export interface QueryCacheEntrySnapshot {
  key: string;
  status: string;
  fetchStatus: string;
  hasData: boolean;
  dataHash: string;
}

export interface QueryCacheSnapshot {
  entries: QueryCacheEntrySnapshot[];
}

export interface QueryCacheSnapshotDiff {
  added: QueryCacheEntrySnapshot[];
  removed: QueryCacheEntrySnapshot[];
  changed: Array<{
    key: string;
    before: QueryCacheEntrySnapshot;
    after: QueryCacheEntrySnapshot;
  }>;
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value) ?? 'null';
  } catch {
    return '[unserializable]';
  }
}

/**
 * 目的: Queryキャッシュ状態を比較可能なスナップショットへ正規化する。
 * 用途: ミューテーション前後でキャッシュ更新の有無を検証する時に使う。
 */
export function takeQueryCacheSnapshot(
  queryClient: QueryClientLikeWithCache,
): QueryCacheSnapshot {
  const entries = queryClient
    .getQueryCache()
    .findAll()
    .map((query) => {
      const state = query.state ?? {};
      return {
        key: safeJson(query.queryKey),
        status: state.status ?? 'unknown',
        fetchStatus: state.fetchStatus ?? 'unknown',
        hasData: typeof state.data !== 'undefined',
        dataHash: safeJson(state.data),
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));

  return { entries };
}

/**
 * 目的: 2つのQueryキャッシュスナップショット差分を構造化して返す。
 * 用途: 「追加/削除/変更」をテストで個別アサートしたい時に使う。
 */
export function diffQueryCacheSnapshots(
  before: QueryCacheSnapshot,
  after: QueryCacheSnapshot,
): QueryCacheSnapshotDiff {
  const beforeMap = new Map(before.entries.map((entry) => [entry.key, entry]));
  const afterMap = new Map(after.entries.map((entry) => [entry.key, entry]));

  const added: QueryCacheEntrySnapshot[] = [];
  const removed: QueryCacheEntrySnapshot[] = [];
  const changed: QueryCacheSnapshotDiff['changed'] = [];

  for (const [key, afterEntry] of afterMap.entries()) {
    const beforeEntry = beforeMap.get(key);
    if (!beforeEntry) {
      added.push(afterEntry);
      continue;
    }

    const isChanged =
      beforeEntry.status !== afterEntry.status ||
      beforeEntry.fetchStatus !== afterEntry.fetchStatus ||
      beforeEntry.hasData !== afterEntry.hasData ||
      beforeEntry.dataHash !== afterEntry.dataHash;

    if (isChanged) {
      changed.push({
        key,
        before: beforeEntry,
        after: afterEntry,
      });
    }
  }

  for (const [key, beforeEntry] of beforeMap.entries()) {
    if (!afterMap.has(key)) {
      removed.push(beforeEntry);
    }
  }

  return { added, removed, changed };
}
