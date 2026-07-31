import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xyzcompany.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type UserRole = 'customer' | 'artist' | 'admin';

export interface UserProfile {
  id: string;
  full_name: string;
  phone?: string;
  role: UserRole;
  city?: string;
  created_at?: string;
}

export interface DBProduct {
  id: string;
  name: string;
  price: number;
  category: string;
  image: string;
  description?: string;
  stock: number;
  created_at?: string;
}

export interface DBOrder {
  id: string;
  customer_id?: string;
  customer_name: string;
  customer_phone: string;
  total_amount: number;
  shipping_address: string;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  created_at?: string;
}

export interface DBOrderItem {
  id?: string;
  order_id: string;
  product_id?: string;
  product_name: string;
  price: number;
  quantity: number;
}

export interface DBArtistBooking {
  id: string;
  customer_id?: string;
  customer_name: string;
  customer_phone: string;
  city_venue: string;
  event_date: string;
  safa_style: 'Rounded' | 'Jodhpuri' | 'Barati Safa';
  artist_id?: string;
  artist_name?: string;
  amount: number;
  status: 'pending' | 'assigned' | 'completed' | 'cancelled';
  created_at?: string;
}

export interface DBSupplierApplication {
  id: string;
  business_name: string;
  contact_name: string;
  phone: string;
  email?: string;
  city: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at?: string;
}

export interface DBAcademyEnrollment {
  id: string;
  full_name: string;
  phone: string;
  city?: string;
  center: string;
  status: 'pending' | 'contacted' | 'enrolled';
  created_at?: string;
}
