export interface CreateTestQueryDefaultsOptions {
  retry?: boolean;
  staleTime?: number;
  gcTime?: number;
}

export interface TestQueryDefaults {
  queries: {
    retry: boolean;
    staleTime: number;
    gcTime: number;
    refetchOnWindowFocus: boolean;
    refetchOnReconnect: boolean;
  };
  mutations: {
    retry: boolean;
  };
}

/**
 * 目的: テスト実行に適したReact Query defaultOptionsを生成する。
 * 用途: `createTestQueryClient` から呼び、各テストの設定差分を最小化する。
 */
export function createTestQueryDefaults(
  options: CreateTestQueryDefaultsOptions = {},
): TestQueryDefaults {
  // テストでは「自動再試行しない・自動再取得しない」を既定にする。
  const { retry = false, staleTime = 0, gcTime = 0 } = options;

  return {
    queries: {
      retry,
      staleTime,
      gcTime,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
    mutations: {
      retry: false,
    },
  };
}
