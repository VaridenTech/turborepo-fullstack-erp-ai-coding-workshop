import { createPrismaClient, hashPassword, Role } from '../src/index.js';

const prisma = createPrismaClient(
  process.env.DATABASE_URL ?? 'postgresql://erp:erp@localhost:5432/erp',
);

const DEMO_PASSWORD = 'password';

// The two stores from the TOR (Section 8.1): B01 Central, B02 Riverside.
const stores = [
  { code: 'B01', name: 'สาขาเซ็นทรัล' },
  { code: 'B02', name: 'สาขาริเวอร์ไซด์' },
];

/**
 * Demo accounts for the workshop (also shown on the login page), matching TOR Section 8.1.
 * `storeCode` assigns a STORE_EMPLOYEE to their store; other roles are not store-scoped.
 * Re-running the seed resets them.
 */
const demoUsers = [
  { email: 'buyer01@erp.local', name: 'Buyer 01', role: Role.PURCHASING_OFFICER, storeCode: null },
  { email: 'staff_b01@erp.local', name: 'Staff B01', role: Role.STORE_EMPLOYEE, storeCode: 'B01' },
  { email: 'staff_b02@erp.local', name: 'Staff B02', role: Role.STORE_EMPLOYEE, storeCode: 'B02' },
  { email: 'manager01@erp.local', name: 'Manager 01', role: Role.MANAGER, storeCode: null },
  {
    email: 'administrator@erp.local',
    name: 'Administrator',
    role: Role.ADMINISTRATOR,
    storeCode: null,
  },
];

async function main() {
  const storeIdByCode = new Map<string, string>();
  for (const store of stores) {
    const row = await prisma.store.upsert({
      where: { code: store.code },
      update: { name: store.name },
      create: store,
    });
    storeIdByCode.set(store.code, row.id);
  }

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  for (const user of demoUsers) {
    const storeId = user.storeCode ? (storeIdByCode.get(user.storeCode) ?? null) : null;
    const data = { name: user.name, role: user.role, storeId, passwordHash };
    await prisma.user.upsert({
      where: { email: user.email },
      update: data,
      create: { email: user.email, ...data },
    });
  }

  console.log(
    `Seeded ${stores.length} stores and ${demoUsers.length} demo users (password: "${DEMO_PASSWORD}").`,
  );
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
