/**
 * M05 partner smoke seed (EAT-39 shell + EAT-40 queue). Valid RFC UUID v4 IDs.
 * Seeds a PENDING order (New highlight) and a CONFIRMED order (In progress).
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
  orderPending: 'aa111111-1111-4111-8111-111111111111',
  orderConfirmed: 'aa222222-2222-4222-8222-222222222222',
  itemPending: 'ab111111-1111-4111-8111-111111111111',
  itemConfirmed: 'ab222222-2222-4222-8222-222222222222',
  histPending: 'ac111111-1111-4111-8111-111111111111',
  histConfirmedPending: 'ac222222-2222-4222-8222-222222222222',
  histConfirmedAccept: 'ac333333-3333-4333-8333-333333333333',
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

  const pendingCreatedAt = new Date(Date.now() - 2 * 60_000);
  const confirmedCreatedAt = new Date(Date.now() - 15 * 60_000);
  const confirmedAcceptedAt = new Date(Date.now() - 10 * 60_000);

  await upsertQueueOrder({
    id: IDS.orderPending,
    itemId: IDS.itemPending,
    status: 'PENDING',
    createdAt: pendingCreatedAt,
    itemName: 'Smoke Burger (new)',
    history: [
      {
        id: IDS.histPending,
        fromStatus: null,
        toStatus: 'PENDING',
        createdAt: pendingCreatedAt,
      },
    ],
  });

  await upsertQueueOrder({
    id: IDS.orderConfirmed,
    itemId: IDS.itemConfirmed,
    status: 'CONFIRMED',
    createdAt: confirmedCreatedAt,
    itemName: 'Smoke Fries (in progress)',
    history: [
      {
        id: IDS.histConfirmedPending,
        fromStatus: null,
        toStatus: 'PENDING',
        createdAt: confirmedCreatedAt,
      },
      {
        id: IDS.histConfirmedAccept,
        fromStatus: 'PENDING',
        toStatus: 'CONFIRMED',
        createdAt: confirmedAcceptedAt,
      },
    ],
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
        pendingOrderId: IDS.orderPending,
        confirmedOrderId: IDS.orderConfirmed,
        ordersUrl: `http://localhost:3002/r/${IDS.restaurant}/b/${IDS.branchA}/orders`,
        hint: 'Log in as owner → Orders: New (PENDING highlight) vs In progress (CONFIRMED)',
      },
      null,
      2,
    ),
  );
}

async function upsertQueueOrder({
  id,
  itemId,
  status,
  createdAt,
  itemName,
  history,
}) {
  await prisma.order.upsert({
    where: { id },
    create: {
      id,
      userId: IDS.customer,
      restaurantBranchId: IDS.branchA,
      restaurantName: 'Smoke Kitchen',
      branchName: 'Branch A',
      fulfillmentType: 'DELIVERY',
      deliveryAddressId: IDS.addrA,
      deliveryLabel: 'Home',
      deliveryLine1: '1 Smoke St',
      deliveryCity: 'Lahore',
      deliveryRegion: 'Punjab',
      deliveryPostalCode: '54000',
      deliveryCountry: 'PK',
      status,
      currency: 'PKR',
      itemsSubtotalCents: 1500,
      discountCents: 0,
      serviceFeeCents: 100,
      deliveryFeeCents: 200,
      taxCents: 0,
      taxRateBps: 0,
      totalCents: 1800,
      createdAt,
      updatedAt: createdAt,
      items: {
        create: {
          id: itemId,
          name: itemName,
          unitPriceCents: 1500,
          quantity: 1,
          lineTotalCents: 1500,
        },
      },
      history: {
        create: history.map((h) => ({
          id: h.id,
          fromStatus: h.fromStatus,
          toStatus: h.toStatus,
          actorUserId: h.toStatus === 'CONFIRMED' ? IDS.owner : IDS.customer,
          createdAt: h.createdAt,
        })),
      },
    },
    update: {
      status,
      restaurantName: 'Smoke Kitchen',
      branchName: 'Branch A',
      totalCents: 1800,
      createdAt,
      updatedAt: createdAt,
    },
  });

  // Re-run history/items for idempotent re-seeds (upsert update cannot nest easily).
  await prisma.orderItem.deleteMany({ where: { orderId: id } });
  await prisma.orderStatusHistory.deleteMany({ where: { orderId: id } });
  await prisma.orderItem.create({
    data: {
      id: itemId,
      orderId: id,
      name: itemName,
      unitPriceCents: 1500,
      quantity: 1,
      lineTotalCents: 1500,
    },
  });
  for (const h of history) {
    await prisma.orderStatusHistory.create({
      data: {
        id: h.id,
        orderId: id,
        fromStatus: h.fromStatus,
        toStatus: h.toStatus,
        actorUserId: h.toStatus === 'CONFIRMED' ? IDS.owner : IDS.customer,
        createdAt: h.createdAt,
      },
    });
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
