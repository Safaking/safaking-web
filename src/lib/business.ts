/**
 * How to reach SafaKing — the single source of truth.
 *
 * The phone number previously existed as three different literals across the
 * footer, the academy page and the WhatsApp fallback, two of which were stale
 * placeholders. Anything that shows a contact detail should import it from here
 * so they cannot drift apart again.
 *
 * For the business name, address and GSTIN printed on invoices and other
 * documents, see the `business_profile` table — those are admin-editable at
 * runtime, whereas these are the values baked into the marketing pages.
 */
export const BUSINESS = {
  name: 'SafaKing Royal Turban House',

  /** Display form, with spacing for readability. */
  phone: '+91 90013 47143',
  /** Digits only, for tel: and wa.me links. */
  phoneDigits: '919001347143',

  email: 'safakingn111@gmail.com',
  address: 'Near Pandya Memorial School, Char Khamba, Partapur, Dist. Banswara, Rajasthan 327024',
  /** Secondary contact number. */
  phoneAlt: '+91 76918 56577',
  hours: 'Monday to Saturday, 10 AM – 8 PM',
} as const;

/** `tel:` href for the business number. */
export const telHref = `tel:+${BUSINESS.phoneDigits}`;

/** `mailto:` href for the business inbox. */
export const mailtoHref = `mailto:${BUSINESS.email}`;
