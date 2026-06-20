import {describe, it, expect} from 'vitest';
import {generateGroupCode, isValidGroupCode} from './groupCode';

describe('generateGroupCode', () => {
  it('generates code in HH-XXXXXX format', () => {
    const code = generateGroupCode();
    expect(code).toMatch(/^HH-\d{6}$/);
  });

  it('generates unique codes', () => {
    const codes = new Set(Array.from({length: 20}, () => generateGroupCode()));
    expect(codes.size).toBeGreaterThan(15);
  });
});

describe('isValidGroupCode', () => {
  it('validates correct codes', () => {
    expect(isValidGroupCode('HH-123456')).toBe(true);
    expect(isValidGroupCode('HH-000000')).toBe(true);
    expect(isValidGroupCode('HH-999999')).toBe(true);
  });

  it('rejects wrong prefix', () => {
    expect(isValidGroupCode('XX-123456')).toBe(false);
    expect(isValidGroupCode('BDM-123456')).toBe(false);
  });

  it('rejects wrong length', () => {
    expect(isValidGroupCode('HH-12345')).toBe(false);
    expect(isValidGroupCode('HH-1234567')).toBe(false);
  });

  it('rejects non-numeric suffix', () => {
    expect(isValidGroupCode('HH-12345a')).toBe(false);
    expect(isValidGroupCode('HH-abcdef')).toBe(false);
  });

  it('rejects missing dash', () => {
    expect(isValidGroupCode('HH123456')).toBe(false);
  });
});
