import type { MockScenario } from './scenarios';
import { mockScenarios, withScenarioHeader } from './scenarios';

export interface ScenarioMatrixCase {
  id: string;
  scenario: MockScenario;
  headers: Record<string, string>;
}

export interface ScenarioMatrixOptions {
  include?: MockScenario[];
  exclude?: MockScenario[];
  baseHeaders?: Record<string, string>;
}

/**
 * 目的: モックシナリオのテストケース群を機械的に生成する。
 * 用途: パラメータ化テストで、正常系/異常系のシナリオ網羅を簡潔に書くために使う。
 */
export function createScenarioMatrix(
  options: ScenarioMatrixOptions = {},
): ScenarioMatrixCase[] {
  const include = options.include ?? [...mockScenarios];
  const exclude = new Set(options.exclude ?? []);
  const baseHeaders = options.baseHeaders ?? {};

  return include
    .filter((scenario) => !exclude.has(scenario))
    .map((scenario) => ({
      id: `scenario:${scenario}`,
      scenario,
      headers: withScenarioHeader(baseHeaders, scenario),
    }));
}
