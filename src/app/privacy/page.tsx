import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';
import { BUSINESS, telHref, mailtoHref } from '@/lib/business';
import { JsonLd, breadcrumbJsonLd } from '@/lib/seo';

/**
 * The privacy policy, for the SafaKing website and the SafaKing Android app.
 *
 * A server page with every word in the HTML, deliberately. It used to be a
 * section of /policies, which is a client page that fetches its content —
 * so Google Play's reviewer fetched the URL, saw "Loading the current
 * rules…", and rejected the app for not having a privacy policy at all.
 * Nothing here is loaded at runtime: no database, no JavaScript needed.
 *
 * Keep it true. Every claim below is checkable in this repository — the
 * permissions in android/app/src/main/AndroidManifest.xml, the processors in
 * src/lib, and the deletion route in src/app/delete-account.
 */

export const metadata: Metadata = {
  title: 'Privacy policy',
  description:
    'What SafaKing collects, why, who it is shared with, how long it is kept, and how to have it deleted — for the SafaKing website and Android app.',
  alternates: { canonical: '/privacy' },
  robots: { index: true, follow: true },
};

const UPDATED = '12 October 2026';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#FDF6EC] text-maroon-950">
      <JsonLd data={breadcrumbJsonLd([{ name: 'Privacy policy', path: '/privacy' }])} />

      <header className="sk-web-header sticky top-0 z-40 bg-maroon-950 text-white shadow-lg">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-20">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 shrink-0">
              <Image src="/logo.png" alt="SafaKing" width={40} height={40} className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="font-display font-black text-lg text-royal-100 uppercase tracking-widest leading-none">
                Privacy
              </h1>
              <p className="text-[10px] text-royal-200/60 uppercase tracking-widest mt-1">
                What we hold, and why
              </p>
            </div>
          </Link>
          <Link href="/" className="flex items-center gap-1.5 text-xs font-bold text-royal-200/70 hover:text-royal-300 uppercase tracking-wider">
            <ArrowLeft size={14} /> Home
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-32 sm:pb-16 text-[13px] leading-relaxed text-gray-800">
        <p className="text-xs text-gray-500">Last updated {UPDATED}</p>

        <h2 className="mt-6 font-display text-2xl font-black text-maroon-950">Privacy policy</h2>
        <p className="mt-3">
          This policy explains what personal information {BUSINESS.name} (&ldquo;SafaKing&rdquo;,
          &ldquo;we&rdquo;) collects, why we collect it, who we share it with, how long we keep it,
          and how you can have it deleted. It covers the website at www.safaking.in and the SafaKing
          Android app, which are run by the same business.
        </p>
        <p className="mt-3">
          We are at {BUSINESS.address}. You can reach us on{' '}
          <a href={telHref} className="font-bold text-maroon-800 underline">{BUSINESS.phone}</a> or at{' '}
          <a href={mailtoHref} className="font-bold text-maroon-800 underline">{BUSINESS.email}</a>.
        </p>

        <Section title="What we collect">
          <p className="font-bold text-maroon-900">What you give us</p>
          <List items={[
            'Your name, phone number and email address when you create an account or place a booking.',
            'A password, which is stored by our authentication provider as a cryptographic hash — we never see it.',
            'The details of what you book: event date and time, the venue address and pincode, how many safas, sizes, and any notes you add.',
            'The delivery address for a shop order.',
            'Anything you write to us — enquiries, complaints, chat questions, messages about a booking.',
          ]} />

          <p className="mt-4 font-bold text-maroon-900">If you work with us</p>
          <List items={[
            'Artists and suppliers give business details, identity documents for verification (KYC), photographs of their work, and a bank account or UPI id so we can pay them.',
            'Artists who are on a job share their location while they are checking in at a venue, so we can confirm they have arrived. We do not track an artist at any other time.',
          ]} />

          <p className="mt-4 font-bold text-maroon-900">From your device</p>
          <List items={[
            'If you allow notifications in the Android app, we store a notification token for that device so we can send you booking updates. Nothing else about the device is stored with it.',
            'Ordinary server logs, including an IP address, kept briefly to keep the service secure and working.',
          ]} />

          <p className="mt-4 font-bold text-maroon-900">What we do not collect</p>
          <List items={[
            'We use no advertising networks, no analytics services and no tracking pixels of any kind. Nobody is profiled and nothing is sold.',
            'We never see or store your card number, UPI PIN or bank credentials. Payments are taken by Razorpay on their own systems; we receive only a confirmation that a payment succeeded and its reference.',
            'We do not collect your contacts, your messages, your call log, or files on your device.',
          ]} />
        </Section>

        <Section title="The camera and your location">
          <p>
            The app asks for two permissions, and only for these reasons:
          </p>
          <List items={[
            'Camera — so you can take or choose a photograph when one is asked for. A photograph is only sent to us if you deliberately upload one, for example an artist adding work to their portfolio or sending documents for verification.',
            'Location — used by safa artists to check in when they reach a venue, so we can confirm the job started. Customers are never asked for GPS location; a booking needs only the venue address and pincode you type in.',
          ]} />
          <p className="mt-3">
            Both permissions can be refused or withdrawn in Android settings. Refusing the camera
            only turns off photo uploads; everything else continues to work.
          </p>
        </Section>

        <Section title="Why we use it">
          <List items={[
            'To take, confirm and carry out your booking or order, and to assign an artist to it.',
            'To keep you informed — booking confirmations, reminders, dispatch and delivery updates — by app notification, WhatsApp, SMS or email.',
            'To take payment and to issue the invoice and tax records the law requires.',
            'To answer questions and settle complaints.',
            'To keep the service safe: preventing fraud, misuse and abuse.',
          ]} />
          <p className="mt-3">
            We do not use your information to advertise to you, and we do not send marketing you did
            not ask for.
          </p>
        </Section>

        <Section title="Who we share it with">
          <p>
            We do not sell personal information to anybody, ever. We share only what is needed, and
            only with these:
          </p>
          <List items={[
            'The artist assigned to your booking receives your name, phone number and the venue address, because they cannot reach you otherwise.',
            'A supplier fulfilling your shop order receives your name, phone number and delivery address.',
            'Supabase — our database and sign-in provider, which stores the information above on our behalf.',
            'Vercel — which hosts the website and the app’s pages.',
            'Razorpay — which takes payments and holds its own record of them.',
            'Google (Firebase Cloud Messaging) — which delivers app notifications to your device.',
            'Resend — which sends our emails, such as a password reset.',
            'Google (Gemini) — which powers the assistant on our website. Your question is sent to be answered and is not used to train anybody’s model by us; do not type payment details or documents into it.',
            'Government authorities, where the law requires it of us.',
          ]} />
        </Section>

        <Section title="How long we keep it">
          <List items={[
            'Bookings, orders, invoices and payment records are kept for as long as tax and accounting law requires us to keep our books.',
            'Your account details are kept while your account is open.',
            'Notification tokens are removed when you sign out or uninstall the app.',
            'Messages and complaints are kept while they are open and for a reasonable period afterwards, in case the matter is raised again.',
          ]} />
        </Section>

        <Section title="Deleting your account and your data">
          <p>
            You can ask us to delete your account and the personal information in it at any time:
          </p>
          <List items={[
            'In the app: More → Delete my account.',
            'On the website: the Delete Account page at www.safaking.in/delete-account.',
            'Or write to us at ' + BUSINESS.email + ', or send a WhatsApp message to ' + BUSINESS.phone + '.',
          ]} />
          <p className="mt-3">
            When a deletion is completed, your profile, your contact details, your saved addresses,
            your wishlist and your notification tokens are removed, and your sign-in stops working.
            What we must keep is the record of bookings and invoices that tax law obliges us to hold;
            those are kept as accounting records and are not used to contact you again.
          </p>
          <p className="mt-3">
            <Link href="/delete-account" className="font-bold text-maroon-800 underline">
              Go to the deletion page →
            </Link>
          </p>
        </Section>

        <Section title="How we look after it">
          <List items={[
            'Everything travels over an encrypted connection (HTTPS).',
            'Our database enforces row-level security, so one customer’s records cannot be read by another.',
            'Staff see only what their role needs, and staff accounts with access to customer data must pass a second factor at sign-in.',
            'Passwords are stored only as hashes, by our authentication provider.',
          ]} />
          <p className="mt-3">
            No system is perfectly secure, and we will not pretend otherwise. If something does go
            wrong with your information, we will tell you.
          </p>
        </Section>

        <Section title="Children">
          <p>
            SafaKing is for adults arranging weddings and events. The app and the website are not
            directed at children, and we do not knowingly collect information from anybody under 18.
            If you believe a child has given us information, write to us and we will remove it.
          </p>
        </Section>

        <Section title="Your rights">
          <p>
            You can ask us what we hold about you, ask us to correct it, or ask us to delete it.
            Write to <a href={mailtoHref} className="font-bold text-maroon-800 underline">{BUSINESS.email}</a>{' '}
            or call <a href={telHref} className="font-bold text-maroon-800 underline">{BUSINESS.phone}</a>,{' '}
            {BUSINESS.hours.toLowerCase()}. We answer within a few working days.
          </p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            If this policy changes we will update this page and the date at the top. Material changes
            will also be told to you in the app or by email.
          </p>
        </Section>

        <Section title="संक्षेप में — हिंदी">
          <List items={[
            'हम वही जानकारी लेते हैं जो बुकिंग या ऑर्डर पूरा करने के लिए ज़रूरी है — नाम, फ़ोन, ईमेल, कार्यक्रम का पता और पिनकोड।',
            'कोई विज्ञापन कंपनी, कोई ट्रैकिंग, कोई एनालिटिक्स नहीं। आपकी जानकारी कभी बेची नहीं जाती।',
            'कैमरा सिर्फ़ साफा ट्राय-ऑन और आपके द्वारा चुनी गई फ़ोटो के लिए — ट्राय-ऑन की तस्वीर आपके फ़ोन से बाहर नहीं जाती।',
            'लोकेशन सिर्फ़ आर्टिस्ट के वेन्यू पर पहुँचने की पुष्टि के लिए। ग्राहक से GPS नहीं माँगा जाता।',
            'कार्ड या UPI की जानकारी हम देखते ही नहीं — भुगतान Razorpay करता है।',
            'अकाउंट कभी भी डिलीट कर सकते हैं: ऐप में More → Delete my account, या www.safaking.in/delete-account पर। टैक्स के लिए ज़रूरी बिल रिकॉर्ड ही रखे जाते हैं।',
            'कोई सवाल हो तो ' + BUSINESS.phone + ' पर फ़ोन या WhatsApp कीजिए।',
          ]} />
        </Section>

        <p className="mt-10 border-t border-amber-200/70 pt-6 text-xs text-gray-500">
          {BUSINESS.name} · {BUSINESS.address} · {BUSINESS.phone} · {BUSINESS.email}
        </p>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h3 className="font-display text-lg font-black text-maroon-950">{title}</h3>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="mt-2 space-y-2">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-maroon-800/50" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
