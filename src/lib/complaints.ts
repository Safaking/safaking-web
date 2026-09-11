'use client';

import {
  supabase, friendlyError, DBComplaint, DBComplaintMessage, ComplaintStatus, UserRole,
} from '@/lib/supabase';
import { COMPLAINT_CATEGORY_LABEL, ComplaintCategory } from '@/lib/complaint-triage';

export const COMPLAINT_STATUS_LABEL: Record<ComplaintStatus, string> = {
  open: 'Open',
  awaiting_artist: 'Waiting on artist',
  awaiting_customer: 'Waiting on customer',
  escalated: 'Escalated to admin',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
};

export const COMPLAINT_STATUS_TONE: Record<ComplaintStatus, string> = {
  open: 'bg-rose-100 text-rose-800',
  awaiting_artist: 'bg-amber-100 text-amber-800',
  awaiting_customer: 'bg-royal-100 text-royal-800',
  escalated: 'bg-maroon-100 text-maroon-800',
  resolved: 'bg-emerald-100 text-emerald-800',
  dismissed: 'bg-gray-100 text-gray-600',
};

export const OPEN_STATUSES: ComplaintStatus[] = [
  'open', 'awaiting_artist', 'awaiting_customer', 'escalated',
];

export async function listComplaints(): Promise<DBComplaint[]> {
  const { data, error } = await supabase
    .from('complaints')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(friendlyError(error));
  return (data as DBComplaint[]) ?? [];
}

export async function listComplaintMessages(complaintId: string): Promise<DBComplaintMessage[]> {
  const { data, error } = await supabase
    .from('complaint_messages')
    .select('*')
    .eq('complaint_id', complaintId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(friendlyError(error));
  return (data as DBComplaintMessage[]) ?? [];
}

export async function raiseComplaint(input: {
  bookingId?: string | null;
  rentalId?: string | null;
  artistId?: string | null;
  customerId: string;
  customerName: string;
  customerPhone?: string | null;
  subject?: string;
  description: string;
  /** Drives the priority the database assigns — the customer never picks P1–P4. */
  category: ComplaintCategory;
}): Promise<DBComplaint> {
  const { data, error } = await supabase
    .from('complaints')
    .insert({
      booking_id: input.bookingId ?? null,
      rental_id: input.rentalId ?? null,
      artist_id: input.artistId ?? null,
      customer_id: input.customerId,
      customer_name: input.customerName,
      customer_phone: input.customerPhone ?? null,
      subject: (input.subject?.trim() || COMPLAINT_CATEGORY_LABEL[input.category]),
      description: input.description.trim(),
      category: input.category,
      status: 'open',
    })
    .select('*')
    .single();

  if (error) throw new Error(friendlyError(error));
  return data as DBComplaint;
}

export async function postComplaintMessage(input: {
  complaintId: string;
  authorId: string | null;
  authorRole: UserRole | 'system';
  authorName: string | null;
  body: string;
  internal?: boolean;
}): Promise<DBComplaintMessage> {
  const { data, error } = await supabase
    .from('complaint_messages')
    .insert({
      complaint_id: input.complaintId,
      author_id: input.authorId,
      author_role: input.authorRole,
      author_name: input.authorName,
      body: input.body.trim(),
      internal: input.internal ?? false,
    })
    .select('*')
    .single();

  if (error) throw new Error(friendlyError(error));
  return data as DBComplaintMessage;
}

export async function updateComplaint(
  id: string,
  patch: Partial<DBComplaint>
): Promise<void> {
  const { error } = await supabase.from('complaints').update(patch).eq('id', id);
  if (error) throw new Error(friendlyError(error));
}
