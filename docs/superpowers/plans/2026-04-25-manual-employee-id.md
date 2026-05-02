# Manual Employee ID — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace auto-generated Employee IDs with manual entry: a 7-option role-code dropdown (first 2 digits) + a 6-digit text input. Remove the Rebuild IDs button and its API.

**Architecture:** A small pure-function helper (`lib/employeeId.ts`) handles split/validate/compose. A reusable React component (`app/components/EmployeeIdInput.tsx`) wraps the dropdown + 6-digit input and is used in 3 forms (Add User, side-panel edit, profile edit). The POST/PUT API routes drop the `buildEmployeeId` helpers and validate the manual ID server-side. The Rebuild IDs button + route are deleted.

**Tech Stack:** Next.js 14 App Router, TypeScript, React (client components), Prisma, Tailwind, Vitest.

---

## File Structure

| File | Responsibility | Status |
|---|---|---|
| `lib/constants.ts` | Add `ROLE_CODE_OPTIONS` constant | Modify |
| `lib/employeeId.ts` | Pure helpers: `splitEmployeeId`, `composeEmployeeId`, `isValidEmployeeId`, `isValidSuffix` | Create |
| `lib/__tests__/employeeId.test.ts` | Vitest unit tests for the helpers | Create |
| `app/components/EmployeeIdInput.tsx` | Reusable controlled component: dropdown + 6-digit input + helper text + inline error | Create |
| `app/components/RegistrationForm.tsx` | Use `EmployeeIdInput` at top of Employment Details | Modify |
| `app/components/UserManagement.tsx` | Use `EmployeeIdInput` in side-panel edit mode | Modify |
| `app/components/UserProfile.tsx` | Replace disabled `employeeId` input with `EmployeeIdInput` | Modify |
| `app/components/EmployeeTable.tsx` | Remove `handleRebuildIds` and the button | Modify |
| `app/api/employees/route.ts` | Remove `getPositionCode`/`getDeptCode`/`buildEmployeeId`; require + validate `employeeId` in POST and PUT | Modify |
| `app/api/employees/rebuild-ids/route.ts` | Delete file | Delete |
| `app/user-management/page.tsx` | Add `"employeeId"` as first entry in `CSV_HEADERS` | Modify |

---

## Task 1: Add `ROLE_CODE_OPTIONS` constant

**Files:**
- Modify: `lib/constants.ts` (add after line 95, the `GENDER_OPTIONS` block)

- [ ] **Step 1: Add the constant**

In `lib/constants.ts`, add after the `GENDER_OPTIONS` block (after line 95, before the `getRoleLabel` function on line 97):

```ts
export const ROLE_CODE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "11", label: "11 — CEO" },
  { value: "22", label: "22 — HOD" },
  { value: "33", label: "33 — EXEC" },
  { value: "44", label: "44 — INTERN" },
  { value: "55", label: "55 — BM" },
  { value: "66", label: "66 — FT COACH" },
  { value: "77", label: "77 — PT COACH" },
];

export const ROLE_CODES = ROLE_CODE_OPTIONS.map((o) => o.value);
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no new errors related to `ROLE_CODE_OPTIONS`.

- [ ] **Step 3: Commit**

```bash
git add lib/constants.ts
git commit -m "feat: add ROLE_CODE_OPTIONS constant for employee ID prefix"
```

---

## Task 2: Create `lib/employeeId.ts` pure helpers (TDD — write tests first)

**Files:**
- Create: `lib/__tests__/employeeId.test.ts`
- Create: `lib/employeeId.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/__tests__/employeeId.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/__tests__/employeeId.test.ts`
Expected: FAIL with "Cannot find module '@/lib/employeeId'" or similar import error.

- [ ] **Step 3: Implement the helpers**

Create `lib/employeeId.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/__tests__/employeeId.test.ts`
Expected: all tests PASS (16 tests across 4 describe blocks).

- [ ] **Step 5: Commit**

```bash
git add lib/employeeId.ts lib/__tests__/employeeId.test.ts
git commit -m "feat: add employeeId split/compose/validate helpers with tests"
```

---

## Task 3: Update `POST /api/employees` to require manual employeeId

**Files:**
- Modify: `app/api/employees/route.ts` (lines 1-34, 110, 115, 128-129, 132)

- [ ] **Step 1: Replace the auto-gen helpers with the new validator import**

In `app/api/employees/route.ts`, replace **lines 1-34** with:

```ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, requireRole } from '@/lib/auth';
import { ADMIN_ROLES } from '@/lib/roles';
import { isValidEmployeeId } from '@/lib/employeeId';

