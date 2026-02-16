import { normalizeEmail } from './utils';

export interface JapaneseTextNormalizeOptions {
  trim?: boolean;
  collapseSpaces?: boolean;
  normalizeWidth?: boolean;
}

const DEFAULT_TEXT_NORMALIZE_OPTIONS: Required<JapaneseTextNormalizeOptions> = {
  trim: true,
  collapseSpaces: true,
  normalizeWidth: true,
};

const HYPHEN_VARIANTS_PATTERN = /[‐‑‒–—―−ーｰ－]/g;
const FURIGANA_PATTERN = /^[ァ-ヶー・\s]+$/u;
const JAPANESE_NAME_PATTERN =
  /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}々〆ヵヶー・\sA-Za-z]+$/u;
const SIMPLE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const JAPANESE_YEN_FORMATTER = new Intl.NumberFormat('ja-JP', {
  style: 'currency',
  currency: 'JPY',
  maximumFractionDigits: 0,
});

/**
 * 目的: 日本語フォーム入力の空白・幅を統一する。
 * 用途: 入力編集中と送信前で同じ正規化ルールを適用し、サーバー側との差分を減らす。
 */
export function normalizeJapaneseText(
  value: string,
  options: JapaneseTextNormalizeOptions = {},
): string {
  const merged = { ...DEFAULT_TEXT_NORMALIZE_OPTIONS, ...options };

  let normalized = merged.normalizeWidth ? value.normalize('NFKC') : value;
  normalized = normalized.replace(/\u3000/g, ' ');

  if (merged.collapseSpaces) {
    normalized = normalized.replace(/[ \t]+/g, ' ');
  }

  if (merged.trim) {
    normalized = normalized.trim();
  }

  return normalized;
}

/**
 * 目的: フリガナ入力を全角カタカナへ正規化する。
 * 用途: ひらがな・半角カナ混在入力を送信前に統一し、検索/照合を安定化する。
 */
export function normalizeFurigana(value: string): string {
  const normalized = normalizeJapaneseText(value, {
    normalizeWidth: true,
    collapseSpaces: true,
    trim: true,
  });

  return normalized.replace(/[ぁ-ゖ]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) + 0x60),
  );
}

/**
 * 目的: 郵便番号入力から数字7桁だけを抽出する。
 * 用途: ハイフン有無・全角数字混在を吸収し、API送信値を固定化する。
 */
export function normalizeJapanesePostalCode(value: string): string {
  return value.normalize('NFKC').replace(/[^\d]/g, '').slice(0, 7);
}

/**
 * 目的: 郵便番号を表示用の `NNN-NNNN` 形式へ整形する。
 * 用途: 入力補助や確認画面の可読性を上げる。
 */
