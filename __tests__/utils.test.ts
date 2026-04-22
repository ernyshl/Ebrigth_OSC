import { describe, it, expect } from 'vitest'
import { formatMYR, slugify, normalizePhone, generateApiKey } from '../lib/crm/utils'

describe('formatMYR', () => {
  it('formats numbers as Malaysian Ringgit', () => {
    const result = formatMYR(5200)
    expect(result).toContain('5,200')
    expect(result).toContain('RM')
  })

  it('handles string inputs (from Prisma Decimal)', () => {
    expect(formatMYR('3800.00')).toContain('3,800')
  })

  it('handles zero', () => {
    expect(formatMYR(0)).toContain('0')
  })
})

describe('slugify', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(slugify('My Form Name')).toBe('my-form-name')
  })

  it('removes special characters', () => {
    expect(slugify('Form @2024!')).toBe('form-2024')
  })

  it('trims leading/trailing hyphens', () => {
    expect(slugify(' hello world ')).toBe('hello-world')
  })
})

describe('normalizePhone', () => {
  it('normalizes Malaysian mobile numbers', () => {
    const result = normalizePhone('0123456789')
    expect(result).toBe('+60123456789')
  })

  it('passes through already normalized numbers', () => {
    expect(normalizePhone('+60123456789')).toBe('+60123456789')
  })

  it('returns original if unparseable', () => {
    expect(normalizePhone('not-a-phone')).toBe('not-a-phone')
  })
})

describe('generateApiKey', () => {
  it('returns key with ek_ prefix', () => {
    const { key, hashed } = generateApiKey()
    expect(key.startsWith('ek_')).toBe(true)
    expect(hashed).not.toBe(key)
    expect(hashed.length).toBe(64) // SHA-256 hex
  })

  it('produces unique keys each call', () => {
    const a = generateApiKey()
    const b = generateApiKey()
    expect(a.key).not.toBe(b.key)
  })
})