// Map BranchStaff DB row → Employee shape expected by the frontend
function toEmployee(s: Record<string, unknown>) {
  return {
    id: String(s.id),
    employeeId: (s.employeeId as string) || `BS-${String(s.id).padStart(3, '0')}`,
    fullName: (s.name as string) || '',
    gender: (s.gender as string) || '',
    nickName: (s.nickname as string) || '',
    email: (s.email as string) || '',
    phone: (s.phone as string) || '',
    nric: (s.nric as string) || '',
    dob: (s.dob as string) || '',
    homeAddress: (s.home_address as string) || '',
    branch: (s.branch as string) || '',
    role: (s.role as string) || '',
    contract: (s.contract as string) || '',
    startDate: (s.start_date as string) || '',
    endDate: (s.endDate as string) || '',
    probation: (s.probation as string) || '',
    rate: (s.rate as string) || '',
    Emc_Number: (s.emergency_phone as string) || '',
    Emc_Email: (s.emergency_name as string) || '',
    Emc_Relationship: (s.emergency_relation as string) || '',
    Signed_Date: (s.signed_date as string) || '',
    Emp_Hire_Date: (s.start_date as string) || '',
    Emp_Type: (s.employment_type as string) || '',
    Emp_Status: (s.status as string) || '',
    Bank: (s.bank as string) || '',
    Bank_Name: (s.bank_name as string) || '',
    Bank_Account: (s.bank_account as string) || '',
    University: (s.university as string) || '',
    accessStatus: (s.accessStatus as string) || 'AUTHORIZED',
    biometricTemplate: (s.biometricTemplate as string) || null,
    registeredAt: s.createdAt ? new Date(s.createdAt as string).toISOString() : '',
    updatedAt: s.updatedAt ? new Date(s.updatedAt as string).toISOString() : '',
  };
}
```

This deletes `getPositionCode`, `getDeptCode`, and `buildEmployeeId` and adds the import for `isValidEmployeeId`.

- [ ] **Step 2: Update the POST destructuring to include `employeeId`**

Find the destructuring block in the POST handler (currently `const { fullName, email, phone, branch, role, gender, ...} = body;`). Add `employeeId` to it:

```ts
const body = await request.json();
const { employeeId, fullName, email, phone, branch, role, gender, nickName, nric, dob,
        homeAddress, contract, startDate, endDate, probation, rate,
        Emc_Number, Emc_Email, Emc_Relationship, Signed_Date, Emp_Hire_Date,
        Emp_Type, Emp_Status, Bank, Bank_Name, Bank_Account, University } = body;
```

- [ ] **Step 3: Update the required-fields validation**

Replace the existing `if (!fullName || !email || !phone || !branch || !role)` check with:

```ts
if (!fullName || !email || !phone || !branch || !role || !employeeId) {
  return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
}
if (!isValidEmployeeId(employeeId)) {
  return NextResponse.json({ error: 'Employee ID must be exactly 8 digits' }, { status: 400 });
}
```

- [ ] **Step 4: Add uniqueness check + remove auto-generation**

Replace the `const count = await prisma.branchStaff.count(); const employeeId = buildEmployeeId(role, branch, count + 1);` lines with:

```ts
const dupId = await prisma.branchStaff.findFirst({ where: { employeeId } });
if (dupId) {
  return NextResponse.json({ error: 'Employee ID already exists' }, { status: 409 });
}
```

(`employeeId` now comes from the request body, so no need to recompute it.)

- [ ] **Step 5: Confirm `employeeId` is passed into `prisma.branchStaff.create`**

The existing `data: { ..., employeeId, ..., accessStatus: 'AUTHORIZED' }` line already passes the local `employeeId` variable. No change needed — but **verify** that the `employeeId` field is still present in the create call's data object after the rewrite. If you accidentally removed it during the previous step, add it back.

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Manual smoke test**

Start the dev server: `npm run dev`. Open `http://localhost:3000/user-management`. Click **+ Add User**. Don't worry that the form doesn't have the new field yet — for this task, manually POST via curl or browser devtools to confirm the API rejects invalid input:

```bash
# Should return 400 — missing employeeId
curl -X POST http://localhost:3000/api/employees \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{"fullName":"TEST","email":"t@t.com","phone":"0123","branch":"HQ","role":"FT EXEC"}'

# Should return 400 — bad format
curl -X POST http://localhost:3000/api/employees \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{"employeeId":"abc","fullName":"TEST","email":"t@t.com","phone":"0123","branch":"HQ","role":"FT EXEC"}'
```

If easier, skip the curl test and rely on Task 6's end-to-end verification once the form is wired up. Note: "skip" here means defer verification, not skip the implementation.

- [ ] **Step 8: Commit**

