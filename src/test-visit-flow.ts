import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AuthService } from './auth/auth.service';
import { CustomersService } from './customers/customers.service';
import { VisitService } from './visit/visit.service';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
  console.log('🚀 Starting OptiFlow E2E Visit-Centric Redesign Test...');
  const app = await NestFactory.createApplicationContext(AppModule);

  const authService = app.get(AuthService);
  const customersService = app.get(CustomersService);
  const visitService = app.get(VisitService);
  const prismaService = app.get(PrismaService);

  const uniqueId = Date.now().toString();
  const testEmail = `test-visit-${uniqueId}@optiflow-test.com`;
  const testPhone = `+91${Math.floor(1000000000 + Math.random() * 9000000000).toString().substring(0, 10)}`;

  try {
    // 1. REGISTER
    console.log('\nStep 1: Registering new merchant account...');
    const registerRes = await authService.register({
      fullName: 'Visit Test Optician',
      mobileNumber: testPhone,
      email: testEmail,
      password: 'Password123!',
      workspaceName: 'E2E Visit Test Optics',
    });
    const workspaceId = registerRes.workspace.id;
    console.log(`✅ Registration Success! Workspace ID: ${workspaceId}`);

    // 2. CREATE CUSTOMER
    console.log('\nStep 2: Creating a new customer...');
    const customer = await customersService.create(workspaceId, {
      fullName: 'Jane Visit Doe',
      phone: '9999988888',
      email: 'jane.doe@visits.com',
    });
    console.log(`✅ Customer Created! ID: ${customer.id}`);

    // 3. CREATE VISIT
    console.log('\nStep 3: Creating a unified visit encounter with nested prescription and order...');
    const visit = await visitService.create(workspaceId, {
      customerId: customer.id,
      type: 'Full Examination',
      doctorName: 'Dr. John Miller',
      notes: 'Initial check-up visit notes',
      prescription: {
        rightSphere: -1.75,
        rightCylinder: -0.5,
        rightAxis: 90,
        rightAdd: 1.5,
        leftSphere: -1.5,
        leftCylinder: -0.25,
        leftAxis: 85,
        leftAdd: 1.5,
        pupillaryDistance: 64,
        notes: 'Advised photochromic progressive lenses',
      },
      order: {
        frameBrand: 'Oakley',
        frameModel: 'OX8156',
        frameName: 'Holbrook RX',
        lensType: 'Progressive',
        lensCoating: 'Crizal Sapphire',
        quantity: 1,
        subtotal: 15000,
        discount: 2000,
        tax: 500,
        paidAmount: 5000,
        notes: 'Fit bifocal height at 18mm',
      },
    });

    console.log(`✅ Visit Created! ID: ${visit.id}`);
    console.log(`✅ Prescriptions linked: ${visit.prescriptions.length}`);
    console.log(`✅ Orders linked: ${visit.orders.length}`);
    console.log(`✅ Dues posted & transactions logged: ${visit.transactions.length}`);

    // Assert relations are intact
    if (visit.prescriptions.length !== 1 || visit.prescriptions[0].rightSphere !== -1.75) {
      throw new Error('Prescription was not correctly created or linked to visit');
    }
    if (visit.orders.length !== 1 || visit.orders[0].frameBrand !== 'Oakley') {
      throw new Error('Specs order was not correctly created or linked to visit');
    }
    if (visit.transactions.length !== 2) {
      throw new Error('Ledger transaction count is invalid (expected invoice + deposit payment)');
    }

    // 4. CLEANUP / CASCADING DELETE
    console.log('\nStep 4: Performing cascading delete of the visit...');
    await visitService.remove(visit.id, workspaceId);

    const checkPrescriptions = await prismaService.prescription.findMany({
      where: { visitId: visit.id },
    });
    const checkOrders = await prismaService.order.findMany({
      where: { visitId: visit.id },
    });
    const checkTx = await prismaService.ledgerTransaction.findMany({
      where: { visitId: visit.id },
    });

    if (checkPrescriptions.length > 0 || checkOrders.length > 0 || checkTx.length > 0) {
      throw new Error('Cascade delete did not purge nested records');
    }
    console.log('✅ Cascade deletion successfully verified! All orphaned records purged.');

    // Cleanup customer and workspace
    console.log('\nCleaning up E2E generated database entries...');
    await prismaService.customer.delete({ where: { id: customer.id } });
    await prismaService.user.delete({ where: { email: testEmail } });
    await prismaService.workspace.delete({ where: { id: workspaceId } });
    console.log('🧹 Cleanup Completed successfully.');
    console.log('🎉 VISIT-CENTRIC E2E TESTS COMPLETED WITH 100% SUCCESS!');

  } catch (error) {
    console.error('❌ E2E Test Execution Failed:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

bootstrap();
