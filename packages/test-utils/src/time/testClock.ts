import { freezeTime, type FrozenTimeController } from './freezeTime';

export interface TestClockController {
  readonly now: number;
  set: (value: Date | number | string) => void;
  advanceByMs: (deltaMs: number) => void;
  restore: () => void;
}

/**
 * 目的: テスト内で時刻の進行を段階的に制御できる時計を提供する。
 * 用途: 期限切れ判定やリトライ待機など、時間経過に依存するロジックの検証に使う。
 */
export function createTestClock(
  initialValue: Date | number | string = Date.now(),
): TestClockController {
  let currentTimestamp = new Date(initialValue).getTime();
  let frozen: FrozenTimeController = freezeTime(currentTimestamp);

  const reapply = () => {
    frozen.restore();
    frozen = freezeTime(currentTimestamp);
  };

  return {
    get now() {
      return currentTimestamp;
    },
    set: (value) => {
      currentTimestamp = new Date(value).getTime();
      reapply();
    },
    advanceByMs: (deltaMs) => {
      currentTimestamp += deltaMs;
      reapply();
    },
    restore: () => {
      frozen.restore();
    },
  };
}