```bash
git add app/api/employees/route.ts
git commit -m "feat: require + validate manual employeeId on POST /api/employees"
```

---

## Task 4: Update `PUT /api/employees` to validate employeeId on edit

**Files:**
- Modify: `app/api/employees/route.ts` (PUT handler — currently lines 173-241)

- [ ] **Step 1: Update the PUT destructuring (already includes `employeeId`)**

The PUT handler already destructures `employeeId` from the body. No change needed for the destructuring line itself. Verify by reading the destructuring block — `employeeId` should be present.

- [ ] **Step 2: Remove the auto-recalculation block**

Delete this block (currently lines 189-197):

```ts
let recalculatedEmployeeId: string | undefined;
if (branch !== undefined || role !== undefined) {
  const current = await prisma.branchStaff.findUnique({ where: { id: parseInt(id) } });
  if (current) {
    const newBranch = branch ?? current.branch ?? 'HQ';
    const newRole = role ?? current.role ?? '';
    recalculatedEmployeeId = buildEmployeeId(newRole, newBranch, current.id);
  }
}
```

- [ ] **Step 3: Add validation for `employeeId` if present**

In the same place where the deleted block lived (between the destructuring and the `prisma.branchStaff.update` call), add:

```ts
if (employeeId !== undefined) {
  if (!isValidEmployeeId(employeeId)) {
    return NextResponse.json({ error: 'Employee ID must be exactly 8 digits' }, { status: 400 });
  }
  const dupId = await prisma.branchStaff.findFirst({
    where: { employeeId, NOT: { id: parseInt(id) } },
  });
  if (dupId) {
    return NextResponse.json({ error: 'Employee ID already exists' }, { status: 409 });
  }
}
```

- [ ] **Step 4: Replace the recalculated-ID write with a direct passthrough**

In the `prisma.branchStaff.update({ data: { ... } })` block, find the line:

```ts
...(recalculatedEmployeeId !== undefined && { employeeId: recalculatedEmployeeId }),
```

Replace it with:

```ts
...(employeeId !== undefined && { employeeId }),
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors. The `recalculatedEmployeeId` variable is now unused — make sure no stray reference remains.

- [ ] **Step 6: Commit**

```bash
git add app/api/employees/route.ts
git commit -m "feat: validate manual employeeId on PUT /api/employees, remove auto-recalc"
```

---

## Task 5: Delete the rebuild-ids API route

**Files:**
- Delete: `app/api/employees/rebuild-ids/route.ts`
- Delete: `app/api/employees/rebuild-ids/` (the now-empty directory)

- [ ] **Step 1: Delete the route file**

```bash
rm app/api/employees/rebuild-ids/route.ts
rmdir app/api/employees/rebuild-ids
```

- [ ] **Step 2: Confirm no remaining references**

Run: `npx grep -rn "rebuild-ids" app/ lib/ 2>/dev/null` (or use the project's Grep tool for `rebuild-ids` across `app/` and `lib/`).
Expected: only the call site in `app/components/EmployeeTable.tsx:136` (which is removed in Task 9). No other matches.

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add -A app/api/employees/rebuild-ids
git commit -m "chore: delete /api/employees/rebuild-ids route"
```

---

## Task 6: Build the reusable `EmployeeIdInput` component

**Files:**
- Create: `app/components/EmployeeIdInput.tsx`

- [ ] **Step 1: Create the component**

Create `app/components/EmployeeIdInput.tsx`:

```tsx
"use client";

import { ROLE_CODE_OPTIONS } from "@/lib/constants";

interface EmployeeIdInputProps {
  prefix: string;
  suffix: string;
  onPrefixChange: (value: string) => void;
  onSuffixChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  warning?: string;
  label?: string;
}

export default function EmployeeIdInput({
  prefix,
  suffix,
  onPrefixChange,
  onSuffixChange,
  required = true,
  disabled = false,
  error,
  warning,
  label = "Employee ID",
}: EmployeeIdInputProps) {
  const handleSuffixChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 6);
    onSuffixChange(digitsOnly);
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-900 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div className="flex gap-2">
        <select
          value={prefix}
          onChange={(e) => onPrefixChange(e.target.value)}
          disabled={disabled}
          className={`px-3 py-2 border rounded-lg text-gray-900 bg-white text-sm w-44 focus:ring-2 focus:ring-blue-500 ${
            error && !prefix ? "border-red-500" : "border-gray-300"
          }`}
        >
          <option value="">— Select role —</option>
          {ROLE_CODE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={suffix}
          onChange={handleSuffixChange}
          disabled={disabled}
          placeholder="6 digits"
          className={`flex-1 px-3 py-2 border rounded-lg text-gray-900 text-sm tracking-widest font-mono focus:ring-2 focus:ring-blue-500 ${
            error && suffix.length !== 6 ? "border-red-500" : "border-gray-300"
          }`}
        />
      </div>
      <p className="text-xs text-gray-500 mt-1">
        8 digits total — first 2 from dropdown, last 6 entered manually.
      </p>
      {warning && <p className="text-amber-600 text-xs mt-1">{warning}</p>}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/components/EmployeeIdInput.tsx
git commit -m "feat: add reusable EmployeeIdInput component (dropdown + 6-digit input)"
```

