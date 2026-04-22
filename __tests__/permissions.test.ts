import { describe, it, expect } from 'vitest'
import { hasPermission, requirePermission, CrmPermissionError } from '../lib/crm/permissions'

describe('hasPermission', () => {
  it('SUPER_ADMIN has all permissions', () => {
    expect(hasPermission('SUPER_ADMIN', 'contacts:delete')).toBe(true)
    expect(hasPermission('SUPER_ADMIN', 'audit:read')).toBe(true)
    expect(hasPermission('SUPER_ADMIN', 'team:delete')).toBe(true)
  })

  it('AGENCY_ADMIN has all permissions', () => {
    expect(hasPermission('AGENCY_ADMIN', 'contacts:write')).toBe(true)
    expect(hasPermission('AGENCY_ADMIN', 'integrations:write')).toBe(true)
  })

  it('BRANCH_MANAGER has contacts and opportunities', () => {
    expect(hasPermission('BRANCH_MANAGER', 'contacts:read')).toBe(true)
    expect(hasPermission('BRANCH_MANAGER', 'opportunities:write')).toBe(true)
    expect(hasPermission('BRANCH_MANAGER', 'dashboard:read')).toBe(true)
  })

  it('BRANCH_MANAGER cannot access audit log', () => {
    expect(hasPermission('BRANCH_MANAGER', 'audit:read')).toBe(false)
  })

  it('BRANCH_STAFF can read and write contacts', () => {
    expect(hasPermission('BRANCH_STAFF', 'contacts:read')).toBe(true)
    expect(hasPermission('BRANCH_STAFF', 'contacts:write')).toBe(true)
  })

  it('BRANCH_STAFF cannot delete contacts', () => {
    expect(hasPermission('BRANCH_STAFF', 'contacts:delete')).toBe(false)
  })

  it('BRANCH_STAFF cannot access team settings', () => {
    expect(hasPermission('BRANCH_STAFF', 'team:write')).toBe(false)
  })
})

describe('requirePermission', () => {
  it('does not throw when permission granted', () => {
    expect(() => requirePermission('SUPER_ADMIN', 'contacts:delete')).not.toThrow()
  })

  it('throws CrmPermissionError when denied', () => {
    expect(() => requirePermission('BRANCH_STAFF', 'contacts:delete')).toThrow(CrmPermissionError)
  })

  it('thrown error has status 403', () => {
    try {
      requirePermission('BRANCH_STAFF', 'audit:read')
    } catch (err) {
      expect(err).toBeInstanceOf(CrmPermissionError)
      expect((err as CrmPermissionError).statusCode).toBe(403)
    }
  })
})
