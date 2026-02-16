export interface ApiClientRequestOptions<TBody = unknown> {
  method?: string;
  query?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  body?: TBody;
}

export interface ApiClientResponse<TData = unknown> {
  data: TData;
  status: number;
  headers: Record<string, string>;
}

export interface ApiClientCall<TBody = unknown> {
  path: string;
  options: ApiClientRequestOptions<TBody>;
}

export type ApiClientMockHandler = (
  call: ApiClientCall,
) => ApiClientResponse | Promise<ApiClientResponse>;

export interface ApiClientMock {
  requestJson: <TRes, TBody = unknown>(
    path: string,
    options?: ApiClientRequestOptions<TBody>,
  ) => Promise<ApiClientResponse<TRes>>;
  getCalls: () => ApiClientCall[];
  clearCalls: () => void;
}

/**
 * 目的: APIクライアント層を差し替えるモックを最小コストで作成する。
 * 用途: ドメインクライアントやHookのテストで、通信結果をケースごとに制御したい時に使う。
 */
export function createApiClientMock(handler: ApiClientMockHandler): ApiClientMock {
  const calls: ApiClientCall[] = [];

  const requestJson = async <TRes, TBody = unknown>(
    path: string,
    options: ApiClientRequestOptions<TBody> = {},
  ): Promise<ApiClientResponse<TRes>> => {
    const call: ApiClientCall<TBody> = {
      path,
      options: {
        method: options.method ?? 'GET',
        query: options.query,
        headers: options.headers,
        body: options.body,
      },
    };

    calls.push(call);

    const result = await handler(call);
    return {
      data: result.data as TRes,
      status: result.status ?? 200,
      headers: result.headers ?? {},
    };
  };

  return {
    requestJson,
    getCalls: () => [...calls],
    clearCalls: () => {
      calls.length = 0;
    },
  };
}
