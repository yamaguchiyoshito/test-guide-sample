import { createTestQueryDefaults, type CreateTestQueryDefaultsOptions } from './queryClient';

export interface QueryClientLike {}

export interface QueryClientConstructor<TClient extends QueryClientLike> {
  new (config: { defaultOptions: ReturnType<typeof createTestQueryDefaults> }): TClient;
}

/**
 * 目的: React Queryのテスト向け設定を適用したQueryClientを生成する。
 * 用途: テストごとにretry無効・refetch無効のクライアントを簡単に作る時に使う。
 */
export function createTestQueryClient<TClient extends QueryClientLike>(
  QueryClientCtor: QueryClientConstructor<TClient>,
  options: CreateTestQueryDefaultsOptions = {},
): TClient {
  // optionsの組み立ては共通化し、QueryClient固有の生成だけ注入で差し替える。
  const defaultOptions = createTestQueryDefaults(options);
  return new QueryClientCtor({ defaultOptions });
}
