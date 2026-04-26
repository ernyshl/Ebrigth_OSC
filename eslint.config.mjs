import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const config = [
  {
    ignores: [
      '.next/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
      'node_modules/**',
      'client/**',
      'hr-dashboard/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    // Downgrade rules that were previously fully suppressed via ignoreDuringBuilds.
    // These are style/quality warnings, not safety issues. Fix incrementally.
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
];

export default config;
