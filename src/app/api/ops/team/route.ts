import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function requireAdmin() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, admin: null, error: bad('Sign in.', 401) };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') {
    return { user, admin, error: bad('Administrators only.', 403) };
  }
  return { user, admin, error: null };
}

/**
 * GET  ?rentalId=…            -> suggested crew covering the booking's safa count
 * POST { rentalId, members }  -> create the team and invite everyone
 *
 * Admin only: a crew assignment decides who is legally expected at a venue.
 */
export async function GET(request: Request) {
  const { admin, error } = await requireAdmin();
  if (error) return error;

  const url = new URL(request.url);
  const rentalId = url.searchParams.get('rentalId');
  if (!rentalId) return bad('Which rental?');

  const { data: rental } = await admin!
    .from('rental_bookings')
    .select('id, pincode, start_date, safa_count, artist_id')
    .eq('id', rentalId)
    .maybeSingle();

  if (!rental) return bad('Rental not found.', 404);

  const { data: crew, error: rpcErr } = await admin!.rpc('suggest_team', {
    p_pincode: rental.pincode,
    p_date: rental.start_date,
    p_safa_count: rental.safa_count,
  });

  if (rpcErr) return bad(`Could not build a team: ${rpcErr.message}`, 500);

  const suggested = crew ?? [];
  const capacity = suggested.reduce(
    (sum: number, m: { safas_per_day: number }) => sum + m.safas_per_day,
    0
  );

  const { data: existing } = await admin!
    .from('booking_teams')
    .select('id, target_size, safa_count, leader_id')
    .eq('rental_id', rentalId)
    .maybeSingle();

  return NextResponse.json({
    booking: {
      id: rental.id,
      pincode: rental.pincode,
      date: rental.start_date,
      safaCount: rental.safa_count,
    },
    suggested,
    // Say plainly when the available crew cannot cover the job, rather than
    // returning a short list that looks complete.
    capacity,
    shortfall: Math.max(0, rental.safa_count - capacity),
    existingTeamId: existing?.id ?? null,
  });
}

export async function POST(request: Request) {
  const { user, admin, error } = await requireAdmin();
  if (error) return error;

  let body: {
    rentalId: string;
    members: { artistId: string; safasAssigned: number; perSafaRate: number; isLeader: boolean }[];
    notes?: string;
  };
  try {
    body = await request.json();
  } catch {
    return bad('Malformed request body.');
  }

  const { rentalId, members } = body;

  if (!rentalId) return bad('Which rental?');
  if (!Array.isArray(members) || members.length === 0) return bad('Choose at least one artist.');
  if (members.length > 50) return bad('That is more artists than one event can use.');

  const leaders = members.filter((m) => m.isLeader);
  if (leaders.length !== 1) {
    return bad('Exactly one artist must be marked team leader.');
  }

  const { data: rental } = await admin!
    .from('rental_bookings')
    .select('id, start_date, safa_count')
    .eq('id', rentalId)
    .maybeSingle();
  if (!rental) return bad('Rental not found.', 404);

  // Re-check every artist at assignment time. The suggestion may be minutes
  // old, and putting one artist at two weddings is the failure this whole
  // feature exists to avoid.
  for (const member of members) {
    const { data: free } = await admin!.rpc('artist_is_free', {
      p_artist_id: member.artistId,
      p_date: rental.start_date,
    });
    if (free === false) {
      const { data: who } = await admin!
        .from('artist_profiles').select('display_name').eq('id', member.artistId).maybeSingle();
      return bad(
        `${who?.display_name ?? 'One of the artists'} has just been booked for that date. Rebuild the team.`,
        409
      );
    }
  }

  // Replace any previous crew wholesale — a half-updated team is worse than a
  // rebuilt one.
  await admin!.from('booking_teams').delete().eq('rental_id', rentalId);

  const { data: team, error: teamErr } = await admin!
    .from('booking_teams')
    .insert({
      rental_id: rentalId,
      target_size: members.length,
      safa_count: rental.safa_count,
      notes: body.notes?.trim() ?? null,
      created_by: user!.id,
    })
    .select('id')
    .single();

  if (teamErr || !team) return bad(`Could not create the team: ${teamErr?.message}`, 500);

  // Leader first: the trigger that mirrors the leader onto the booking should
  // fire before the rest of the crew lands.
  const ordered = [...members].sort((a, b) => Number(b.isLeader) - Number(a.isLeader));

  const { error: membersErr } = await admin!.from('booking_team_members').insert(
    ordered.map((m) => ({
      team_id: team.id,
      artist_id: m.artistId,
      is_leader: m.isLeader,
      safas_assigned: Math.max(0, Math.trunc(m.safasAssigned)),
      per_safa_rate: Math.max(0, Math.trunc(m.perSafaRate)),
      payout_amount: Math.max(0, Math.trunc(m.safasAssigned)) * Math.max(0, Math.trunc(m.perSafaRate)),
      status: 'invited',
    }))
  );

  if (membersErr) {
    await admin!.from('booking_teams').delete().eq('id', team.id);
    return bad(`Could not add the crew: ${membersErr.message}`, 500);
  }

  return NextResponse.json({
    success: true,
    teamId: team.id,
    size: members.length,
    assigned: members.reduce((sum, m) => sum + m.safasAssigned, 0),
  });
}
