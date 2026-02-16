export interface NetworkCondition {
  delayMs?: number;
  failTimes?: number;
  failStatus?: number;
  failBody?: unknown;
  timeoutMs?: number;
}

export interface NetworkConditionState {
  remainingFailures: number;
  config: Required<Omit<NetworkCondition, 'failBody'>> & { failBody?: unknown };
}

export interface NetworkConditionDecision {
  delayMs: number;
  timeoutMs: number;
  shouldFail: boolean;
  failStatus: number;
  failBody?: unknown;
}

/**
 * 目的: 通信状態（遅延・失敗回数・タイムアウト）を状態付きで初期化する。
 * 用途: MSWハンドラでケースごとに同じネットワーク条件を再利用する時に使う。
 */
export function createNetworkConditionState(
  condition: NetworkCondition = {},
): NetworkConditionState {
  return {
    remainingFailures: condition.failTimes ?? 0,
    config: {
      delayMs: condition.delayMs ?? 0,
      failTimes: condition.failTimes ?? 0,
      failStatus: condition.failStatus ?? 500,
      timeoutMs: condition.timeoutMs ?? 0,
      failBody: condition.failBody,
    },
  };
}

/**
 * 目的: 次回リクエストに適用すべきネットワーク条件を1回分取り出す。
 * 用途: ハンドラ内で `delay` やエラーレスポンス分岐の判断材料に使う。
 */
export function consumeNetworkCondition(
  state: NetworkConditionState,
): NetworkConditionDecision {
  const shouldFail = state.remainingFailures > 0;
  if (shouldFail) {
    state.remainingFailures -= 1;
  }

  return {
    delayMs: state.config.delayMs,
    timeoutMs: state.config.timeoutMs,
    shouldFail,
    failStatus: state.config.failStatus,
    failBody: state.config.failBody,
  };
}

/**
 * 目的: 決定済みネットワーク条件に従って処理実行をラップする。
 * 用途: 実ハンドラロジックを保持したまま、失敗/遅延/タイムアウト分岐を注入する時に使う。
 */
export async function runWithNetworkCondition<T>(
  decision: NetworkConditionDecision,
  handlers: {
    onSuccess: () => Promise<T> | T;
    onFailure: (status: number, body: unknown) => Promise<T> | T;
    onTimeout: () => Promise<T> | T;
    sleep: (ms: number) => Promise<void>;
  },
): Promise<T> {
  if (decision.delayMs > 0) {
    await handlers.sleep(decision.delayMs);
  }

  if (decision.timeoutMs > 0) {
    await handlers.sleep(decision.timeoutMs);
    return handlers.onTimeout();
  }

  if (decision.shouldFail) {
    return handlers.onFailure(decision.failStatus, decision.failBody);
  }

  return handlers.onSuccess();
}
