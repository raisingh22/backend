import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Intercepts POST / PATCH / DELETE requests and writes an AuditLog entry
 * after the handler completes successfully.
 *
 * Attach at the controller level:
 *   @UseInterceptors(AuditInterceptor)
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;

    // Only audit mutating operations
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const user = request.user;
    if (!user) {
      return next.handle();
    }

    const action = this.methodToAction(method);
    const entityType = this.resolveEntityType(context);
    const entityId = request.params?.id || request.params?.orderId || request.params?.customerId || request.params?.transactionId || null;

    return next.handle().pipe(
      tap(async (responseBody) => {
        try {
          // For create operations, capture the new entity's ID from the response
          const resolvedEntityId = entityId || responseBody?.id || null;

          await this.prisma.auditLog.create({
            data: {
              userId: user.id,
              userName: user.fullName || user.email || null,
              action,
              entityType,
              entityId: resolvedEntityId,
              details: JSON.stringify({
                body: method === 'DELETE' ? undefined : request.body,
                params: request.params,
              }),
              ipAddress: request.ip || request.connection?.remoteAddress || null,
              userAgent: request.headers?.['user-agent'] || null,
              workspaceId: user.workspaceId,
            },
          });
        } catch (err) {
          // Silently fail — audit logging should never block business operations
          console.error('AuditInterceptor: failed to write audit log', err);
        }
      }),
    );
  }

  private methodToAction(method: string): string {
    switch (method) {
      case 'POST': return 'CREATE';
      case 'PATCH':
      case 'PUT': return 'UPDATE';
      case 'DELETE': return 'DELETE';
      default: return method;
    }
  }

  private resolveEntityType(context: ExecutionContext): string {
    const controllerName = context.getClass().name;
    // Map controller names to entity types
    const mapping: Record<string, string> = {
      OrdersController: 'Order',
      CustomersController: 'Customer',
      AppointmentsController: 'Appointment',
      VisitController: 'Visit',
      LedgerController: 'LedgerTransaction',
      SettingsController: 'Settings',
      AuthController: 'Auth',
    };
    return mapping[controllerName] || controllerName.replace('Controller', '');
  }
}
