# Manual Employee ID Entry — Design Spec

**Date:** 2026-04-25
**Author:** Dina (od@ebright.my)
**Status:** Approved (awaiting implementation plan)

## 1. Summary

Replace the auto-generated Employee ID system with a manual, two-part entry: a **role-code dropdown** (first 2 digits) + a **manual 6-digit text input**. Final ID is a plain 8-digit string with no separator (e.g., `33080012`). The "Rebuild IDs" button and its backing API are removed entirely.

## 2. Motivation

Today, Employee IDs are auto-generated from `role + branch + sequence` by `buildEmployeeId()` in `/api/employees/route.ts`. This:

- Couples ID structure to role/branch lookup tables that admins can't see or change easily.
- Has only 4 position codes (CEO=11, HOD=22, EXEC/BM/FT/PT-Coach all collapsed to 33, INT=44) — admins want **separate codes for BM, FT Coach, and PT Coach**.
- Forces all-or-nothing rebuild via the "Rebuild IDs" button when role/branch mappings change.

Admins want **direct control**: pick the role code, type the 6-digit suffix, done.

## 3. Role-Code Mapping

A new constant added to `lib/constants.ts`:

```ts
export const ROLE_CODE_OPTIONS = [
  { value: "11", label: "11 — CEO" },
  { value: "22", label: "22 — HOD" },
  { value: "33", label: "33 — EXEC" },
  { value: "44", label: "44 — INTERN" },
  { value: "55", label: "55 — BM" },
  { value: "66", label: "66 — FT COACH" },
  { value: "77", label: "77 — PT COACH" },
] as const;
```

Used by both Add User and Edit User forms.

## 4. UI — Add User Form

**Location:** Top of the **Employment Details** section in `app/components/RegistrationForm.tsx`, above the existing Branch field.

**Layout:**

```
Employee ID *
[ — Select role — ▾ ]  [ ______ ]
8 digits total — first 2 from dropdown, last 6 entered manually.
```

**Field behavior:**

| Element | Behavior |
|---|---|
| Dropdown | Required. Renders all 7 entries from `ROLE_CODE_OPTIONS`. Default placeholder `"— Select role —"`. |
| Text input | Required. `maxlength=6`. On every change, strip non-digit characters (`value.replace(/\D/g, "")`). Monospace font, placeholder `"6 digits"`. |
| Helper text | `"8 digits total — first 2 from dropdown, last 6 entered manually."` |
| On submit | Concatenate `dropdown + input` → 8-digit string. Send as `employeeId` field in POST body. |

**Client-side validation (block submit + show inline error):**

- Dropdown must be selected.
- Text input must match `/^\d{6}$/` (exactly 6 digits, leading zeros allowed).

Server-side handles the uniqueness check (returns 409 with error message → form shows it).

## 5. UI — Edit User / Profile Form

The same dropdown + 6-digit input is added to **two** edit flows:

**5.1 `app/components/UserManagement.tsx` (side detail panel, edit mode)**

The current edit mode (lines 360-431, before the "Save" / "Cancel" buttons) has no Employee ID input — it only shows the ID read-only in view mode (line 439). Add the new dropdown + 6-digit field at the top of the edit-mode Personal Info section.

**5.2 `app/components/UserProfile.tsx` (full profile page)**

Replace the existing `disabled` `<input name="employeeId">` (lines 234-241) with the dropdown + 6-digit input. The view-mode display (line 243) stays as-is, showing the plain 8-digit string.

**Behavior — same in both files:**

When loading an existing employee, the form **splits** the stored 8-digit ID:
- First 2 digits → preselect the dropdown (if it matches a known code; otherwise leave dropdown empty and show a warning *"Existing ID has unrecognized role code"*).
- Last 6 digits → prefill the text input.

When saving:
- If admin didn't change either part: skip sending `employeeId` in the PUT body (no-op).
- If admin changed either part: validate (same client rules as Add User) and send the new 8-digit `employeeId`.

## 6. Backend — `POST /api/employees`

Changes to `app/api/employees/route.ts`:

**Remove:**
- `getPositionCode()` helper (lines 7-15).
- `getDeptCode()` helper (lines 18-30).
- `buildEmployeeId()` helper (lines 32-34).
- The auto-generation call: `const count = await prisma.branchStaff.count(); const employeeId = buildEmployeeId(role, branch, count + 1);` (lines 128-129).

