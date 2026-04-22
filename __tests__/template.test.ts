import { describe, it, expect } from 'vitest'
import { renderTemplate } from '../lib/crm/template'

describe('renderTemplate', () => {
  it('replaces contact first name', () => {
    const result = renderTemplate('Hi {{contact.first_name}}!', { contact: { firstName: 'Ahmad' } })
    expect(result).toBe('Hi Ahmad!')
  })

  it('replaces child name', () => {
    const result = renderTemplate('Trial for {{contact.child_name_1}}', { contact: { childName1: 'Aryan' } })
    expect(result).toBe('Trial for Aryan')
  })

  it('replaces custom values', () => {
    const result = renderTemplate('Call {{custom_values.branch_phone}}', { customValues: { branch_phone: '+603-1234-5678' } })
    expect(result).toBe('Call +603-1234-5678')
  })

  it('replaces branch name', () => {
    const result = renderTemplate('Welcome to {{branch.name}}', { branch: { name: 'KL Branch' } })
    expect(result).toBe('Welcome to KL Branch')
  })

  it('formats opportunity value as MYR', () => {
    const result = renderTemplate('Value: {{opportunity.value}}', { opportunity: { value: 5200 } })
    expect(result).toContain('5,200')
    expect(result).toContain('RM')
  })

  it('leaves unknown tags unchanged', () => {
    const result = renderTemplate('Hello {{unknown.tag}}', {})
    expect(result).toBe('Hello {{unknown.tag}}')
  })

  it('handles multiple replacements in one string', () => {
    const result = renderTemplate(
      '{{contact.first_name}} — child: {{contact.child_name_1}}, age {{contact.child_age_1}}',
      { contact: { firstName: 'Siti', childName1: 'Aryan', childAge1: '5 years' } },
    )
    expect(result).toBe('Siti — child: Aryan, age 5 years')
  })

  it('handles missing optional values gracefully', () => {
    const result = renderTemplate('Hi {{contact.first_name}}, ref: {{contact.email}}', { contact: { firstName: 'Ali' } })
    expect(result).toBe('Hi Ali, ref: {{contact.email}}')
  })
})
