import { PrismaService } from './prisma/prisma.service';

const prisma = new PrismaService();

async function run() {
  console.log('Starting historical data migration to Visit-Centric model...');

  const prescriptions = await prisma.prescription.findMany({
    where: { visitId: null },
    orderBy: { createdAt: 'asc' },
  });

  const orders = await prisma.order.findMany({
    where: { visitId: null },
    orderBy: { createdAt: 'asc' },
  });

  console.log(
    `Found ${prescriptions.length} prescriptions and ${orders.length} orders without visits.`,
  );

  // Group by customerId
  const customerData: Record<string, { prescriptions: any[]; orders: any[] }> =
    {};

  for (const rx of prescriptions) {
    if (!customerData[rx.customerId]) {
      customerData[rx.customerId] = { prescriptions: [], orders: [] };
    }
    customerData[rx.customerId].prescriptions.push(rx);
  }

  for (const order of orders) {
    if (!customerData[order.customerId]) {
      customerData[order.customerId] = { prescriptions: [], orders: [] };
    }
    customerData[order.customerId].orders.push(order);
  }

  let visitCount = 0;

  for (const customerId of Object.keys(customerData)) {
    const data = customerData[customerId];

    // Find the customer workspaceId (required field on Visit)
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { workspaceId: true, fullName: true },
    });
    if (!customer) {
      console.warn(`Customer ${customerId} not found. Skipping.`);
      continue;
    }

    const { workspaceId, fullName } = customer;
    console.log(`Processing customer: ${fullName} (${customerId})`);

    // A simple grouping strategy:
    // Create a visit for each Prescription and link any Orders created within 24 hours of that prescription.
    // Remaining orders get their own separate visits.
    const linkedOrderIds = new Set<string>();

    for (const rx of data.prescriptions) {
      // Create a Visit on the prescription date
      const visit = await prisma.visit.create({
        data: {
          customerId,
          workspaceId,
          date: rx.prescriptionDate || rx.createdAt,
          type: 'Eye Examination',
          doctorName: rx.doctorName || 'Optometrist',
          notes: 'Auto-migrated from historical prescription history.',
        },
      });
      visitCount++;

      // Link prescription to this visit
      await prisma.prescription.update({
        where: { id: rx.id },
        data: { visitId: visit.id },
      });

      // Find orders for this customer created within 24 hours (86400000 ms) of this prescription
      const rxTime = new Date(rx.createdAt).getTime();
      const closeOrders = data.orders.filter((o) => {
        if (linkedOrderIds.has(o.id)) return false;
        const oTime = new Date(o.createdAt).getTime();
        return Math.abs(oTime - rxTime) <= 24 * 60 * 60 * 1000;
      });

      for (const order of closeOrders) {
        await prisma.order.update({
          where: { id: order.id },
          data: { visitId: visit.id },
        });

        await prisma.ledgerTransaction.updateMany({
          where: { referenceId: order.id },
          data: { visitId: visit.id },
        });

        linkedOrderIds.add(order.id);
      }
    }

    // Remaining orders get their own separate visits
    const remainingOrders = data.orders.filter(
      (o) => !linkedOrderIds.has(o.id),
    );
    for (const order of remainingOrders) {
      const visit = await prisma.visit.create({
        data: {
          customerId,
          workspaceId,
          date: order.createdAt,
          type: 'Purchase Encounter',
          doctorName: 'Sales Staff',
          notes: 'Auto-migrated from historical sales history.',
        },
      });
      visitCount++;

      await prisma.order.update({
        where: { id: order.id },
        data: { visitId: visit.id },
      });

      await prisma.ledgerTransaction.updateMany({
        where: { referenceId: order.id },
        data: { visitId: visit.id },
      });
    }
  }

  console.log(`Migration complete. Created ${visitCount} historical visits.`);
}

run()
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    // Custom PrismaService pool cleanups happen inside onModuleDestroy or disconnect
    await prisma.$disconnect();
  });
