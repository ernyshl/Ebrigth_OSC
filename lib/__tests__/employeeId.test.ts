import { describe, it, expect } from 'vitest';
import {
  splitEmployeeId,
  composeEmployeeId,
  isValidEmployeeId,
  isValidSuffix,
} from '@/lib/employeeId';

describe('splitEmployeeId', () => {
  it('splits a valid 8-digit ID into prefix and suffix', () => {
    expect(splitEmployeeId('33080012')).toEqual({ prefix: '33', suffix: '080012' });
  });

  it('returns empty parts for an invalid ID (too short)', () => {
    expect(splitEmployeeId('12345')).toEqual({ prefix: '', suffix: '' });
  });

  it('returns empty parts for an invalid ID (non-digits)', () => {
    expect(splitEmployeeId('33ABCD12')).toEqual({ prefix: '', suffix: '' });
  });

  it('handles unrecognized prefix by still splitting (caller decides what to do)', () => {
    expect(splitEmployeeId('99000001')).toEqual({ prefix: '99', suffix: '000001' });
  });

  it('handles empty/null input safely', () => {
    expect(splitEmployeeId('')).toEqual({ prefix: '', suffix: '' });
    expect(splitEmployeeId(null as unknown as string)).toEqual({ prefix: '', suffix: '' });
    expect(splitEmployeeId(undefined as unknown as string)).toEqual({ prefix: '', suffix: '' });
  });
});

describe('composeEmployeeId', () => {
  it('joins prefix and suffix into 8 digits', () => {
    expect(composeEmployeeId('33', '080012')).toBe('33080012');
  });

  it('preserves leading zeros in suffix', () => {
    expect(composeEmployeeId('11', '000001')).toBe('11000001');
  });
});

describe('isValidSuffix', () => {
  it('accepts exactly 6 digits', () => {
    expect(isValidSuffix('000001')).toBe(true);
    expect(isValidSuffix('999999')).toBe(true);
  });

  it('rejects fewer than 6 digits', () => {
    expect(isValidSuffix('12345')).toBe(false);
  });

  it('rejects more than 6 digits', () => {
    expect(isValidSuffix('1234567')).toBe(false);
  });

  it('rejects non-digit characters', () => {
    expect(isValidSuffix('12345a')).toBe(false);
    expect(isValidSuffix('12 345')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidSuffix('')).toBe(false);
  });
});

describe('isValidEmployeeId', () => {
  it('accepts exactly 8 digits', () => {
    expect(isValidEmployeeId('33080012')).toBe(true);
    expect(isValidEmployeeId('00000000')).toBe(true);
  });

  it('rejects fewer than 8 digits', () => {
    expect(isValidEmployeeId('3308001')).toBe(false);
  });

  it('rejects more than 8 digits', () => {
    expect(isValidEmployeeId('330800123')).toBe(false);
  });

  it('rejects non-digit characters', () => {
    expect(isValidEmployeeId('3308001A')).toBe(false);
  });

  it('rejects empty/null/undefined', () => {
    expect(isValidEmployeeId('')).toBe(false);
    expect(isValidEmployeeId(null as unknown as string)).toBe(false);
    expect(isValidEmployeeId(undefined as unknown as string)).toBe(false);
  });
});
