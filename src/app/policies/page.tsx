'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft, ScrollText, IndianRupee, CalendarX2, CalendarClock, Crown,
  KeyRound, Package, ShoppingBag, MessageSquareWarning, Lock, Phone, Mail, MapPin, Loader2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { BUSINESS } from '@/lib/business';

interface RefundRule {
  min_days_before: number;
  refund_percent: number;
  label: string;
}

interface ContractRow {
  audience: string;
  title: string;
  body: string;
  version: number;
}

const SECTIONS = [
  { id: 'booking', label: 'Booking & payment', icon: IndianRupee },
  { id: 'cancellation', label: 'Cancellation & refund', icon: CalendarX2 },
  { id: 'reschedule', label: 'Changing the date', icon: CalendarClock },
  { id: 'artist', label: 'Your artist', icon: Crown },
  { id: 'event-day', label: 'On the day', icon: KeyRound },
  { id: 'rental', label: 'Rentals', icon: Package },
  { id: 'shop', label: 'Shop orders', icon: ShoppingBag },
  { id: 'complaints', label: 'Complaints', icon: MessageSquareWarning },
  { id: 'privacy', label: 'Your data', icon: Lock },
  { id: 'terms', label: 'Full terms', icon: ScrollText },
];

/**
 * The policies, read live from the same tables that enforce them.
 *
 * A hand-written policy page drifts the moment an admin edits a refund rule,
 * and then the published promise and the enforced rule disagree — which is
 * the worst possible way to lose an argument with a customer. Every number
 * below is fetched, not typed.
 */
