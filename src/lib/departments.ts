/**
 * Who on staff may do what.
 *
 * The database is the authority — staff_can() in supabase/037 — and this
 * file must say exactly the same thing. It decides which parts of the admin
 * panel a person sees and what the API routes allow, so nobody meets a
 * screen whose data the database would refuse them anyway.
 *
 * Not a 'use client' module: the API routes import it.
 */

export type Department = 'operations' | 'support' | 'artist_ops' | 'finance';
export type StaffUnit = 'owner' | Department;

export type Permission =
  | 'customers' | 'bookings' | 'assign_artist' | 'artists' | 'kyc' | 'standing'
  | 'complaints' | 'messages' | 'reports' | 'finance' | 'expenses' | 'expenses_read'
  | 'refund_verify' | 'refund_approve' | 'refund_send' | 'refund_exception';

export const DEPARTMENTS: Department[] = ['operations', 'support', 'artist_ops', 'finance'];

export const DEPARTMENT_LABEL: Record<StaffUnit, string> = {
  owner: 'Owner',
  operations: 'Operations Manager',
  support: 'Customer Support',
  artist_ops: 'Artist Manager',
  finance: 'Finance',
};

export const DEPARTMENT_SCOPE: Record<StaffUnit, string> = {
  owner: 'Full access',
  operations: 'Daily operations: bookings, dispatch, complaints and refunds',
  support: 'Customers and bookings',
  artist_ops: 'Artists and bookings, including KYC',
  finance: 'Payments and finance',
};

/** Mirrors staff_can() in supabase/037. */
const MATRIX: Record<Department, Permission[]> = {
  operations: [
    'customers', 'bookings', 'assign_artist', 'standing', 'complaints', 'messages', 'reports',
    'expenses_read', 'refund_verify', 'refund_approve', 'refund_send', 'refund_exception',
  ],
  support: ['customers', 'bookings', 'complaints', 'messages', 'refund_verify'],
  artist_ops: ['bookings', 'assign_artist', 'artists', 'kyc', 'standing', 'complaints'],
  finance: [
    'bookings', 'finance', 'expenses', 'expenses_read', 'reports',
    'refund_verify', 'refund_approve', 'refund_send',
  ],
};

const isDepartment = (value: unknown): value is Department =>
  typeof value === 'string' && (DEPARTMENTS as string[]).includes(value);

/** 'owner' for an admin, the department for a manager, null for anyone else. */
export function unitOf(role: string | null | undefined, department: string | null | undefined): StaffUnit | null {
  if (role === 'admin') return 'owner';
  if (role === 'manager') return isDepartment(department) ? department : 'operations';
  return null;
}

export function can(unit: StaffUnit | null | undefined, permission: Permission): boolean {
  if (!unit) return false;
  return unit === 'owner' || MATRIX[unit].includes(permission);
}

/** Admin panel tabs per department. The owner sees every tab. */
export const DEPARTMENT_TABS: Record<Department, string[]> = {
  operations: [
    'liveops', 'analytics', 'orders', 'rentals', 'bookings', 'complaints',
    'messages', 'academy', 'careers', 'training', 'protection', 'security',
  ],
  support: ['liveops', 'orders', 'rentals', 'bookings', 'complaints', 'messages', 'academy', 'protection', 'security'],
  artist_ops: ['liveops', 'bookings', 'rentals', 'artist_apps', 'verification', 'training', 'complaints', 'users', 'security'],
  finance: ['analytics', 'orders', 'rentals', 'bookings', 'payouts', 'expenses', 'protection', 'security'],
};