---

## Task 7: Wire `EmployeeIdInput` into `RegistrationForm` (Add User)

**Files:**
- Modify: `app/components/RegistrationForm.tsx` (imports, formData state, validateForm, handleSubmit, JSX in Employment Details section)

- [ ] **Step 1: Add imports**

At the top of `app/components/RegistrationForm.tsx`, change the import line (currently line 4):

```ts
import { BRANCH_OPTIONS, ROLE_OPTIONS, CONTRACT_OPTIONS, GENDER_OPTIONS } from "@/lib/constants";
```

to:

```ts
import { BRANCH_OPTIONS, ROLE_OPTIONS, CONTRACT_OPTIONS, GENDER_OPTIONS } from "@/lib/constants";
import EmployeeIdInput from "@/app/components/EmployeeIdInput";
import { composeEmployeeId, isValidSuffix } from "@/lib/employeeId";
```

- [ ] **Step 2: Add prefix/suffix to component state**

Inside the `RegistrationForm` function, after the existing `useState` for `formData`, add:

```ts
const [empIdPrefix, setEmpIdPrefix] = useState("");
const [empIdSuffix, setEmpIdSuffix] = useState("");
```

- [ ] **Step 3: Update `validateForm` to check the new field**

In the `validateForm` function, before `setErrors(newErrors); return Object.keys(newErrors).length === 0;`, add:

```ts
if (!empIdPrefix) newErrors.employeeId = "Select a role code";
else if (!isValidSuffix(empIdSuffix)) newErrors.employeeId = "Enter exactly 6 digits";
```

- [ ] **Step 4: Update `handleSubmit` to send `employeeId` in the body**

In `handleSubmit`, change the `body: JSON.stringify(formData)` line to:

```ts
body: JSON.stringify({ ...formData, employeeId: composeEmployeeId(empIdPrefix, empIdSuffix) }),
```

Also surface server errors (so a 409 duplicate shows up). Replace the existing throw block:

```ts
if (!response.ok) {
  const error = await response.json();
  throw new Error(error.error || "Failed to register employee");
}
```

with:

```ts
if (!response.ok) {
  const errBody = await response.json();
  if (response.status === 409 && errBody.error?.toLowerCase().includes('employee id')) {
    setErrors((prev) => ({ ...prev, employeeId: errBody.error }));
    setSubmitting(false);
    return;
  }
  throw new Error(errBody.error || "Failed to register employee");
}
```

- [ ] **Step 5: Reset the prefix/suffix on success**

In `handleSubmit`, after the existing `setFormData({ ... })` reset block (around line 159), add:

```ts
setEmpIdPrefix("");
setEmpIdSuffix("");
```

- [ ] **Step 6: Render `EmployeeIdInput` at the top of Employment Details**

In the JSX, find the `<div className="border-t pt-4">` block that wraps Employment Details (the one with `<h3>Employment Details</h3>` around line 353). Just **after** the `<h3>` and **before** the existing `<div className="grid grid-cols-1 md:grid-cols-2 gap-4">`, insert:

```tsx
<div className="md:col-span-2 mb-4">
  <EmployeeIdInput
    prefix={empIdPrefix}
    suffix={empIdSuffix}
    onPrefixChange={(v) => { setEmpIdPrefix(v); if (errors.employeeId) setErrors((p) => ({ ...p, employeeId: "" })); }}
    onSuffixChange={(v) => { setEmpIdSuffix(v); if (errors.employeeId) setErrors((p) => ({ ...p, employeeId: "" })); }}
    error={errors.employeeId}
    disabled={submitting || isLoading}
  />
</div>
```

Note: this insertion goes **inside** the `<div className="border-t pt-4">` Employment Details wrapper, but **before** the inner grid. If you'd rather have it inside the grid for consistent column behavior, wrap it in `<div className="md:col-span-2">` and place it as the first child of the grid. Either works; the spec calls for "top of Employment Details", which both achieve.

- [ ] **Step 7: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Manual UI smoke test**

