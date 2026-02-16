export interface A11yViolationLike {
  id?: string;
  impact?: string | null;
  description?: string;
  help?: string;
  nodes?: unknown[];
}

export interface A11yCheckResultLike {
  violations?: A11yViolationLike[];
}

export interface A11yAssertionOptions {
  allowViolationIds?: string[];
}

/**
 * 目的: A11y違反一覧を比較・表示しやすい文字列へ整形する。
 * 用途: テスト失敗時のログに違反ID/impact/件数を出す時に使う。
 */
export function formatA11yViolations(
  violations: A11yViolationLike[],
): string {
  if (violations.length === 0) {
    return 'no violations';
  }

  return violations
    .map((violation) => {
      const id = violation.id ?? 'unknown-id';
      const impact = violation.impact ?? 'unknown-impact';
      const nodes = Array.isArray(violation.nodes) ? violation.nodes.length : 0;
      return `${id} (impact=${impact}, nodes=${nodes})`;
    })
    .join(', ');
}

/**
 * 目的: A11y検査結果が許容範囲内かを判定する。
 * 用途: `axe` 結果のうち一部既知違反のみ許容する運用ルールを実装する時に使う。
 */
export function getUnexpectedA11yViolations(
  result: A11yCheckResultLike,
  options: A11yAssertionOptions = {},
): A11yViolationLike[] {
  const allowSet = new Set(options.allowViolationIds ?? []);
  const violations = result.violations ?? [];
  return violations.filter((violation) => {
    const id = violation.id ?? '';
    return !allowSet.has(id);
  });
}

/**
 * 目的: A11y違反が存在しないことをアサートする。
 * 用途: コンポーネント/画面の自動アクセシビリティ検証テストで使う。
 */
export function assertNoA11yViolations(
  result: A11yCheckResultLike,
  options: A11yAssertionOptions = {},
): void {
  const unexpected = getUnexpectedA11yViolations(result, options);
  if (unexpected.length > 0) {
    throw new Error(`A11y violations detected: ${formatA11yViolations(unexpected)}`);
  }
}
