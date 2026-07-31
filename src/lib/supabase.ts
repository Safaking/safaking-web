import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local'
  );
}

/** Browser client. Persists the session in cookies so middleware can read it. */
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

export type UserRole = 'customer' | 'artist' | 'admin';

/** Roles a visitor may pick at signup. Admin is granted by an admin, never chosen. */
export const SIGNUP_ROLES: Exclude<UserRole, 'admin'>[] = ['customer', 'artist'];

export interface UserProfile {
  id: string;
  full_name: string;
  phone?: string | null;
  email?: string | null;
  role: UserRole;
  city?: string | null;
  created_at?: string;
}

export interface DBProduct {
  id: string;
  code?: string | null;
  name: string;
  description?: string | null;
  price: number;
  original_price?: number | null;
  category?: string | null;
  color?: string | null;
  fabric?: string | null;
  style?: string | null;
  occasion?: string | null;
  image?: string | null;
  rating?: number | null;
  reviews_count?: number | null;
  stock: number;
  is_new?: boolean;
  is_bestseller?: boolean;
  active?: boolean;
  sort_order?: number;
  created_at?: string;
}

export interface DBOrder {
  id: string;
  customer_id?: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  total_amount: number;
  advance_amount?: number;
  balance_amount?: number;
  payment_status?: 'advance_pending' | 'advance_paid' | 'fully_paid' | 'refunded';
  shipping_address: string;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  created_at?: string;
}

export interface DBOrderItem {
  id?: string;
  order_id: string;
  product_id?: string | null;
  product_name: string;
  price: number;
  quantity: number;
}

export interface DBArtistBooking {
  id: string;
  customer_id?: string | null;
  customer_name: string;
  customer_phone: string;
  city_venue: string;
  event_date: string;
  safa_style: string;
  artist_id?: string | null;
  artist_name?: string | null;
  amount: number;
  advance_amount?: number;
  balance_amount?: number;
  payment_status?: 'advance_pending' | 'advance_paid' | 'fully_paid' | 'refunded';
  status: 'pending' | 'assigned' | 'completed' | 'cancelled';
  notes?: string | null;
  created_at?: string;
}

export interface DBArtistApplication {
  id: string;
  user_id?: string | null;
  full_name: string;
  phone: string;
  city: string;
  experience_years: number;
  specialties: string[];
  team_size: number;
  per_safa_rate?: number | null;
  portfolio_link?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at?: string;
}

export interface DBDeliverablePincode {
  id: string;
  pincode: string;
  city_state: string;
  estimated_days: number;
  active: boolean;
  created_at?: string;
}

export interface DBSupplierApplication {
  id: string;
  user_id?: string | null;
  business_name: string;
  contact_name: string;
  phone: string;
  email?: string | null;
  city?: string | null;
  category?: string | null;
  message?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at?: string;
}

export interface DBAcademyEnrollment {
  id: string;
  user_id?: string | null;
  full_name: string;
  phone: string;
  city?: string | null;
  center: string;
  status: 'pending' | 'contacted' | 'enrolled';
  notes?: string | null;
  created_at?: string;
}

export interface DBJobApplication {
  id: string;
  user_id?: string | null;
  job_id: string;
  job_title: string;
  full_name: string;
  phone: string;
  email: string;
  city?: string | null;
  experience?: string | null;
  message?: string | null;
  status: 'pending' | 'shortlisted' | 'hired' | 'rejected';
  created_at?: string;
}

/**
 * Turns a Postgres/PostgREST error into something a visitor can read.
 * PGRST205 means the table is missing — i.e. schema.sql was never run.
 */
export function friendlyError(error: unknown): string {
  const err = error as { code?: string; message?: string } | null;
  if (!err) return 'Something went wrong. Please try again.';

  if (err.code === 'PGRST205' || err.code === '42P01') {
    return 'Database not set up yet — run supabase/schema.sql in the Supabase SQL Editor.';
  }
  if (err.code === '42501' || err.code === 'PGRST301') {
    return 'You do not have permission to do that.';
  }
  if (err.code === '23505') {
    return 'That record already exists.';
  }
  return err.message || 'Something went wrong. Please try again.';
}
