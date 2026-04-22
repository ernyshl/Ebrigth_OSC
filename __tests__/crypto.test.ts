import { describe, it, expect, beforeAll } from 'vitest'

// Set ENCRYPTION_KEY before importing
beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'a'.repeat(64) // 64 hex chars = 32 bytes
})

describe('crypto encrypt/decrypt', () => {
  it('encrypts and decrypts a string', async () => {
    const { encrypt, decrypt } = await import('../lib/crm/crypto')
    const plaintext = 'secret-api-token-123'
    const encrypted = encrypt(plaintext)
    expect(encrypted).not.toBe(plaintext)
    const decrypted = decrypt(encrypted)
    expect(decrypted).toBe(plaintext)
  })

  it('produces different ciphertext each call (random IV)', async () => {
    const { encrypt } = await import('../lib/crm/crypto')
    const a = encrypt('same-plaintext')
    const b = encrypt('same-plaintext')
    expect(a).not.toBe(b)
  })

  it('throws on tampered ciphertext', async () => {
    const { encrypt, decrypt } = await import('../lib/crm/crypto')
    const encrypted = encrypt('test')
    const tampered = encrypted.slice(0, -4) + 'xxxx'
    expect(() => decrypt(tampered)).toThrow()
  })

  it('encrypts JSON credentials correctly', async () => {
    const { encrypt, decrypt } = await import('../lib/crm/crypto')
    const creds = JSON.stringify({ accessToken: 'tok_abc', phoneNumberId: '12345' })
    const decrypted = decrypt(encrypt(creds))
    expect(JSON.parse(decrypted)).toEqual({ accessToken: 'tok_abc', phoneNumberId: '12345' })
  })
})
