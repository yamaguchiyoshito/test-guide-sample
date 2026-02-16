export interface TestRunMetrics {
  runId: string;
  startedAt: string;
  finishedAt: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  flaky: number;
}

/**
 * 目的: テスト実行メトリクスをゼロ値で初期化する。
 * 用途: 実行開始時にメトリクスオブジェクトを生成し、後段で集計値を埋める時に使う。
 */
export function createEmptyTestRunMetrics(runId: string): TestRunMetrics {
  // startedAt/finishedAtを同一時刻で初期化し、後段でfinishedAtだけ更新する。
  const now = new Date().toISOString();
  return {
    runId,
    startedAt: now,
    finishedAt: now,
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    flaky: 0,
  };
}

/**
 * 目的: 集計値を反映しつつ実行終了時刻を確定する。
 * 用途: テスト終了フックでメトリクスを確定させる時に使う。
 */
export function finalizeTestRunMetrics(
  metrics: TestRunMetrics,
  patch: Partial<Omit<TestRunMetrics, 'runId' | 'startedAt'>>,
): TestRunMetrics {
  // 集計値は呼び出し側が渡し、この関数は終了時刻の確定に責務を絞る。
  return {
    ...metrics,
    ...patch,
    finishedAt: new Date().toISOString(),
  };
}

/**
 * 目的: メトリクスを永続化しやすいJSON文字列へ変換する。
 * 用途: CIアーティファクトやログ出力へ保存する時に使う。
 */
export function toMetricsJson(metrics: TestRunMetrics): string {
  return JSON.stringify(metrics, null, 2);
}
