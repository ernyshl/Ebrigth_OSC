import { NextResponse } from 'next/server';

// In-memory employee storage (in production, this would be a database)
// eslint-disable-next-line prefer-const
let employees = [
  {
    id: "1",
    employeeId: "HQ-001",
    firstName: "Admin",
    lastName: "User",
    email: "admin@ebright.com",
    phone: "+1-555-0001",
    branch: "HQ",
    role: "SUPER_ADMIN",
    accessStatus: "AUTHORIZED",
    registeredAt: new Date("2025-01-01").toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "2",
    employeeId: "HQ-002",
    firstName: "Sarah",
    lastName: "Johnson",
    email: "sarah.johnson@company.com",
    phone: "+1-555-0002",
    branch: "HQ",
    role: "HUMAN_RESOURCES",
    accessStatus: "AUTHORIZED",
    registeredAt: new Date("2025-01-05").toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "3",
    employeeId: "HQ-003",
    firstName: "Michael",
    lastName: "Chen",
    email: "michael.chen@company.com",
    phone: "+1-555-0003",
    branch: "HQ",
    role: "FINANCE",
    accessStatus: "AUTHORIZED",
    registeredAt: new Date("2025-01-10").toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Helper to generate employee ID based on branch
function generateEmployeeId(branch: string): string {
  const branchPrefix = branch === "HQ" ? "HQ" : branch.substring(0, 2).toUpperCase();
  const branchEmployees = employees.filter((e) => e.employeeId.startsWith(branchPrefix));
  const nextNumber = branchEmployees.length + 1;
  return `${branchPrefix}-${String(nextNumber).padStart(3, "0")}`;
}

// Helper to generate unique ID
function generateId(): string {
  return (employees.length + 1).toString();
}

export async function GET() {
  // Return all employees (registered + initial sample data)
  return NextResponse.json(employees);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate required fields
    const { firstName, lastName, email, phone, branch, role } = body;

    if (!firstName || !lastName || !email || !phone || !branch || !role) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check if email already exists
    if (employees.some((e) => e.email === email)) {
      return NextResponse.json(
        { error: "Email already exists" },
        { status: 409 }
      );
    }

    // Create new employee object
    const newEmployee = {
      id: generateId(),
      employeeId: generateEmployeeId(branch),
      firstName,
      lastName,
      email,
      phone,
      branch,
      role,
      accessStatus: "AUTHORIZED",
      registeredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Add to employees list
    employees.push(newEmployee);

    return NextResponse.json(
      {
        message: "Employee registered successfully",
        data: newEmployee,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error registering employee:", error);
    return NextResponse.json(
      { error: "Failed to register employee" },
      { status: 500 }
    );
  }
}