**Add:**
- `employeeId` becomes a required field. Validate:
  - Present in body.
  - Matches `/^\d{8}$/`.
  - Not used by any existing employee (any access status, including ARCHIVED): `await prisma.branchStaff.findFirst({ where: { employeeId } })` — return 409 with `{ error: "Employee ID already exists" }` if found.
- Add `employeeId` to the destructured fields and pass directly into `prisma.branchStaff.create({ data: { ..., employeeId, ... } })`.

**Update validation block:**

```ts
if (!fullName || !email || !phone || !branch || !role || !employeeId) {
  return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
}
if (!/^\d{8}$/.test(employeeId)) {
  return NextResponse.json({ error: 'Employee ID must be exactly 8 digits' }, { status: 400 });
}
```

## 7. Backend — `PUT /api/employees`

**Remove** the auto-recalculation block (lines 189-197) that rebuilds the ID when branch/role changes.

**Update** the `employeeId` handling:

- If `employeeId` is in the request body:
  - Validate format (`/^\d{8}$/`).
  - Validate uniqueness against **other** employees: `await prisma.branchStaff.findFirst({ where: { employeeId, NOT: { id: parseInt(id) } } })` — return 409 if found.
  - Pass through to the update: `...(employeeId !== undefined && { employeeId })` (this line already exists implicitly via `recalculatedEmployeeId`; replace it with the direct passthrough).

## 8. Backend — Delete `/api/employees/rebuild-ids`

Delete the entire file `app/api/employees/rebuild-ids/route.ts`. No callers remain after removing the button.

## 9. Frontend — `EmployeeTable.tsx`

Changes to `app/components/EmployeeTable.tsx`:

- Remove the `handleRebuildIds` function (lines 133-143).
- Remove the "Rebuild IDs" button (lines 347-352).
- Adjust the surrounding `<div className="mt-6 p-4 bg-gray-50 rounded-lg flex items-start justify-between gap-4">` — since the right-side button is gone, drop the `flex justify-between` so the summary fills the row naturally.

## 10. CSV Import

Changes to `app/user-management/page.tsx`:

- Add `"employeeId"` as the **first** entry in `CSV_HEADERS` (so it leads both export and import templates).
- The existing import loop already POSTs each row to `/api/employees`. Backend validation (Section 6) handles missing/invalid/duplicate `employeeId` automatically — failed rows increment the `failed` counter; the user sees `"X added, Y failed"`.

No changes needed to the import-loop code itself; the validation flows through the existing error-handling path.

## 11. Out of Scope

These are explicitly **not** part of this change:

- Existing 252 employee IDs stay as they are. No migration script.
- The database schema (already has a plain string `employeeId` column).
- Search, filter, table display, or export logic for Employee ID — already treats it as a plain string.
- Hyphenated display formats (`33-080012`) — confirmed plain 8 digits everywhere.

## 12. Validation Rules Summary

| Rule | Where enforced | On fail |
|---|---|---|
| Dropdown required | Client (form) | Inline error, block submit |
| 6-digit input required, digits-only, exactly 6 chars | Client (form) | Inline error, block submit |
| Final 8-digit format `/^\d{8}$/` | Server | 400 `"Employee ID must be exactly 8 digits"` |
| Unique across all employees (incl. ARCHIVED) | Server | 409 `"Employee ID already exists"` — form surfaces the message inline |

## 13. Files Touched

| File | Change |
|---|---|
| `lib/constants.ts` | Add `ROLE_CODE_OPTIONS` constant |
| `app/components/RegistrationForm.tsx` | Add Employee ID field at top of Employment Details, with validation |
| `app/components/UserManagement.tsx` | Add Employee ID dropdown + 6-digit input to side-panel edit mode |
| `app/components/UserProfile.tsx` | Replace disabled `employeeId` input with dropdown + 6-digit input |
| `app/components/EmployeeTable.tsx` | Remove `handleRebuildIds` and button |
| `app/api/employees/route.ts` | Remove auto-gen helpers; require + validate `employeeId` in POST and PUT |
| `app/api/employees/rebuild-ids/route.ts` | Delete file |
| `app/user-management/page.tsx` | Add `"employeeId"` to `CSV_HEADERS` |
