export interface TestLifecycleLike {
  beforeAll: (callback: () => void) => void;
  afterEach: (callback: () => void) => void;
  afterAll: (callback: () => void) => void;
}

export interface SetupTestMswDependencies {
  lifecycle: TestLifecycleLike;
  cleanup?: () => void;
  clearMocks?: () => void;
}

export interface SetupTestMswOptions {
  onUnhandledRequest?: unknown;
  autoCleanup?: boolean;
  autoResetHandlers?: boolean;
  autoClearMocks?: boolean;
}

type MswServerContract = {
  listen: unknown;
  resetHandlers: () => void;
  close: () => void;
};

/**
 * 目的: MSWサーバーの起動/後片付けをテストライフサイクルへ統一的に組み込む。
 * 用途: `setup.ts` から1回呼ぶだけで、各テストの状態初期化を自動化する。
 */
export function setupTestMsw<TServer extends MswServerContract>(
  server: TServer,
  dependencies: SetupTestMswDependencies,
  options: SetupTestMswOptions = {},
): void {
  const {
    onUnhandledRequest = 'error',
    autoCleanup = true,
    autoResetHandlers = true,
    autoClearMocks = true,
  } = options;
  const { lifecycle, cleanup, clearMocks } = dependencies;
  // mswのlistenはthis依存があるため、callでserverに束縛して呼ぶ。
  const listen = server.listen as (options?: { onUnhandledRequest?: unknown }) => void;

  lifecycle.beforeAll(() => {
    listen.call(server, { onUnhandledRequest });
  });

  lifecycle.afterEach(() => {
    if (autoCleanup) {
      cleanup?.();
    }
    // testごとにhandler状態を初期化し、前テストの副作用を遮断する。
    if (autoResetHandlers) {
      server.resetHandlers();
    }
    if (autoClearMocks) {
      clearMocks?.();
    }
  });

  lifecycle.afterAll(() => {
    server.close();
  });
}
