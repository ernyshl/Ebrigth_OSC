import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { config as dotenv } from 'dotenv';

dotenv({ path: '.env.test' });

const prisma = new PrismaClient();

const PASSWORD = 'pass1234';

async function main() {
  console.log('Seeding test database…');

  // Clean order respects FKs.
  await prisma.attendanceLog.deleteMany();
  await prisma.leaveTransaction.deleteMany();
  await prisma.manpowerSchedule.deleteMany();
  await prisma.branchStaff.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.user.deleteMany();

  const hash = await bcrypt.hash(PASSWORD, 10);

  await prisma.user.createMany({
    data: [
      // Admin uses @example.test (not ebright) because DashboardHome treats any
      // email containing "ebright" as a branch manager and would lock 6/7 cards.
      { email: 'test.admin@example.test',  passwordHash: hash, role: 'ADMIN',          branchName: 'HQ' },
      { email: 'test.ampang@ebright.test', passwordHash: hash, role: 'BRANCH_MANAGER', branchName: 'Ampang' },
      { email: 'test.klang@ebright.test',  passwordHash: hash, role: 'BRANCH_MANAGER', branchName: 'Klang' },
    ],
  });

  await prisma.branchStaff.createMany({
    data: [
      { employeeId: 'EMP-AMPANG-1', name: 'Ampang Staff One', email: 'ampang1@ebright.test', branch: 'Ampang' },
      { employeeId: 'EMP-KLANG-1',  name: 'Klang Staff One',  email: 'klang1@ebright.test',  branch: 'Klang' },
    ],
  });

  console.log('Test database seeded.');
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