Run: `npm run dev` (if not already running). Open `http://localhost:3000/user-management` (log in as a super admin). Click **+ Add User**. Verify:
- The Employee ID field appears at the top of Employment Details.
- The dropdown shows all 7 options (`11 — CEO` through `77 — PT COACH`).
- Typing letters in the 6-digit input is silently stripped.
- Submitting without selecting a dropdown shows `"Select a role code"`.
- Submitting with `12345` in the suffix shows `"Enter exactly 6 digits"`.
- Submitting with valid input creates the user; the success message shows the new ID.
- Submitting again with the **same** dropdown + suffix shows the inline server error `"Employee ID already exists"`.

- [ ] **Step 9: Commit**

```bash
git add app/components/RegistrationForm.tsx
git commit -m "feat: add manual Employee ID field to Add User form"
```

---

## Task 8: Wire `EmployeeIdInput` into `UserManagement` side-panel edit

**Files:**
- Modify: `app/components/UserManagement.tsx` (imports, state, handleSave, JSX in edit-mode Personal Info section)

- [ ] **Step 1: Add imports**

Near the top of `app/components/UserManagement.tsx`, after the existing constants import on line 5, add:

```ts
import EmployeeIdInput from "@/app/components/EmployeeIdInput";
import { splitEmployeeId, composeEmployeeId, isValidSuffix, isValidEmployeeId } from "@/lib/employeeId";
import { ROLE_CODES } from "@/lib/constants";
```

- [ ] **Step 2: Add prefix/suffix/error state inside the component**

After the existing `useState` calls inside the `UserManagement` component (around line 67), add:

```ts
const [empIdPrefix, setEmpIdPrefix] = useState("");
const [empIdSuffix, setEmpIdSuffix] = useState("");
const [empIdError, setEmpIdError] = useState("");
```

- [ ] **Step 3: Sync the prefix/suffix when entering edit mode**

Find the user-list `onClick` (around line 262):

```tsx
onClick={() => { setSelectedUser(user); setEditMode(false); setEditData({ ...user }); }}
```

This handler runs when a user is selected. We need a separate sync when entering edit mode. Find the **Edit** button (around line 296):

```tsx
<button
  onClick={() => setEditMode(true)}
  ...
>
  ✏️ Edit
</button>
```

Replace its `onClick` with:

```tsx
onClick={() => {
  setEditMode(true);
  const parts = splitEmployeeId(selectedUser.employeeId);
  setEmpIdPrefix(parts.prefix);
  setEmpIdSuffix(parts.suffix);
  setEmpIdError("");
}}
```

Also find the **Cancel** button inside the edit-mode panel (around line 427):

```tsx
<button onClick={() => { setEditMode(false); setEditData({ ...selectedUser }); }}
```

Replace with:

```tsx
<button onClick={() => {
  setEditMode(false);
  setEditData({ ...selectedUser });
  setEmpIdError("");
}}
```

- [ ] **Step 4: Update `handleSave` to validate and include `employeeId`**

Replace the existing `handleSave` function (currently around lines 141-162) with:

```ts
const handleSave = async () => {
  if (!editData) return;
  // Validate employeeId only if it changed
  const original = splitEmployeeId(selectedUser?.employeeId || "");
  const idChanged = empIdPrefix !== original.prefix || empIdSuffix !== original.suffix;
  if (idChanged) {
    if (!empIdPrefix) { setEmpIdError("Select a role code"); return; }
    if (!isValidSuffix(empIdSuffix)) { setEmpIdError("Enter exactly 6 digits"); return; }
  }
  setEmpIdError("");
  try {
    const newEmployeeId = idChanged ? composeEmployeeId(empIdPrefix, empIdSuffix) : undefined;
    const payload = newEmployeeId !== undefined
      ? { ...editData, employeeId: newEmployeeId }
      : editData;
    const response = await fetch("/api/employees", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (response.ok) {
      const result = await response.json();
      const saved: User = result.data || editData;
      setUsers(users.map((u) => (u.id === editData.id ? saved : u)));
      setSelectedUser(saved);
      setEditMode(false);
    } else {
      const errBody = await response.json().catch(() => ({}));
      if (response.status === 409 && errBody.error?.toLowerCase().includes('employee id')) {
        setEmpIdError(errBody.error);
      } else {
        setError(errBody.error || "Failed to save user");
      }
    }
  } catch (err) {
    console.error("Error saving user:", err);
    setError("Failed to save user");
  }
};
```

- [ ] **Step 5: Render `EmployeeIdInput` in the edit-mode Personal Info section**

