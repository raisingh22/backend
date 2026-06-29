import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AuthService } from './auth/auth.service';
import { CustomersService } from './customers/customers.service';
import { PrescriptionsService } from './prescriptions/prescriptions.service';
import { OrdersService } from './orders/orders.service';
import { DashboardService } from './dashboard/dashboard.service';
import { PrismaService } from './prisma/prisma.service';
import { ExpensesService } from './expenses/expenses.service';
import { SuppliersService } from './suppliers/suppliers.service';

async function bootstrap() {
  console.log('🚀 Starting OptiFlow E2E Business Flow Integration Test...');
  const app = await NestFactory.createApplicationContext(AppModule);

  const authService = app.get(AuthService);
  const customersService = app.get(CustomersService);
  const prescriptionsService = app.get(PrescriptionsService);
  const ordersService = app.get(OrdersService);
  const dashboardService = app.get(DashboardService);
  const prismaService = app.get(PrismaService);
  const expensesService = app.get(ExpensesService);
  const suppliersService = app.get(SuppliersService);

  const uniqueId = Date.now().toString();
  const testEmail = `test-${uniqueId}@optiflow-test.com`;

  try {
    // 1. REGISTER
    console.log('\nStep 1: Registering new merchant account...');
    const registerRes = await authService.register({
      fullName: 'Test Optician',
      email: testEmail,
      password: 'password123',
      workspaceName: 'E2E Test Optics',
    });
    const workspaceId = registerRes.workspace.id;
    const userId = registerRes.user.id;
    console.log(`✅ Registration Success! Workspace ID: ${workspaceId}, User ID: ${userId}`);

    // 2. LOGIN
    console.log('\nStep 2: Authenticating registered user...');
    const loginRes = await authService.login({
      email: testEmail,
      password: 'password123',
    });
    if (!loginRes.token) {
      throw new Error('JWT Token generation failed');
    }
    console.log('✅ Login Success! Token successfully generated.');

    // 3. CREATE CUSTOMER
    console.log('\nStep 3: Creating a new customer profile...');
    const customer = await customersService.create(workspaceId, {
      fullName: 'John E2E Doe',
      phone: '+919999911111',
      email: 'johndoe@e2e.com',
      notes: 'Testing offline queue and PDF invoicing features',
      tags: ['VIP', 'Progressive'],
    });
    console.log(`✅ Customer Created! ID: ${customer.id}, Name: ${customer.fullName}`);

    // 4. ADD PRESCRIPTION
    console.log('\nStep 4: Recording a clinical eye examination prescription...');
    const prescription = await prescriptionsService.create(customer.id, workspaceId, {
      rightSphere: -2.5,
      rightCylinder: -0.5,
      rightAxis: 90,
      rightAdd: 1.5,
      leftSphere: -2.25,
      leftCylinder: -0.75,
      leftAxis: 95,
      leftAdd: 1.5,
      pupillaryDistance: 64,
      doctorName: 'Dr. Eyecare Specialist',
      notes: 'Anti-reflective coating recommended',
    });
    console.log(`✅ Prescription Created! ID: ${prescription.id}, OD: SPH -2.5, OS: SPH -2.25`);

    // 5. PLACE ORDER
    console.log('\nStep 5: Booking a specs order linked to prescription...');
    const order = await ordersService.create(workspaceId, {
      customerId: customer.id,
      prescriptionId: prescription.id,
      frameBrand: 'Ray-Ban',
      frameModel: 'RB2140 Wayfarer',
      lensType: 'Progressive Blue-Cut',
      lensCoating: 'Crizal Alize',
      quantity: 1,
      subtotal: 12000,
      discount: 2000,
      tax: 1800,
      total: 11800,
      paidAmount: 5000,
    });
    console.log(`✅ Order Created! Order Number: ${order.orderNumber}, Total: ₹${order.total}, Balance Due: ₹${order.balanceAmount}`);

    // 6. LOYALTY POINTS VERIFICATION
    console.log('\nStep 6: Verifying loyalty points awarded to customer...');
    const updatedCustomer = await prismaService.customer.findUnique({
      where: { id: customer.id }
    });
    if (!updatedCustomer) {
      throw new Error('Updated customer profile not found');
    }
    console.log(`✅ Loyalty Points: ${updatedCustomer.loyaltyPoints} (Expected: 50), Tier: ${updatedCustomer.membershipTier}`);
    if (updatedCustomer.loyaltyPoints !== 50) {
      throw new Error('Loyalty points allocation incorrect');
    }

    // 7. EXPENSE LOGGING & SUPPLIER DIRECTORY
    console.log('\nStep 7: Testing shop expenses and supplier creation...');
    const expense = await expensesService.create(workspaceId, {
      description: 'Test Rent',
      amount: 5000,
      category: 'RENT',
    });
    console.log(`✅ Expense Logged! Description: ${expense.description}, Amount: ₹${expense.amount}`);

    const supplier = await suppliersService.create(workspaceId, {
      name: 'Zeiss Lenses Inc',
      contactPerson: 'Aditya Prasad',
      phone: '+919999900000',
    });
    console.log(`✅ Supplier Registered! Name: ${supplier.name}, Contact: ${supplier.contactPerson}`);

    // 8. ADVANCED FINANCIAL ANALYTICS
    console.log('\nStep 8: Fetching financial overview aggregates...');
    const dashboardData = await dashboardService.getDashboardData(workspaceId);
    console.log('✅ Financial Aggregations successfully fetched!');
    console.log(`📈 Revenue: ₹${dashboardData.stats.totalRevenue}, Expenses: ₹${dashboardData.stats.totalExpenses}, Net Profit: ₹${dashboardData.stats.netProfit}`);

    if (dashboardData.stats.totalRevenue !== 5000 || dashboardData.stats.totalExpenses !== 5000) {
      throw new Error('Financial aggregates calculated incorrectly');
    }

    // CLEANUP
    console.log('\nCleaning up E2E generated database entries...');
    await prismaService.expense.delete({ where: { id: expense.id } });
    await prismaService.supplier.delete({ where: { id: supplier.id } });
    // Cascading deletes handled via relational queries or manual deletes
    await prismaService.order.delete({ where: { id: order.id } });
    await prismaService.prescription.delete({ where: { id: prescription.id } });
    await prismaService.customer.delete({ where: { id: customer.id } });
    await prismaService.user.delete({ where: { id: userId } });
    await prismaService.workspace.delete({ where: { id: workspaceId } });
    console.log('🧹 Cleanup Completed successfully.');
    console.log('\n🎉 ALL BUSINESS FLOW E2E TESTS COMPLETED WITH 100% SUCCESS!');

  } catch (error) {
    console.error('❌ E2E FLOW TEST FAILED:', error);
    process.exit(1);
  } finally {
    await app.close();
    process.exit(0);
  }
}

bootstrap();
