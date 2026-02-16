export interface ContractValidationResult {
  ok: boolean;
  message?: string;
}

export type ContractValidator<T> = (value: unknown) => value is T;

/**
 * 目的: OpenAPI契約に対するレスポンス妥当性を統一フォーマットで返す。
 * 用途: テスト内で`throw`ではなく結果オブジェクトとして判定し、失敗文言を制御したい時に使う。
 */
export function validateOpenApiResponse<T>(
  payload: unknown,
  validator: ContractValidator<T>,
  context = 'response',
): ContractValidationResult {
  // 例外ではなく結果オブジェクトで返し、テスト側で失敗文言を制御しやすくする。
  const ok = validator(payload);
  if (ok) {
    return { ok: true };
  }
  return {
    ok: false,
    message: `OpenAPI contract violation at ${context}`,
  };
}