In the edit-mode panel (around line 322, inside `<section>` with the Personal Info `<h4>`), find the `<div className="grid grid-cols-1 md:grid-cols-2 gap-4">`. Insert this **as the first child** of the grid (before the existing Full Name `<div className="md:col-span-2">`):

```tsx
<div className="md:col-span-2">
  <EmployeeIdInput
    prefix={empIdPrefix}
    suffix={empIdSuffix}
    onPrefixChange={(v) => { setEmpIdPrefix(v); if (empIdError) setEmpIdError(""); }}
    onSuffixChange={(v) => { setEmpIdSuffix(v); if (empIdError) setEmpIdError(""); }}
    error={empIdError}
    warning={
      selectedUser?.employeeId &&
      isValidEmployeeId(selectedUser.employeeId) &&
      !ROLE_CODES.includes(splitEmployeeId(selectedUser.employeeId).prefix)
        ? "Existing ID has unrecognized role code"
        : undefined
    }
  />
</div>
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Manual UI smoke test**

Run: `npm run dev`. Open `http://localhost:3000/user-management`. Pick a user with an existing ID like `33090297`. Click **Edit**. Verify:
- The dropdown shows `33 — EXEC` preselected.
- The suffix input shows `090297`.
- Changing the suffix to `999999` and clicking **Save** updates the ID to `33999999` (refresh the page to confirm persistence).
- Picking a user with a legacy unrecognized prefix (if any exist) shows the warning text.
- Trying to save with a duplicate ID shows the inline error `"Employee ID already exists"`.

- [ ] **Step 8: Commit**

```bash
git add app/components/UserManagement.tsx
git commit -m "feat: add manual Employee ID field to side-panel edit mode"
```

---

## Task 9: Wire `EmployeeIdInput` into `UserProfile`

**Files:**
- Modify: `app/components/UserProfile.tsx` (imports, state, handleSaveProfile, JSX around lines 230-245)

- [ ] **Step 1: Add imports**

At the top of `app/components/UserProfile.tsx`, after `import { useState, useEffect } from "react";`, add:

```ts
import EmployeeIdInput from "@/app/components/EmployeeIdInput";
import { splitEmployeeId, composeEmployeeId, isValidSuffix, isValidEmployeeId } from "@/lib/employeeId";
import { ROLE_CODES } from "@/lib/constants";
```

- [ ] **Step 2: Add prefix/suffix/error state**

Inside the `UserProfile` component, after the existing `useState` calls (around line 32), add:

```ts
const [empIdPrefix, setEmpIdPrefix] = useState("");
const [empIdSuffix, setEmpIdSuffix] = useState("");
const [empIdError, setEmpIdError] = useState("");
```

- [ ] **Step 3: Sync prefix/suffix when entering edit mode and on data load**

Replace the existing `handleEditClick` (around lines 59-64) with:

```ts
const handleEditClick = () => {
  setEditMode(true);
  if (userData) {
    setEditData({ ...userData });
    const parts = splitEmployeeId(userData.employeeId || "");
    setEmpIdPrefix(parts.prefix);
    setEmpIdSuffix(parts.suffix);
    setEmpIdError("");
  }
};
```

Replace the existing `handleCancel` (around lines 66-71) with:

```ts
const handleCancel = () => {
  setEditMode(false);
  if (userData) {
    setEditData({ ...userData });
    setEmpIdError("");
  }
};
```

- [ ] **Step 4: Update `handleSaveProfile` to validate and include `employeeId`**

Replace the body of `handleSaveProfile` (around lines 80-102) with:

```ts
const handleSaveProfile = async () => {
  if (!editData || !userData) return;
  const original = splitEmployeeId(userData.employeeId || "");
  const idChanged = empIdPrefix !== original.prefix || empIdSuffix !== original.suffix;
  if (idChanged) {
    if (!empIdPrefix) { setEmpIdError("Select a role code"); return; }
    if (!isValidSuffix(empIdSuffix)) { setEmpIdError("Enter exactly 6 digits"); return; }
  }
  setEmpIdError("");
  setSavingProfile(true);
  try {
    const newEmployeeId = idChanged ? composeEmployeeId(empIdPrefix, empIdSuffix) : undefined;
    const payload = newEmployeeId !== undefined
      ? { ...editData, employeeId: newEmployeeId }
      : editData;
    const response = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (response.ok) {
      const updated = newEmployeeId !== undefined
        ? { ...editData, employeeId: newEmployeeId }
        : editData;
      setUserData(updated);
      setEditMode(false);
    } else {
      const errBody = await response.json().catch(() => ({}));
      if (response.status === 409 && errBody.error?.toLowerCase().includes('employee id')) {
        setEmpIdError(errBody.error);
      } else {
        setError(errBody.error || "Failed to save profile changes");
      }
    }
  } catch (err) {
    console.error("Error saving profile:", err);
    setError("Failed to save profile changes");
  } finally {
    setSavingProfile(false);
  }
};
```

