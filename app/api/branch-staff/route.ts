import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

export async function GET() {
  const { error } = await requireSession();
  if (error) return error;

  try {
    const staff = await prisma.employee.findMany({
      select: { id: true, name: true, nickname: true, branch: true, position: true }
    });
    // Map position to role field so existing frontend logic still works
    const mapped = staff.map(s => ({
      ...s,
      role: s.position?.toLowerCase().includes('branch manager') ? `branch_manager_${s.branch.substring(0,3).toLowerCase()}` : null
    }));
    return NextResponse.json(mapped);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { error } = await requireSession();
  if (error) return error;

  try {
    const { name, branch, position } = await request.json();
    if (!name?.trim() || !branch) {
      return NextResponse.json({ error: "Name and branch are required" }, { status: 400 });
    }
    const employee = await prisma.employee.create({
      data: { name: name.trim(), branch, position: position?.trim() || null }
    });
    return NextResponse.json({ success: true, employee });
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json({ error: "This employee already exists in this branch" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create employee" }, { status: 500 });
  }
}
