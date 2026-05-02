const SUFFIX_RE = /^\d{6}$/;
const FULL_ID_RE = /^\d{8}$/;

export interface EmployeeIdParts {
  prefix: string;
  suffix: string;
}

export function splitEmployeeId(id: string): EmployeeIdParts {
  if (!id || typeof id !== 'string' || !FULL_ID_RE.test(id)) {
    return { prefix: '', suffix: '' };
  }
  return { prefix: id.slice(0, 2), suffix: id.slice(2) };
}

export function composeEmployeeId(prefix: string, suffix: string): string {
  return `${prefix}${suffix}`;
}

export function isValidSuffix(suffix: string): boolean {
  return typeof suffix === 'string' && SUFFIX_RE.test(suffix);
}

export function isValidEmployeeId(id: string): boolean {
  return typeof id === 'string' && FULL_ID_RE.test(id);
}
