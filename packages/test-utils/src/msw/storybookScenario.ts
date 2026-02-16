import {
  clearMockScenario,
  setMockScenario,
} from './mockScenario';
import type { MockScenario } from './scenarios';

/**
 * 目的: Storybookツールバー値をモックシナリオ状態へ反映する。
 * 用途: Story切替時にMSW応答を即座に切り替える共通入口として使う。
 */
export function applyStorybookMockScenario(scenario: MockScenario): void {
  // default選択時は明示的にキーを消して、通常ハンドラに戻す。
  if (scenario === 'default') {
    clearMockScenario();
    return;
  }
  setMockScenario(scenario);
}