- [ ] **Step 5: Replace the disabled `employeeId` input with `EmployeeIdInput`**

Find the Employee ID block (around lines 230-245):

```tsx
{/* Employee ID */}
<div className="bg-gray-50 p-4 rounded-lg">
  <label className="text-sm font-semibold text-gray-600 mb-2 block">Employee ID</label>
  {editMode ? (
    <input
      type="text"
      name="employeeId"
      value={editData?.employeeId || ""}
      onChange={handleInputChange}
      className="w-full px-3 py-2 border border-gray-300 rounded"
      disabled
    />
  ) : (
    <p className="text-lg font-medium text-gray-900">{userData.employeeId}</p>
  )}
</div>
```

Replace with:

```tsx
{/* Employee ID */}
<div className="bg-gray-50 p-4 rounded-lg">
  {editMode ? (
    <EmployeeIdInput
      prefix={empIdPrefix}
      suffix={empIdSuffix}
      onPrefixChange={(v) => { setEmpIdPrefix(v); if (empIdError) setEmpIdError(""); }}
      onSuffixChange={(v) => { setEmpIdSuffix(v); if (empIdError) setEmpIdError(""); }}
      error={empIdError}
      warning={
        userData.employeeId &&
        isValidEmployeeId(userData.employeeId) &&
        !ROLE_CODES.includes(splitEmployeeId(userData.employeeId).prefix)
          ? "Existing ID has unrecognized role code"
          : undefined
      }
    />
  ) : (
    <>
      <label className="text-sm font-semibold text-gray-600 mb-2 block">Employee ID</label>
      <p className="text-lg font-medium text-gray-900">{userData.employeeId}</p>
    </>
  )}
</div>
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Manual UI smoke test**

Open the profile page in the app (route depends on app structure — likely `/profile`). Click **Edit**. Verify the dropdown + 6-digit input render and the existing ID is split correctly.

> Note: The profile page hits `/api/profile` (not `/api/employees`). If `/api/profile` does **not** currently accept/persist `employeeId`, that's an existing limitation outside this plan's scope — but the UI changes here are still correct and harmless. Flag this to the user if discovered.

- [ ] **Step 8: Commit**

```bash
git add app/components/UserProfile.tsx
git commit -m "feat: add manual Employee ID field to user profile edit"
```

---

## Task 10: Remove the Rebuild IDs button from `EmployeeTable`

**Files:**
- Modify: `app/components/EmployeeTable.tsx` (lines 133-143, 324, 347-353)

- [ ] **Step 1: Delete the `handleRebuildIds` function**

In `app/components/EmployeeTable.tsx`, delete the entire function (currently lines 133-143):

```ts
const handleRebuildIds = async () => {
  if (!confirm("Rebuild all employee IDs based on current role and branch? This will update IDs for all employees.")) return;
  try {
    const res = await fetch("/api/employees/rebuild-ids", { method: "POST" });
    const data = await res.json();
    alert(data.message || "Done");
    fetchEmployees();
  } catch {
    alert("Failed to rebuild IDs");
  }
};
```

- [ ] **Step 2: Delete the button + simplify the wrapper**

Find the Summary block (around lines 323-353):

```tsx
<div className="mt-6 p-4 bg-gray-50 rounded-lg flex items-start justify-between gap-4">
  <div>
    <p className="text-sm text-gray-600">
      Total Employees: ...
    </p>
    <p className="text-sm text-gray-600 mt-2">
      Active: ...
    </p>
  </div>
  <button
    onClick={handleRebuildIds}
    className="shrink-0 px-3 py-1.5 text-xs font-medium bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
  >
    Rebuild IDs
  </button>
</div>
```

Replace the wrapper opening tag and remove the button:

```tsx
<div className="mt-6 p-4 bg-gray-50 rounded-lg">
  <div>
    <p className="text-sm text-gray-600">
      Total Employees: <span className="font-bold text-gray-900">{employees.length}</span>
      {statusFilter !== "all" && (
        <span className="ml-2 text-gray-400">(showing {filteredEmployees.length} filtered)</span>
      )}
    </p>
    <p className="text-sm text-gray-600 mt-2">
      Active:{" "}
      <span className="font-bold text-green-600">
        {employees.filter((e) => e.Emp_Status === "Active").length}
      </span>{" "}
      | Inactive:{" "}
      <span className="font-bold text-red-600">
        {employees.filter((e) => e.Emp_Status === "Inactive").length}
      </span>{" "}
      | Archived:{" "}
      <span className="font-bold text-yellow-600">
        {employees.filter((e) => e.accessStatus === "ARCHIVED").length}
      </span>
    </p>
  </div>
