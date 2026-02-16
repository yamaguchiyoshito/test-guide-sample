import { describe, expect, test } from 'vitest';
import {
  buildJapaneseFormPayload,
  formatJapaneseAddressDisplay,
  formatJapanesePhoneNumber,
  formatJapanesePostalCode,
  formatJapaneseYenAmount,
  isValidJapaneseFurigana,
  isValidJapaneseDateInput,
  isValidJapaneseName,
  isValidJapanesePhoneNumber,
  isValidJapanesePostalCode,
  normalizeFurigana,
  normalizeJapaneseAddressLine,
  normalizeJapaneseDateInput,
  normalizeJapaneseNumericInput,
  normalizeJapanesePhoneNumber,
  normalizeJapanesePostalCode,
  normalizeJapaneseText,
  parseJapaneseDateInput,
  parseJapaneseYenAmount,
  validateJapaneseFormValues,
} from './japaneseFormUtils';

describe('normalizeJapaneseText', () => {
  test('全角英数/全角空白/連続空白を正規化する', () => {
    expect(normalizeJapaneseText('　ＡＢＣ　１２３　')).toBe('ABC 123');
  });
});

describe('normalizeFurigana', () => {
  test('ひらがなと半角カナを全角カタカナへ変換する', () => {
    expect(normalizeFurigana(' やまだ　ﾀﾛｳ ')).toBe('ヤマダ タロウ');
  });
});

describe('postal code', () => {
  test('郵便番号を正規化/整形できる', () => {
    expect(normalizeJapanesePostalCode('１２３-４５６７')).toBe('1234567');
    expect(formatJapanesePostalCode('１２３-４５６７')).toBe('123-4567');
  });

  test('郵便番号の妥当性を判定できる', () => {
    expect(isValidJapanesePostalCode('123-4567')).toBe(true);
    expect(isValidJapanesePostalCode('123-456')).toBe(false);
  });
});

describe('phone number', () => {
  test('電話番号を正規化/整形できる', () => {
    expect(normalizeJapanesePhoneNumber('０９０ー１２３４ー５６７８')).toBe('09012345678');
    expect(formatJapanesePhoneNumber('09012345678')).toBe('090-1234-5678');
    expect(formatJapanesePhoneNumber('0312345678')).toBe('03-1234-5678');
  });

  test('電話番号の妥当性を判定できる', () => {
    expect(isValidJapanesePhoneNumber('090-1234-5678')).toBe(true);
    expect(isValidJapanesePhoneNumber('9012345678')).toBe(false);
  });
});

describe('name/furigana validation', () => {
  test('氏名とフリガナの妥当性を判定できる', () => {
    expect(isValidJapaneseName('山田 太郎')).toBe(true);
    expect(isValidJapaneseName('@@@')).toBe(false);
    expect(isValidJapaneseFurigana('ヤマダ タロウ')).toBe(true);
    expect(isValidJapaneseFurigana('山田太郎')).toBe(false);
  });
});

describe('address utils', () => {
  test('住所行を正規化できる', () => {
    expect(normalizeJapaneseAddressLine(' 東京都　千代田区 1ー2ー3 ')).toBe(
      '東京都 千代田区 1-2-3',
    );
  });

  test('住所表示文字列を整形できる', () => {
    expect(
      formatJapaneseAddressDisplay({
        postalCode: '1000001',
        prefecture: '東京都',
        city: '千代田区',
        addressLine1: '千代田 1-1',
        addressLine2: '皇居外苑',
      }),
    ).toBe('〒100-0001\n東京都千代田区千代田 1-1\n皇居外苑');
  });
});

describe('date utils', () => {
  test('日付入力を正規化できる', () => {
    expect(normalizeJapaneseDateInput('２０２６年２月５日')).toBe('2026-02-05');
    expect(normalizeJapaneseDateInput('2026/2/5')).toBe('2026-02-05');
  });

  test('日付入力の妥当性を判定できる', () => {
    expect(parseJapaneseDateInput('2026-02-05')).toEqual(new Date(Date.UTC(2026, 1, 5)));
    expect(isValidJapaneseDateInput('2026-02-29')).toBe(false);
    expect(isValidJapaneseDateInput('2026-02-05', { min: '2026-01-01', max: '2026-12-31' })).toBe(
      true,
    );
    expect(isValidJapaneseDateInput('2025-12-31', { min: '2026-01-01' })).toBe(false);
  });
});

