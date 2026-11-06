/**
 * One-off EAT-39 smoke seed. Valid RFC UUID v4 IDs.
 * Run: node --env-file=.env scripts/eat39-smoke-seed.mjs
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { PrismaClient } = require(
  require.resolve('@prisma/client', { paths: [path.join(root, 'packages/database')] }),
);
const { PrismaPg } = require(
  require.resolve('@prisma/adapter-pg', { paths: [path.join(root, 'packages/database')] }),
);
const { hash } = require(
  require.resolve('@node-rs/argon2', { paths: [path.join(root, 'apps/api')] }),
);

const IDS = {
  owner: 'a1111111-1111-4111-8111-111111111111',
  customer: 'a3333333-3333-4333-8333-333333333333',
  city: 'b1111111-1111-4111-8111-111111111111',
  restaurant: 'c1111111-1111-4111-8111-111111111111',
  branchA: 'd1111111-1111-4111-8111-111111111111',
  branchB: 'd2222222-2222-4222-8222-222222222222',
  addrA: 'e1111111-1111-4111-8111-111111111111',
  addrB: 'e2222222-2222-4222-8222-222222222222',
  membership: 'f1111111-1111-4111-8111-111111111111',
};

const PASSWORD = 'SmokeTest1!';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function upsertUser(id, email, name) {
  const passwordHash = await hash(PASSWORD);
  return prisma.user.upsert({
    where: { id },
    create: {
      id,
      email,
      name,
      passwordHash,
      emailVerifiedAt: new Date(),
    },
    update: {
      email,
      name,
      passwordHash,
      emailVerifiedAt: new Date(),
    },
  });
}

async function main() {
  await upsertUser(IDS.owner, 'owner.smoke@eatwave.test', 'Smoke Owner');
  await upsertUser(IDS.customer, 'customer.smoke@eatwave.test', 'Smoke Customer');

  await prisma.operatingCity.upsert({
    where: { id: IDS.city },
    create: {
      id: IDS.city,
      name: 'Lahore',
      country: 'PK',
      slug: 'lahore-smoke',
      isActive: true,
    },
    update: { name: 'Lahore', country: 'PK', isActive: true },
  });

  await prisma.restaurant.upsert({
    where: { id: IDS.restaurant },
    create: {
      id: IDS.restaurant,
      name: 'Smoke Kitchen',
      slug: 'smoke-kitchen',
      status: 'ACTIVE',
      cuisineTags: ['Smoke'],
    },
    update: { name: 'Smoke Kitchen', status: 'ACTIVE' },
  });

  for (const [id, line1, name] of [
    [IDS.addrA, '1 Smoke St', 'Branch A'],
    [IDS.addrB, '2 Smoke Ave', 'Branch B'],
  ]) {
    await prisma.address.upsert({
      where: { id },
      create: {
        id,
        line1,
        city: 'Lahore',
        region: 'Punjab',
        postalCode: '54000',
        country: 'PK',
        latitude: 31.52,
        longitude: 74.35,
      },
      update: { line1 },
    });
  }

  await prisma.restaurantBranch.upsert({
    where: { id: IDS.branchA },
    create: {
      id: IDS.branchA,
      restaurantId: IDS.restaurant,
      addressId: IDS.addrA,
      operatingCityId: IDS.city,
      name: 'Branch A',
      status: 'ACTIVE',
      temporarilyClosed: false,
      timezone: 'Asia/Karachi',
    },
    update: { name: 'Branch A', status: 'ACTIVE', temporarilyClosed: false },
  });

  await prisma.restaurantBranch.upsert({
    where: { id: IDS.branchB },
    create: {
      id: IDS.branchB,
      restaurantId: IDS.restaurant,
      addressId: IDS.addrB,
      operatingCityId: IDS.city,
      name: 'Branch B',
      status: 'ACTIVE',
      temporarilyClosed: false,
      timezone: 'Asia/Karachi',
    },
    update: { name: 'Branch B', status: 'ACTIVE', temporarilyClosed: false },
  });

  await prisma.restaurantMembership.upsert({
    where: {
      userId_restaurantId: {
        userId: IDS.owner,
        restaurantId: IDS.restaurant,
      },
    },
    create: {
      id: IDS.membership,
      userId: IDS.owner,
      restaurantId: IDS.restaurant,
      role: 'OWNER',
      status: 'ACTIVE',
    },
    update: { role: 'OWNER', status: 'ACTIVE' },
  });

  console.log(
    JSON.stringify(
      {
        password: PASSWORD,
        ownerEmail: 'owner.smoke@eatwave.test',
        customerEmail: 'customer.smoke@eatwave.test',
        restaurantId: IDS.restaurant,
        branchA: IDS.branchA,
        branchB: IDS.branchB,
        ordersUrl: `http://localhost:3002/r/${IDS.restaurant}/b/${IDS.branchA}/orders`,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