</div>
```

(Drop `flex items-start justify-between gap-4`. The inner `<div>` can also be dropped if you want, but keeping it preserves the existing DOM/spacing.)

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors. No unused variable warnings for `handleRebuildIds`.

- [ ] **Step 4: Manual UI smoke test**

Open `http://localhost:3000/dashboard-employee-management`. Confirm the **Rebuild IDs** button is gone from the bottom-right of the table summary.

- [ ] **Step 5: Commit**

```bash
git add app/components/EmployeeTable.tsx
git commit -m "chore: remove Rebuild IDs button from employee table"
```

---

## Task 11: Add `employeeId` to CSV headers

**Files:**
- Modify: `app/user-management/page.tsx` (lines 10-15)

- [ ] **Step 1: Update `CSV_HEADERS`**

In `app/user-management/page.tsx`, change the existing `CSV_HEADERS` constant (lines 10-15):

```ts
const CSV_HEADERS = [
  "fullName", "gender", "nickName", "email", "phone", "nric", "dob",
  "homeAddress", "branch", "role", "contract", "startDate", "endDate", "probation", "rate",
  "Emc_Number", "Emc_Email", "Emc_Relationship", "Signed_Date", "Emp_Hire_Date",
  "Emp_Type", "Emp_Status", "Bank", "Bank_Name", "Bank_Account", "University",
];
```

to:

```ts
const CSV_HEADERS = [
  "employeeId",
  "fullName", "gender", "nickName", "email", "phone", "nric", "dob",
  "homeAddress", "branch", "role", "contract", "startDate", "endDate", "probation", "rate",
  "Emc_Number", "Emc_Email", "Emc_Relationship", "Signed_Date", "Emp_Hire_Date",
  "Emp_Type", "Emp_Status", "Bank", "Bank_Name", "Bank_Account", "University",
];
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual smoke test**

Run `npm run dev`, click **Export CSV**, download the file, open it. The first column header should be `employeeId` and the values should be the existing 8-digit IDs (e.g. `33090297`, `44080296`).

For import: edit one row of the exported CSV — change one `employeeId` to a fresh 8-digit number, change the `email` so it doesn't collide, then **Import CSV**. Confirm the new user appears with the manually-set ID.

- [ ] **Step 4: Commit**

```bash
git add app/user-management/page.tsx
git commit -m "feat: add employeeId to CSV import/export headers"
```

---

## Task 12: Final end-to-end verification

- [ ] **Step 1: Run all unit tests**

Run: `npx vitest run`
Expected: all tests PASS (including the new `lib/__tests__/employeeId.test.ts`).

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: no errors anywhere.

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: no new warnings or errors in the files we touched.

- [ ] **Step 4: Production build**

Run: `npm run build`
Expected: build succeeds. (Catches any remaining type/route issues that `tsc` alone misses.)

- [ ] **Step 5: Full manual smoke test**

Walk through these flows in the running app:

1. **Add User** — create a new user with prefix `66` + suffix `123456`. Confirm the user appears in the table with ID `66123456`.
2. **Add User — duplicate** — try the same `66123456` again. Confirm the inline error `"Employee ID already exists"` shows.
3. **Add User — bad input** — type letters in the suffix → silently stripped. Submit with empty dropdown → inline `"Select a role code"` error.
4. **Edit (side panel)** — open the user from step 1, click **Edit**, change suffix to `999999`, **Save**. Refresh; confirm ID is now `66999999`.
5. **Profile edit** — open profile, edit the Employee ID prefix to `33`, save. Confirm change persists *if* `/api/profile` accepts `employeeId` (otherwise note the limitation).
6. **Rebuild IDs button** — confirm it is **gone** from `/dashboard-employee-management`.
7. **CSV export** — confirm `employeeId` is the first column.
8. **CSV import** — import a CSV row with a fresh `employeeId`. Confirm the row is added; one with a duplicate `employeeId` is rejected (count shows in the import status).

- [ ] **Step 6: No further commit**

This task is verification only. If any step fails, fix it under the relevant earlier task and commit there.

---

## Out of Scope Reminder

Per the spec, the following are intentionally **not** done in this plan:

- No data migration for the existing 252 employees — their IDs stay as-is.
- No changes to the database schema (`employeeId` is already a plain string column).
- No display formatting changes (plain 8 digits everywhere).
- No backfill or rebuild of legacy IDs that have unrecognized prefixes — they continue to work; the UI just shows a warning when editing them.
