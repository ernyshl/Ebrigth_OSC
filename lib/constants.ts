export const ROLE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "HUMAN_RESOURCES", label: "Human Resources" },
  { value: "FINANCE", label: "Finance" },
  { value: "REGIONAL_MANAGER", label: "Regional Manager" },
  { value: "OPTIMISATION_DEPARTMENT", label: "Optimisation Department" },
  { value: "MARKETING", label: "Marketing" },
  { value: "HQ_OPERATION", label: "HQ Operation" },
  { value: "CEO", label: "CEO" },
  { value: "SUPER_ADMIN", label: "Super Admin" },
  { value: "ACADEMY", label: "Academy" },
  { value: "INDUSTRIAL_PSYCHOLOGY", label: "Industrial Psychology" },
];

export const BRANCH_OPTIONS = [
  { value: "HQ", label: "Headquarters" },
  { value: "BR", label: "Branch 1" },
  { value: "BR2", label: "Branch 2" },
  { value: "BR3", label: "Branch 3" },
];

export function getRoleLabel(role: string): string {
  const option = ROLE_OPTIONS.find((opt) => opt.value === role);
  return option?.label || role;
}

export function getBranchLabel(branch: string): string {
  const option = BRANCH_OPTIONS.find((opt) => opt.value === branch);
  return option?.label || branch;
}
