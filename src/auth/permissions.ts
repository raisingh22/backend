import { Role } from '@prisma/client';

export enum Permission {
  READ_CLINIC = 'READ_CLINIC',
  WRITE_CLINIC = 'WRITE_CLINIC',
  MANAGE_STAFF = 'MANAGE_STAFF',
  READ_LEDGER = 'READ_LEDGER',
  WRITE_LEDGER = 'WRITE_LEDGER',
  VIEW_AUDIT_LOGS = 'VIEW_AUDIT_LOGS',
}

export const RolePermissions: Record<Role, Permission[]> = {
  OWNER: [
    Permission.READ_CLINIC,
    Permission.WRITE_CLINIC,
    Permission.MANAGE_STAFF,
    Permission.READ_LEDGER,
    Permission.WRITE_LEDGER,
    Permission.VIEW_AUDIT_LOGS,
  ],
  MANAGER: [
    Permission.READ_CLINIC,
    Permission.WRITE_CLINIC,
    Permission.MANAGE_STAFF,
    Permission.READ_LEDGER,
    Permission.WRITE_LEDGER,
  ],
  STAFF: [Permission.READ_CLINIC, Permission.WRITE_CLINIC],
};
