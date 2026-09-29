import { getStaff } from '@/lib/staff-auth';
import { NextResponse } from 'next/server';
import { sendSupplierApprovedEmail } from '@/lib/email';

export const runtime = 'nodejs';

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function requireAdmin() {
  const { staff, error } = await getStaff();
  if (error) return { error };
  if (!staff.can('suppliers')) return { error: bad('Only authorized staff approves suppliers.', 403) };
  return { error: null };
}

/** Admin only: fires the "you're approved" email when a supplier application is approved. */
export async function POST(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  let body: { email: string; name: string; businessName: string };
  try {
    body = await request.json();
  } catch {
    return bad('Malformed request body.');
  }

  if (!body.email || !body.name || !body.businessName) return bad('Email, name, and businessName are required.');

  const result = await sendSupplierApprovedEmail({ to: body.email, name: body.name, businessName: body.businessName });
  return NextResponse.json(result);
}
