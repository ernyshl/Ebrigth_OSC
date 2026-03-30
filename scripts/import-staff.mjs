import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://optidept:ebrightoptidept2025@103.209.156.174:5433/ebright_hrfs?schema=public'
    }
  }
});

const BRANCH_CODE_MAP = {
  'amp':  'Ampang',
  'bbb':  'Bandar Baru Bangi',
  'bsp':  'Bandar Seri Putra',
  'btho': 'Bandar Tun Hussein Onn',
  'cjy':  'Cyberjaya',
  'da':   'Denai Alam',
  'dk':   'Danau Kota',
  'egr':  'Eco Grandeur',
  'ktg':  'Kajang TTDI Groove',
  'kd':   'Kota Damansara',
  'klg':  'Klang',
  'kw':   'Kota Warisan',
  'onl':  'Online',
  'pjy':  'Putrajaya',
  'rby':  'Rimbayu',
  'sa':   'Setia Alam',
  'sha':  'Shah Alam',
  'sp':   'Sri Petaling',
  'st':   'Subang Taipan',
  'tsg':  'Taman Sri Gombak',
};

async function main() {
  const csvContent = fs.readFileSync(
    'C:\\Users\\NUR IRDINA\\Downloads\\user-export-273441891-69c75c40b61b9.csv',
    'utf8'
  );

  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
  });

  // Delete all existing entries (fake ones included)
  const deleted = await prisma.branchStaff.deleteMany({});
  console.log(`Cleared ${deleted.count} existing BranchStaff entries.`);

  let inserted = 0;
  let skipped = 0;

  for (const record of records) {
    const userNicename = (record.user_nicename || '').trim();
    const firstName = (record.first_name || '').trim();
    const role = (record.role || '').trim();

    if (!firstName || !userNicename) {
      skipped++;
      continue;
    }

    const branchCode = userNicename.split('-')[0].toLowerCase();
    const branch = BRANCH_CODE_MAP[branchCode];

    if (!branch) {
      console.log(`  SKIP (unknown branch "${branchCode}"): ${firstName}`);
      skipped++;
      continue;
    }

    try {
      await prisma.branchStaff.create({
        data: { name: firstName, branch, role: role || null }
      });
      inserted++;
      console.log(`  OK: ${firstName} → ${branch} [${role}]`);
    } catch (err) {
      if (err.code === 'P2002') {
        console.log(`  DUPLICATE skipped: ${firstName} at ${branch}`);
      } else {
        console.error(`  ERROR inserting ${firstName}:`, err.message);
      }
      skipped++;
    }
  }

  console.log(`\nDone! Inserted: ${inserted} | Skipped: ${skipped}`);
  await prisma.$disconnect();
}

main().catch(console.error);
