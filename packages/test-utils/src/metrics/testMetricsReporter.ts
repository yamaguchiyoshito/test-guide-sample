import {
  createEmptyTestRunMetrics,
  finalizeTestRunMetrics,
  toMetricsJson,
  type TestRunMetrics,
} from './testRunMetrics';

export interface TestCaseMetric {
  id: string;
  status: 'passed' | 'failed' | 'skipped';
  durationMs?: number;
  flaky?: boolean;
}

export interface TestMetricsWriter {
  write: (path: string, content: string) => Promise<void> | void;
}

export interface TestMetricsReport {
  summary: TestRunMetrics;
  averageDurationMs: number;
  longestCases: Array<{
    id: string;
    durationMs: number;
  }>;
}

/**
 * 目的: テストケース一覧から品質メトリクス要約を生成する。
 * 用途: CI終了時に失敗率・flaky率・実行時間を定量的に記録する時に使う。
 */
export function buildTestMetricsReport(
  runId: string,
  cases: TestCaseMetric[],
): TestMetricsReport {
  const initial = createEmptyTestRunMetrics(runId);

  const total = cases.length;
  const passed = cases.filter((item) => item.status === 'passed').length;
  const failed = cases.filter((item) => item.status === 'failed').length;
  const skipped = cases.filter((item) => item.status === 'skipped').length;
  const flaky = cases.filter((item) => item.flaky === true).length;

  const durations = cases
    .map((item) => item.durationMs ?? 0)
    .filter((value) => value > 0);

  const averageDurationMs =
    durations.length > 0
      ? Math.round(durations.reduce((acc, value) => acc + value, 0) / durations.length)
      : 0;

  const longestCases = cases
    .map((item) => ({
      id: item.id,
      durationMs: item.durationMs ?? 0,
    }))
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 10);

  const summary = finalizeTestRunMetrics(initial, {
    total,
    passed,
    failed,
    skipped,
    flaky,
  });

  return {
    summary,
    averageDurationMs,
    longestCases,
  };
}

/**
 * 目的: 生成したメトリクスレポートをJSONとして出力する。
 * 用途: CIアーティファクト保存やダッシュボード連携前の共通出力手段として使う。
 */
export async function writeTestMetricsReport(
  report: TestMetricsReport,
  path: string,
  writer: TestMetricsWriter,
): Promise<void> {
  const payload = JSON.stringify(
    {
      summary: report.summary,
      averageDurationMs: report.averageDurationMs,
      longestCases: report.longestCases,
      // 既存ユーティリティを使った互換出力も併記して解析しやすくする。
      summaryJson: toMetricsJson(report.summary),
    },
    null,
    2,
  );

  await writer.write(path, payload);
}
