import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { ADMIN_ROLES, ROLE_VALUES } from '@/lib/roles';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

// `role` is constrained to the canonical list in lib/roles.ts. The DB column
// is still a free-form string for backwards compatibility, but this schema
// prevents the API from ever writing an off-list value — closing the
// "POST /api/users with role: 'SuperAdmin_X'" escalation vector.
const RoleEnum = z.enum(ROLE_VALUES);

const CreateUserSchema = z.object({
  name:       z.string().optional(),
  email:      z.string().email(),
  password:   z.string().min(8),
  role:       RoleEnum,
  branchName: z.string().optional(),
});

const UpdateUserSchema = z.object({
  id:         z.number().int(),
  name:       z.string().optional(),
  email:      z.string().email().optional(),
  password:   z.string().min(8).optional(),
  role:       RoleEnum.optional(),
  branchName: z.string().optional(),
});

const PatchUserSchema = z.object({
  id:     z.number().int(),
  action: z.enum(['toggle-status', 'change-role']),
  role:   RoleEnum.optional(),
});

export async function GET() {
  const { error } = await requireRole(ADMIN_ROLES);
  if (error) return error;

  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, branchName: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(users);
  } catch (err) {
    console.error('GET /api/users error:', err);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { error } = await requireRole(ADMIN_ROLES);
  if (error) return error;

  try {
    const parsed = CreateUserSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { name, email, password, role, branchName } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name: name ?? null, email, passwordHash, role, branchName: branchName ?? null, status: 'ACTIVE' },
      select: { id: true, name: true, email: true, role: true, branchName: true, status: true, createdAt: true },
    });
    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    console.error('POST /api/users error:', err);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const { error } = await requireRole(ADMIN_ROLES);
  if (error) return error;

  try {
    const parsed = UpdateUserSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { id, name, email, role, branchName, password } = parsed.data;

    if (email) {
      const conflict = await prisma.user.findFirst({ where: { email, NOT: { id } } });
      if (conflict) {
        return NextResponse.json({ error: 'Email already in use by another account' }, { status: 409 });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined)     updateData.name       = name;
    if (email !== undefined)    updateData.email      = email;
    if (role !== undefined)     updateData.role       = role;
    if (branchName !== undefined) updateData.branchName = branchName;
    if (password)               updateData.passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, email: true, role: true, branchName: true, status: true, createdAt: true },
    });
    return NextResponse.json(user);
  } catch (err) {
    console.error('PUT /api/users error:', err);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const { error } = await requireRole(ADMIN_ROLES);
  if (error) return error;

  try {
    const parsed = PatchUserSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { id, action, role } = parsed.data;

    let updateData: Record<string, unknown> = {};

    if (action === 'toggle-status') {
      const current = await prisma.user.findUnique({ where: { id }, select: { status: true } });
      if (!current) return NextResponse.json({ error: 'User not found' }, { status: 404 });
      updateData.status = current.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    } else {
      if (!role) return NextResponse.json({ error: 'role is required for change-role' }, { status: 400 });
      updateData.role = role;
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, email: true, role: true, branchName: true, status: true, createdAt: true },
    });
    return NextResponse.json(user);
  } catch (err) {
    console.error('PATCH /api/users error:', err);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { error } = await requireRole(ADMIN_ROLES);
  if (error) return error;

  try {
    const id = Number(new URL(req.url).searchParams.get('id'));
    if (!id || isNaN(id)) {
      return NextResponse.json({ error: 'id query param is required' }, { status: 400 });
    }
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/users error:', err);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
