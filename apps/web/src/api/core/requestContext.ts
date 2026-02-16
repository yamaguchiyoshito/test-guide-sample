export interface RequestContext {
  page?: string;
  action?: string;
}

/**
 * 目的: リクエスト単位の追跡IDを生成する。
 * 用途: クライアント/サーバーログを突き合わせる相関IDとしてヘッダへ付与する。
 */
export function generateRequestId(): string {
  // 可能ならUUIDを優先し、未対応環境では時刻+乱数で代替する。
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * 目的: モックシナリオ指定の現在値を取得する。
 * 用途: HTTPクライアントが `x-mock-scenario` ヘッダを付与する条件判定に使う。
 */
export function getMockScenario(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  // defaultは「シナリオなし」と同義としてnull扱いに寄せる。
  const scenario = localStorage.getItem('MOCK_SCENARIO');
  if (!scenario || scenario === 'default') {
    return null;
  }

  return scenario;
}
