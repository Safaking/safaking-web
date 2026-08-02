'use client';

import { supabase } from '@/lib/supabase';

export type LeadState = 'open' | 'quoted' | 'awarded' | 'closed' | 'expired';
export type QuoteState = 'submitted' | 'withdrawn' | 'accepted' | 'rejected';

export interface Lead {
  id: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string;
  pincode: string;
  city: string | null;
  venue_address: string | null;
  event_date: string;
  guest_count: number | null;
  safa_count: number;
  safa_style: string | null;
  description: string | null;
  budget_hint: number | null;
  status: LeadState;
  awarded_quote_id: string | null;
  expires_on: string | null;
  created_at: string;
}

/** A lead as an artist sees it — never includes rival quote amounts. */
export interface ArtistLead {
  id: string;
  customer_name: string;
  pincode: string;
  city: string | null;
  venue_address: string | null;
  event_date: string;
  guest_count: number | null;
  safa_count: number;
  safa_style: string | null;
  description: string | null;
  budget_hint: number | null;
  status: LeadState;
  created_at: string;
  quote_count: number;
  already_quoted: boolean;
  match_rank: number;
}

export interface Quote {
  id: string;
  lead_id: string;
  artist_id: string;
  per_safa_rate: number;
  total_amount: number;
  message: string | null;
  can_bring_team: boolean;
  status: QuoteState;
  created_at: string;
  artist_name?: string | null;
  artist_rating?: number | null;
  artist_verified?: boolean;
  artist_events?: number;
}

function describe(error: unknown): string {
  const err = error as { message?: string; code?: string } | null;
  if (err?.code === 'PGRST205' || err?.code === '42P01') {
    return 'The marketplace is not set up yet — run supabase/013_lead_marketplace.sql.';
  }
  if (err?.code === '23505') {
    return 'You have already quoted on this enquiry.';
  }
  return err?.message ?? 'Something went wrong.';
}

export async function postLead(input: {
  customerId?: string | null;
  customerName: string;
  customerPhone: string;
  pincode: string;
  city?: string;
  venueAddress?: string;
  eventDate: string;
  guestCount?: number | null;
  safaCount: number;
  safaStyle?: string;
  description?: string;
  budgetHint?: number | null;
}): Promise<string> {
  if (!input.customerName.trim()) throw new Error('Enter your name.');
  if (!input.customerPhone.trim()) throw new Error('Enter a phone number.');
  if (input.pincode.replace(/\D/g, '').length !== 6) throw new Error('Enter a 6-digit pincode.');
  if (!input.safaCount || input.safaCount < 1) throw new Error('How many safas do you need?');

  const { data, error } = await supabase
    .from('leads')
    .insert({
      customer_id: input.customerId ?? null,
      customer_name: input.customerName.trim(),
      customer_phone: input.customerPhone.trim(),
      pincode: input.pincode.replace(/\D/g, ''),
      city: input.city?.trim() || null,
      venue_address: input.venueAddress?.trim() || null,
      event_date: input.eventDate,
      guest_count: input.guestCount ?? null,
      safa_count: input.safaCount,
      safa_style: input.safaStyle?.trim() || null,
      description: input.description?.trim() || null,
      budget_hint: input.budgetHint ?? null,
    })
    .select('id')
    .single();

  if (error) throw new Error(describe(error));
  return data.id as string;
}

export async function listMyLeads(customerId: string): Promise<Lead[]> {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(describe(error));
  return (data as Lead[]) ?? [];
}

export async function getLead(id: string): Promise<Lead | null> {
  const { data, error } = await supabase.from('leads').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(describe(error));
  return (data as Lead) ?? null;
}

/** Quotes on a lead. RLS returns all of them to the lead's owner, one to an artist. */
export async function listQuotes(leadId: string): Promise<Quote[]> {
  const { data, error } = await supabase
    .from('lead_quotes')
    .select('*, artist_profiles!lead_quotes_artist_id_fkey(display_name, rating, verified, total_events)')
    .eq('lead_id', leadId)
    .neq('status', 'withdrawn')
    .order('total_amount', { ascending: true });

  if (error) throw new Error(describe(error));

  return ((data ?? []) as (Quote & {
    artist_profiles?: {
      display_name?: string; rating?: number; verified?: boolean; total_events?: number;
    } | null;
  })[]).map((row) => ({
    ...row,
    artist_name: row.artist_profiles?.display_name ?? null,
    artist_rating: row.artist_profiles?.rating ?? null,
    artist_verified: row.artist_profiles?.verified ?? false,
    artist_events: row.artist_profiles?.total_events ?? 0,
  }));
}

/** Open enquiries this artist can actually serve. */
export async function listLeadsForArtist(artistId: string): Promise<ArtistLead[]> {
  const { data, error } = await supabase.rpc('leads_for_artist', { p_artist_id: artistId });
  if (error) throw new Error(describe(error));
  return (data as ArtistLead[]) ?? [];
}

export async function submitQuote(input: {
  leadId: string;
  artistId: string;
  perSafaRate: number;
  safaCount: number;
  message?: string;
  canBringTeam?: boolean;
}): Promise<void> {
  if (!Number.isFinite(input.perSafaRate) || input.perSafaRate < 0) {
    throw new Error('Enter a valid per-safa rate.');
  }

  const total = Math.round(input.perSafaRate * input.safaCount);

  const { error } = await supabase.from('lead_quotes').insert({
    lead_id: input.leadId,
    artist_id: input.artistId,
    per_safa_rate: Math.round(input.perSafaRate),
    total_amount: total,
    message: input.message?.trim() || null,
    can_bring_team: !!input.canBringTeam,
  });

  if (error) throw new Error(describe(error));
}

export async function withdrawQuote(quoteId: string): Promise<void> {
  const { error } = await supabase
    .from('lead_quotes')
    .update({ status: 'withdrawn' })
    .eq('id', quoteId);
  if (error) throw new Error(describe(error));
}

/** Awards the lead. Returns the id of the artist_booking it created. */
export async function acceptQuote(quoteId: string): Promise<string> {
  const { data, error } = await supabase.rpc('accept_quote', { p_quote_id: quoteId });
  if (error) throw new Error(describe(error));
  return data as string;
}
