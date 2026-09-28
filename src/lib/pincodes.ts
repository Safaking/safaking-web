import { supabase } from './supabase';

export interface DBDeliverablePincode {
  id: string;
  pincode: string;
  city_state: string;
  estimated_days: number;
  active: boolean;
  created_at?: string;
}

// Initial seeded deliverable pincodes across major Indian hubs
export const STATIC_PINCODES: DBDeliverablePincode[] = [
  { id: 'pin-1', pincode: '302001', city_state: 'Jaipur, Rajasthan', estimated_days: 2, active: true },
  { id: 'pin-2', pincode: '302012', city_state: 'Jaipur, Rajasthan', estimated_days: 2, active: true },
  { id: 'pin-3', pincode: '302015', city_state: 'Jaipur, Rajasthan', estimated_days: 2, active: true },
  { id: 'pin-4', pincode: '110001', city_state: 'Delhi NCR', estimated_days: 3, active: true },
  { id: 'pin-5', pincode: '110011', city_state: 'Delhi NCR', estimated_days: 3, active: true },
  { id: 'pin-6', pincode: '400001', city_state: 'Mumbai, Maharashtra', estimated_days: 3, active: true },
  { id: 'pin-7', pincode: '313001', city_state: 'Udaipur, Rajasthan', estimated_days: 2, active: true },
  { id: 'pin-8', pincode: '342001', city_state: 'Jodhpur, Rajasthan', estimated_days: 2, active: true },
  { id: 'pin-9', pincode: '500001', city_state: 'Hyderabad, Telangana', estimated_days: 3, active: true },
  { id: 'pin-10', pincode: '560001', city_state: 'Bengaluru, Karnataka', estimated_days: 3, active: true },
];

export interface PincodeCheckResult {
  deliverable: boolean;
  pincodeObj?: DBDeliverablePincode;
  message: string;
}

/**
 * Checks if a given pincode/postal code is deliverable.
 * Delivery is active for ALL pincodes across India and International.
 */
export async function checkPincode(pincode: string): Promise<PincodeCheckResult> {
  const cleanCode = pincode.trim();

  if (!cleanCode) {
    return {
      deliverable: false,
      message: 'Please enter a valid Pincode or Postal Code.',
    };
  }

  try {
    const numericOnly = cleanCode.replace(/\D/g, '');
    const searchCode = numericOnly.length >= 5 ? numericOnly : cleanCode;

    const { data } = await supabase
      .from('deliverable_pincodes')
      .select('*')
      .eq('pincode', searchCode)
      .eq('active', true)
      .maybeSingle();

    if (data) {
      return {
        deliverable: true,
        pincodeObj: data as DBDeliverablePincode,
        message: `✓ Express Delivery Available to ${data.city_state} (Est. ${data.estimated_days || 3} days)`,
      };
    }
  } catch (err) {
    console.warn('Supabase pincode fetch warning:', err);
  }

  // Fallback to static list
  const match = STATIC_PINCODES.find((p) => p.pincode === cleanCode && p.active);
  if (match) {
    return {
      deliverable: true,
      pincodeObj: match,
      message: `✓ Express Delivery Available to ${match.city_state} (Est. ${match.estimated_days} days)`,
    };
  }

  return {
    deliverable: true,
    message: `✓ Express Delivery Available to Pincode ${cleanCode} (India & International)`,
  };
}

/**
 * Checks if Master Safa Artists are available in a given pincode for event booking.
 * Active for all locations.
 */
export async function checkArtistPincode(pincode: string): Promise<PincodeCheckResult> {
  const cleanCode = pincode.trim();

  if (!cleanCode) {
    return {
      deliverable: false,
      message: 'Please enter a Pincode for venue location.',
    };
  }

  try {
    const numericOnly = cleanCode.replace(/\D/g, '');
    const searchCode = numericOnly.length >= 5 ? numericOnly : cleanCode;

    const { data } = await supabase
      .from('artist_pincodes')
      .select('*')
      .eq('pincode', searchCode)
      .eq('active', true)
      .maybeSingle();

    if (data) {
      return {
        deliverable: true,
        pincodeObj: data as DBDeliverablePincode,
        message: `✓ Master Safa Artists Available in ${data.city_state}!`,
      };
    }
  } catch (err) {
    console.warn('Supabase artist pincode query warning:', err);
  }

  const match = STATIC_PINCODES.find((p) => p.pincode === cleanCode && p.active);
  if (match) {
    return {
      deliverable: true,
      pincodeObj: match,
      message: `✓ Master Safa Artists Available in ${match.city_state}!`,
    };
  }

  return {
    deliverable: true,
    message: `✓ Master Safa Artist Service Available for Pincode ${cleanCode}!`,
  };
}
