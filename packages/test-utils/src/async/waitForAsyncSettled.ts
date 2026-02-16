export interface WaitForAsyncSettledOptions {
  microtaskTurns?: number;
  waitMs?: number;
}

/**
 * 目的: 非同期処理の完了待ちをテスト側で明示的に制御する。
 * 用途: Promise連鎖やタイマーを跨ぐ状態更新を検証する前の待機処理に使う。
 */
export async function waitForAsyncSettled(
  options: WaitForAsyncSettledOptions = {},
): Promise<void> {
  const { microtaskTurns = 2, waitMs = 0 } = options;

  // Promiseチェーンの後段が実行されるまで、microtaskを明示的に進める。
  for (let i = 0; i < microtaskTurns; i += 1) {
    await Promise.resolve();
  }

  // macrotask待ちが必要なケースのみsetTimeoutを使う。
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}