describe('yen utils', () => {
  test('金額入力を正規化/変換/表示できる', () => {
    expect(normalizeJapaneseNumericInput(' １２,３４５円 ')).toBe('12345');
    expect(parseJapaneseYenAmount('１２,３４５円')).toBe(12345);
    expect(formatJapaneseYenAmount(12345)).toBe('￥12,345');
  });

  test('不正な金額入力はnull', () => {
    expect(parseJapaneseYenAmount('-100')).toBeNull();
    expect(parseJapaneseYenAmount('abc')).toBeNull();
  });
});

describe('buildJapaneseFormPayload', () => {
  test('送信前にフィールドルールに従って正規化する', () => {
    const payload = buildJapaneseFormPayload(
      {
        name: '　山田　太郎　',
        email: ' USER@EXAMPLE.COM ',
        furigana: 'やまだ　たろう',
        postalCode: '１２３-４５６７',
        phoneNumber: '０９０ー１２３４ー５６７８',
        address: ' 東京都　千代田区 1ー2ー3 ',
        birthday: '2026年2月5日',
        amount: '１２,０００円',
        note: '　メモ　',
      },
      {
        name: { type: 'name', required: true },
        email: { type: 'email', required: true },
        furigana: { type: 'furigana', required: true },
        postalCode: { type: 'postalCode' },
        phoneNumber: { type: 'phoneNumber' },
        address: { type: 'addressLine' },
        birthday: { type: 'date' },
        amount: { type: 'currency' },
      },
    );

    expect(payload).toEqual({
      name: '山田 太郎',
      email: 'user@example.com',
      furigana: 'ヤマダ タロウ',
      postalCode: '1234567',
      phoneNumber: '09012345678',
      address: '東京都 千代田区 1-2-3',
      birthday: '2026-02-05',
      amount: '12000',
      note: 'メモ',
    });
  });

  test('空文字は dropEmptyString=true で除外する', () => {
    const payload = buildJapaneseFormPayload(
      {
        note: '   ',
      },
      {
        note: { type: 'text' },
      },
    );

    expect(payload).toEqual({});
  });
});

describe('validateJapaneseFormValues', () => {
  test('必須エラーと形式エラーを返す', () => {
    const errors = validateJapaneseFormValues(
      {
        name: '',
        email: 'invalid-mail',
        furigana: '山田',
        postalCode: '1234',
        phoneNumber: '12345',
        birthday: '2026-02-29',
        amount: '-1',
      },
      {
        name: { type: 'name', required: true },
        email: { type: 'email', required: true },
        furigana: { type: 'furigana', required: true },
        postalCode: { type: 'postalCode' },
        phoneNumber: { type: 'phoneNumber' },
        birthday: { type: 'date' },
        amount: { type: 'currency' },
      },
    );

    expect(errors).toEqual({
      name: '必須項目です',
      email: 'メールアドレス形式が不正です',
      furigana: 'フリガナはカタカナで入力してください',
      postalCode: '郵便番号は7桁で入力してください',
      phoneNumber: '電話番号の形式が不正です',
      birthday: '日付の形式が不正です',
      amount: '金額の形式が不正です',
    });
  });

  test('妥当な値はエラーなし', () => {
    const errors = validateJapaneseFormValues(
      {
        name: '山田 太郎',
        email: 'user@example.com',
        furigana: 'ヤマダ タロウ',
        postalCode: '123-4567',
        phoneNumber: '090-1234-5678',
      },
      {
        name: { type: 'name', required: true },
        email: { type: 'email', required: true },
        furigana: { type: 'furigana', required: true },
        postalCode: { type: 'postalCode', required: true },
        phoneNumber: { type: 'phoneNumber', required: true },
      },
    );

    expect(errors).toEqual({});
  });
});