export default function PoliciesPage() {
  const [rules, setRules] = useState<RefundRule[]>([]);
  const [settings, setSettings] = useState<Record<string, number>>({});
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from('refund_rules').select('min_days_before, refund_percent, label')
        .eq('active', true).order('min_days_before', { ascending: false }),
      supabase.from('app_settings').select('key, value'),
      supabase.from('contracts').select('audience, title, body, version').eq('active', true),
    ]).then(([r, s, c]) => {
      setRules((r.data as RefundRule[]) ?? []);
      setSettings(Object.fromEntries(((s.data ?? []) as { key: string; value: number }[])
        .map((row) => [row.key, Number(row.value)])));
      setContracts((c.data as ContractRow[]) ?? []);
      setLoading(false);
    });
  }, []);

  const pct = (key: string, fallback: number) =>
    Math.round((settings[key] ?? fallback) * (settings[key] !== undefined && settings[key] <= 1 ? 100 : 1));
  const num = (key: string, fallback: number) => settings[key] ?? fallback;

  const advance = pct('advance_rate', 0.5);
  const platform = pct('platform_charge_rate', 0.2);

  return (
    <div className="min-h-screen bg-[#FDF6EC] text-maroon-950">
      <header className="sticky top-0 z-40 bg-maroon-950 text-white shadow-lg">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-20">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 shrink-0">
              <Image src="/logo.png" alt="SafaKing" width={40} height={40} className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="font-display font-black text-lg text-royal-100 uppercase tracking-widest leading-none">
                Policies
              </h1>
              <p className="text-[10px] text-royal-200/60 uppercase tracking-widest mt-1">
                What we promise, and what we ask
              </p>
            </div>
          </Link>
          <Link href="/" className="flex items-center gap-1.5 text-xs font-bold text-royal-200/70 hover:text-royal-300 uppercase tracking-wider">
            <ArrowLeft size={14} /> Home
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-32 sm:pb-16 space-y-10">
        <p className="text-sm text-gray-700 leading-relaxed max-w-2xl">
          These are the rules our system actually applies — the refund ladder, advance and change
          windows below are read live from the same settings that run every booking, so what you
          read here is what will happen. Last loaded {new Date().toLocaleDateString('en-IN', {
            day: 'numeric', month: 'long', year: 'numeric',
          })}.
        </p>

        {/* Jump links */}
        <nav className="flex flex-wrap gap-2">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`}
              className="px-3.5 py-2 rounded-xl bg-white border border-amber-200/70 hover:border-royal-300 text-[11px] font-bold text-maroon-900 flex items-center gap-1.5 transition-colors">
              <s.icon size={13} className="text-royal-600" /> {s.label}
            </a>
          ))}
        </nav>

        {loading ? (
          <div className="py-16 text-center">
            <Loader2 size={24} className="animate-spin mx-auto mb-2 text-amber-500" />
            <p className="text-xs font-bold text-gray-600">Loading the current rules…</p>
          </div>
        ) : (
          <>
            <Section id="booking" icon={IndianRupee} title="Booking & payment">
              <ul>
                <li>
                  A booking is confirmed once the advance is received. The advance is{' '}
                  <b>{advance}% of the total</b>; the balance is paid to your artist at the event.
                </li>
                <li>
                  Groom safa purchases take a <b>{num('groom_safa_advance_percent', 25)}% advance</b>.
                </li>
                <li>
                  On marketplace enquiries, the price you see is the artist&apos;s own rate plus a{' '}
                  <b>{platform}% SafaKing charge</b>. That charge is added on top — your artist
                  receives their full quoted rate, nothing is deducted from them.
                </li>
                <li>
                  Every amount is shown in full before you confirm: total, advance and balance.
                  We do not add anything at the venue that was not on the booking.
                </li>
              </ul>
            </Section>

            <Section id="cancellation" icon={CalendarX2} title="Cancellation & refund">
              <p className="mb-4">
                How much of the <b>advance</b> comes back depends on how much notice we get — an
                artist who has held your date has turned other work away for it.
              </p>
              <div className="overflow-x-auto rounded-2xl border border-amber-200/70">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-royal-50 border-b-2 border-royal-200">
                    <tr>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-maroon-900/70">Notice given</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-maroon-900/70 text-right">Advance refunded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rules.map((r, i) => (
                      <tr key={r.min_days_before} className={i % 2 ? 'bg-amber-50/30' : 'bg-white'}>
                        <td className="px-4 py-3 text-[13px] text-gray-800">{r.label}</td>
                        <td className={`px-4 py-3 text-[15px] font-black tabular-nums text-right ${
                          r.refund_percent >= 100 ? 'text-emerald-700'
                          : r.refund_percent > 0 ? 'text-amber-700' : 'text-rose-700'
                        }`}>
                          {r.refund_percent}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="mt-4">
                <li>Refunds reach the original payment method, usually within 5–7 working days of approval.</li>
                <li>
                  If <b>we</b> cannot serve a confirmed booking — no artist available, or a
                  replacement cannot reach you — you get <b>100% back</b> regardless of the
                  notice period above.
                </li>
                <li>To cancel, call us on {BUSINESS.phone} or raise it from <b>My Bookings</b>.</li>
              </ul>
            </Section>

            <Section id="reschedule" icon={CalendarClock} title="Changing the date or time">
              <ul>
                <li>
                  A <b>date change is free</b> if asked at least{' '}
                  <b>{num('customer_date_change_free_days', 3)} days</b> before the event, subject
                  to an artist being free on the new date.
                </li>
                <li>
                  A <b>time change on the same day</b> is free if asked at least{' '}
                  <b>{num('customer_time_change_free_days', 1)} day</b> before.
                </li>
                <li>
                  Later than that, we will still try — but if the artist has taken other work for the
                  new slot, the change may not be possible and the cancellation ladder above applies.
                </li>
              </ul>
            </Section>

            <Section id="artist" icon={Crown} title="Your artist">
              <ul>
                <li>
                  Every artist we send has had their <b>Aadhaar and photo verified</b> by us. An
                  artist whose documents are not approved cannot be assigned to any booking — this
                  is enforced by the system, not by memory.
                </li>
                <li>
                  <b>We do not tell you which artist is coming in advance.</b> An artist accepting a
                  job is not final — SafaKing signs off on every assignment and may change the
                  artist if something goes wrong. Naming one early would only mislead you. You will
                  see &ldquo;Confirmed — artist booked&rdquo; in My Bookings once that sign-off is done.
                </li>
                <li>
                  If your artist cannot make it, we assign a replacement of equal standing at no
                  extra cost. If no replacement can reach you in time, the booking is cancelled with
                  a full refund.
                </li>
                <li>
                  Artists are instructed never to take payment directly from you beyond the balance
                  shown on your booking. If anyone asks for more, tell us.
                </li>
                <li>
                  An artist who reaches you through SafaKing is <b>not allowed to take a booking from
                  you directly</b> — for this event or any future one. If an artist offers to, please
                  tell us. Booking through SafaKing is also what keeps your refund, replacement and
                  complaint protections in place; a private arrangement has none of them.
                </li>
              </ul>
            </Section>

            <Section id="event-day" icon={KeyRound} title="On the day">
              <ul>
                <li>
                  Your artist aims to arrive about{' '}
                  <b>{num('checkin_expected_minutes', 60)} minutes</b> before the event starts.
                </li>
                <li>
                  You get two 6-digit codes in <b>My Bookings</b>. Read the{' '}
                  <b>arrival code</b> to your artist when they reach you, and the{' '}
                  <b>completion code</b> once the work is done and you are happy. Do not share
                  either before that — they are what proves the job happened.
                </li>
                <li>
                  Once your artist sets off you can watch how far away they are on a live map.
                  Tracking depends on their phone, so it can pause; the booking is unaffected.
                </li>
                <li>
                  Your artist is not paid until the completion code is verified and our team has
                  reviewed the job.
                </li>
              </ul>
            </Section>

            <Section id="rental" icon={Package} title="Rentals">
              <ul>
                <li>
                  Rentals run from <b>{num('min_rent_days', 1)}</b> to{' '}
                  <b>{num('max_rent_days', 30)} days</b>. We keep{' '}
                  <b>{num('rental_buffer_days', 1)} day</b> between bookings for cleaning and
                  checking, so availability reflects that.
                </li>
                <li>
                  A <b>refundable deposit</b> is taken with every rental and returned in full once
                  the safas come back in the condition they went out.
                </li>
                <li>
                  Normal wear is expected and never charged. Damage that puts a safa out of service —
                  tears, burns, permanent staining — or a safa not returned, is deducted from the
                  deposit at its replacement value, and we will show you the item and the amount.
                </li>
                <li>Late returns may be charged for the extra days at the daily rate.</li>
              </ul>
            </Section>

            <Section id="shop" icon={ShoppingBag} title="Shop orders & returns">
              <ul>
                <li>
                  Unused items in original condition can be returned within <b>7 days</b> of
                  delivery. A return postal charge of{' '}
                  <b>{num('postal_return_charge_percent', 10)}%</b> of the item value applies unless
                  the item arrived damaged or was the wrong item — then we bear it.
                </li>
                <li>
                  Safas tied, worn, or altered cannot be returned, and neither can custom-made or
                  personalised pieces.
                </li>
                <li>
                  Colour on a screen is never exact. A small variation from the photograph is not a
                  defect; a clearly different colour or fabric is, and we will replace it.
                </li>
              </ul>
            </Section>

            <Section id="complaints" icon={MessageSquareWarning} title="Complaints">
              <ul>
                <li>
                  Raise a complaint from <b>My Bookings → Report a problem</b>, or call{' '}
                  {BUSINESS.phone}. It reaches our team directly, not a queue.
                </li>
                <li>
                  We ask the artist for their side, and you see their answer. A complaint our
                  manager cannot settle goes to the owner, who has the final word.
                </li>
                <li>
                  A rating and a complaint are different things. Your rating is public and permanent;
                  a complaint is a conversation with us. You never have to choose between being
                  heard and being fair.
                </li>
              </ul>
            </Section>

            <Section id="privacy" icon={Lock} title="Your data">
              <ul>
                <li>
                  We collect what a booking needs: name, phone, event date, venue address, and — only
                  if you choose to share it — your exact location so your artist reaches the right gate.
                </li>
                <li>
                  Your phone and address are shared with the artist assigned to your event, and with
                  nobody else. We do not sell or rent customer data.
                </li>
                <li>
                  Identity documents artists upload are stored privately and are visible only to our
                  verification team. Of an Aadhaar number, we keep only the last four digits.
                </li>
                <li>
                  Payment card details never reach our servers — they are handled by the payment
                  gateway.
                </li>
                <li>
                  Want your account or data removed? Write to {BUSINESS.email} and we will do it,
                  keeping only what tax law requires us to keep.
                </li>
              </ul>
            </Section>

            <Section id="terms" icon={ScrollText} title="Full terms">
              <p className="mb-4">
                These are the agreements you accept when you book, and that our artists accept when
                they join. They are shown in full at the moment of booking, and recorded against it.
              </p>
              <div className="space-y-3">
                {contracts.length === 0 ? (
                  <p className="text-sm text-gray-500">No contract text is published yet.</p>
                ) : contracts.map((c) => (
                  <details key={c.audience} className="rounded-2xl bg-white border border-amber-200/70 overflow-hidden">
                    <summary className="px-5 py-4 cursor-pointer font-bold text-sm text-maroon-950 hover:bg-amber-50/50">
                      {c.title}
                      <span className="font-normal text-gray-400 text-xs"> · version {c.version}</span>
                    </summary>
                    <p className="px-5 pb-5 text-[13px] text-gray-700 leading-relaxed whitespace-pre-wrap border-t border-amber-100 pt-4">
                      {c.body}
                    </p>
                  </details>
                ))}
              </div>
            </Section>

            <section className="rounded-3xl bg-maroon-950 text-royal-100 p-7">
              <h2 className="font-display font-black text-xl text-royal-100">Still unsure about something?</h2>
              <p className="text-sm text-royal-200/70 mt-1 mb-5 max-w-xl leading-relaxed">
                Ask before you book, not after. We would rather explain a rule than argue about it
                later.
              </p>
              <div className="grid sm:grid-cols-3 gap-3 text-xs">
                <a href={`tel:${BUSINESS.phoneDigits}`} className="flex items-center gap-2 p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors">
                  <Phone size={15} className="text-royal-400 shrink-0" /> {BUSINESS.phone}
                </a>
                <a href={`mailto:${BUSINESS.email}`} className="flex items-center gap-2 p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors">
                  <Mail size={15} className="text-royal-400 shrink-0" /> {BUSINESS.email}
                </a>
                <p className="flex items-start gap-2 p-3.5 rounded-2xl bg-white/5">
                  <MapPin size={15} className="text-royal-400 shrink-0 mt-0.5" /> {BUSINESS.address}
                </p>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function Section({ id, icon: Icon, title, children }: {
  id: string;
  icon: typeof ScrollText;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="flex items-center gap-3 mb-4">
        <span className="w-9 h-9 rounded-xl bg-maroon-950 text-royal-300 flex items-center justify-center shrink-0">
          <Icon size={17} />
        </span>
        <h2 className="font-display font-black text-xl text-maroon-950">{title}</h2>
        <span className="flex-1 h-px bg-gradient-to-r from-royal-300 to-transparent" />
      </div>
      <div className="policy-body text-[14.5px] text-gray-700 leading-relaxed space-y-3 [&_ul]:space-y-2.5 [&_li]:pl-5 [&_li]:relative [&_li]:before:content-['·'] [&_li]:before:absolute [&_li]:before:left-1 [&_li]:before:text-royal-500 [&_li]:before:font-black [&_b]:text-maroon-950">
        {children}
      </div>
    </section>
  );
}