export function formatJapanesePostalCode(value: string): string {
  const digits = normalizeJapanesePostalCode(value);
  if (digits.length <= 3) {
    return digits;
  }
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}`;
}

/**
 * 目的: 電話番号入力から数字のみを抽出する。
 * 用途: 全角数字やハイフン揺れを吸収して送信データを安定化する。
 */
export function normalizeJapanesePhoneNumber(value: string): string {
  return value
    .normalize('NFKC')
    .replace(HYPHEN_VARIANTS_PATTERN, '-')
    .replace(/[^\d]/g, '');
}

/**
 * 目的: 電話番号を国内で一般的な区切りへ整形する。
 * 用途: 一覧/詳細画面での視認性向上に使う。
 */
export function formatJapanesePhoneNumber(value: string): string {
  const digits = normalizeJapanesePhoneNumber(value);

  if (digits.length === 10) {
    if (digits.startsWith('0120')) {
      return `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    if (digits.startsWith('03') || digits.startsWith('06')) {
      return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  if (digits.length === 11) {
    if (digits.startsWith('0800')) {
      return `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  return digits;
}

/**
 * 目的: 郵便番号が国内形式として妥当か判定する。
 * 用途: フロント入力検証で即時エラーメッセージを出す。
 */
export function isValidJapanesePostalCode(value: string): boolean {
  return normalizeJapanesePostalCode(value).length === 7;
}

/**
 * 目的: 電話番号が国内形式として妥当か判定する。
 * 用途: 保存前の形式チェックで明らかな誤入力を弾く。
 */
export function isValidJapanesePhoneNumber(value: string): boolean {
  const digits = normalizeJapanesePhoneNumber(value);
  if (!digits.startsWith('0')) {
    return false;
  }
  return digits.length === 10 || digits.length === 11;
}

/**
 * 目的: フリガナがカタカナ入力か判定する。
 * 用途: ふりがな欄の検証に使用する。
 */
export function isValidJapaneseFurigana(value: string): boolean {
  const normalized = normalizeFurigana(value);
  return normalized.length > 0 && FURIGANA_PATTERN.test(normalized);
}

/**
 * 目的: 氏名入力として許容する文字種か判定する。
 * 用途: 氏名欄の基本検証（漢字/かな/英字/空白）に使用する。
 */
export function isValidJapaneseName(value: string): boolean {
  const normalized = normalizeJapaneseText(value, {
    normalizeWidth: false,
    collapseSpaces: true,
    trim: true,
  });
  return normalized.length > 0 && JAPANESE_NAME_PATTERN.test(normalized);
}

/**
 * 目的: 住所行の表記ゆれ（全角/半角・ハイフン・空白）を正規化する。
 * 用途: 住所入力の一致判定や重複チェックの精度を上げる。
 */
export function normalizeJapaneseAddressLine(value: string): string {
  const normalized = normalizeJapaneseText(value, {
    normalizeWidth: true,
    collapseSpaces: true,
    trim: true,
  });

  return normalized.replace(HYPHEN_VARIANTS_PATTERN, '-').replace(/\s*-\s*/g, '-');
}

export interface JapaneseAddressDisplayInput {
  postalCode?: string;
  prefecture?: string;
  city?: string;
  addressLine1?: string;
  addressLine2?: string;
  multiline?: boolean;
}

/**
 * 目的: 住所情報を画面表示向けの文字列へ統一整形する。
 * 用途: 確認画面や一覧で `〒` 付き住所を同一ルールで描画する。
 */
export function formatJapaneseAddressDisplay(input: JapaneseAddressDisplayInput): string {
  const lines: string[] = [];

  if (input.postalCode) {
    const postal = formatJapanesePostalCode(input.postalCode);
    if (postal) {
      lines.push(`〒${postal}`);
    }
  }

  const line1 = [
    input.prefecture ? normalizeJapaneseText(input.prefecture) : '',
    input.city ? normalizeJapaneseText(input.city) : '',
    input.addressLine1 ? normalizeJapaneseAddressLine(input.addressLine1) : '',
  ]
    .join('')
    .trim();

  if (line1) {
    lines.push(line1);
  }

  if (input.addressLine2) {
    const line2 = normalizeJapaneseAddressLine(input.addressLine2);
    if (line2) {
      lines.push(line2);
    }
  }

  return (input.multiline ?? true) ? lines.join('\n') : lines.join(' ');
}

/**
 * 目的: 金額入力を数値解釈しやすい文字列へ正規化する。
 * 用途: 全角数字や `円`, `,` を含む入力を送信前に統一する。
 */
export function normalizeJapaneseNumericInput(value: string): string {
  const normalized = value
    .normalize('NFKC')
    .replace(/[,\s]/g, '')
    .replace(/円/g, '')
    .replace(/[^\d.-]/g, '');

  if (normalized === '' || normalized === '-') {
    return '';
  }

  const minus = normalized.startsWith('-') ? '-' : '';
  const unsigned = minus ? normalized.slice(1) : normalized;
  const compact = unsigned.replace(/-/g, '');

  return `${minus}${compact}`;
}

/**
 * 目的: 日本円入力を整数(円)へ変換する。
 * 用途: 送信前に `12,000円` のようなUI入力を数値へ正規化する。
 */
export function parseJapaneseYenAmount(value: string): number | null {
  const normalized = normalizeJapaneseNumericInput(value);
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Math.round(parsed);
}

/**
 * 目的: 円金額を日本語表示向けにフォーマットする。
 * 用途: 明細・確認画面での表示形式を統一する。
 */
export function formatJapaneseYenAmount(value: number): string {
  const safe = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  return JAPANESE_YEN_FORMATTER.format(safe);
}

/**
 * 目的: 日本語日付入力を `YYYY-MM-DD` 形式へ正規化する。
 * 用途: `2026/2/5` や `2026年2月5日` の揺れを同一形式で扱う。
 */
export function normalizeJapaneseDateInput(value: string): string {
  const normalized = normalizeJapaneseText(value, {
    normalizeWidth: true,
    collapseSpaces: true,
    trim: true,
  })
    .replace(/[年月]/g, '-')
    .replace(/日/g, '')
    .replace(/[/.]/g, '-')
    .replace(/-+/g, '-');

  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) {
    return normalized;
  }

  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
}

/**
 * 目的: 正規化済み日付文字列を Date(UTC) へ変換する。
 * 用途: 日付妥当性判定や範囲検証で共通利用する。
 */
export function parseJapaneseDateInput(value: string): Date | null {
  const normalized = normalizeJapaneseDateInput(value);
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

export interface JapaneseDateValidationOptions {
  min?: string;
  max?: string;
}

/**
 * 目的: 日本語日付入力の形式と範囲を検証する。
 * 用途: 生年月日や申請日の入力チェックを共通化する。
 */
export function isValidJapaneseDateInput(
  value: string,
  options: JapaneseDateValidationOptions = {},
): boolean {
  const date = parseJapaneseDateInput(value);
  if (!date) {
    return false;
  }

  const min = options.min ? parseJapaneseDateInput(options.min) : null;
  const max = options.max ? parseJapaneseDateInput(options.max) : null;

  if (min && date < min) {
    return false;
  }

  if (max && date > max) {
    return false;
  }

  return true;
}

export type JapaneseFormFieldType =
  | 'text'
  | 'name'
  | 'email'
  | 'furigana'
  | 'postalCode'
  | 'phoneNumber'
  | 'addressLine'
  | 'date'
  | 'currency';

export interface JapaneseFormFieldRule {
  type: JapaneseFormFieldType;
  required?: boolean;
}

export type JapaneseFormFieldRules = Record<string, JapaneseFormFieldRule>;

export interface BuildJapaneseFormPayloadOptions {
  dropEmptyString?: boolean;
}

function normalizeFieldValue(value: string, type: JapaneseFormFieldType): string {
  switch (type) {
    case 'email':
      return normalizeEmail(value);
    case 'furigana':
      return normalizeFurigana(value);
    case 'postalCode':
      return normalizeJapanesePostalCode(value);
    case 'phoneNumber':
      return normalizeJapanesePhoneNumber(value);
    case 'addressLine':
      return normalizeJapaneseAddressLine(value);
    case 'date':
      return normalizeJapaneseDateInput(value);
    case 'currency':
      return normalizeJapaneseNumericInput(value);
    case 'name':
    case 'text':
    default:
      return normalizeJapaneseText(value);
  }
}

/**
 * 目的: 日本語フォーム値を送信向けに一括正規化する。
 * 用途: 入力コンポーネントごとの個別変換をなくし、API送信前処理を共通化する。
 */
export function buildJapaneseFormPayload(
  input: Record<string, unknown>,
  rules: JapaneseFormFieldRules,
  options: BuildJapaneseFormPayloadOptions = {},
): Record<string, unknown> {
  const dropEmptyString = options.dropEmptyString ?? true;
  const payload: Record<string, unknown> = {};

  for (const [field, rawValue] of Object.entries(input)) {
    if (typeof rawValue !== 'string') {
      payload[field] = rawValue;
      continue;
    }

    const type = rules[field]?.type ?? 'text';
    const normalized = normalizeFieldValue(rawValue, type);

    if (dropEmptyString && normalized.length === 0) {
      continue;
    }

    payload[field] = normalized;
  }

  return payload;
}

function getValidationErrorMessage(type: JapaneseFormFieldType): string {
  switch (type) {
    case 'name':
      return '氏名の形式が不正です';
    case 'email':
      return 'メールアドレス形式が不正です';
    case 'furigana':
      return 'フリガナはカタカナで入力してください';
    case 'postalCode':
      return '郵便番号は7桁で入力してください';
    case 'phoneNumber':
      return '電話番号の形式が不正です';
    case 'addressLine':
      return '住所の形式が不正です';
    case 'date':
      return '日付の形式が不正です';
    case 'currency':
      return '金額の形式が不正です';
    case 'text':
    default:
      return '入力形式が不正です';
  }
}

function isFieldValueValid(value: string, type: JapaneseFormFieldType): boolean {
  switch (type) {
    case 'name':
      return isValidJapaneseName(value);
    case 'email':
      return SIMPLE_EMAIL_PATTERN.test(normalizeEmail(value));
    case 'furigana':
      return isValidJapaneseFurigana(value);
    case 'postalCode':
      return isValidJapanesePostalCode(value);
    case 'phoneNumber':
      return isValidJapanesePhoneNumber(value);
    case 'addressLine':
      return value.length > 0 && value.length <= 120;
    case 'date':
      return isValidJapaneseDateInput(value);
    case 'currency':
      return parseJapaneseYenAmount(value) !== null;
    case 'text':
    default:
      return true;
  }
}

/**
 * 目的: 日本語フォームの必須/形式エラーを一括検証する。
 * 用途: フロント側の共通検証ロジックとして、入力欄ごとの重複実装をなくす。
 */
export function validateJapaneseFormValues(
  values: Record<string, unknown>,
  rules: JapaneseFormFieldRules,
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const [field, rule] of Object.entries(rules)) {
    const rawValue = values[field];
    const value = typeof rawValue === 'string' ? normalizeFieldValue(rawValue, rule.type) : '';

    if (rule.required && value.length === 0) {
      errors[field] = '必須項目です';
      continue;
    }

    if (value.length === 0) {
      continue;
    }

    if (!isFieldValueValid(value, rule.type)) {
      errors[field] = getValidationErrorMessage(rule.type);
    }
  }

  return errors;
}
