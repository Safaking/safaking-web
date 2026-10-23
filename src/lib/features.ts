/**
 * Features that can be switched off without removing their code.
 *
 * Flip a flag, and everything that opens the feature disappears from the site
 * and the app. The code, and any database tables behind it, stay as they are.
 */

/**
 * The virtual safa mirror — the camera try-on, the "Meet SafaKing" section on
 * the home page and the hero button that opens it.
 *
 * It now places the safa as a curved surface that turns with the head and
 * disappears behind it in profile (src/lib/safa-ar.ts), with the tracking
 * model and its runtime served from public/mediapipe — our own domain, so
 * nothing about a customer's face leaves their phone.
 *
 * Off. The mirror never got good enough to put the shop's name next to — it
 * lays a flat safa over a camera picture rather than fitting one to the head,
 * and on an ornate safa that reads as a sticker, not a fitting.
 *
 * Switched off rather than deleted: the head tracking underneath is sound and
 * is where a real try-on would start from, so turning this back on is one
 * line. Everything that opens it follows this flag — the home page section,
 * the hero button, the /try-on page itself, the footer link, the sitemap
 * entry and what the chatbot offers.
 *
 * The Play listing mentions the mirror, so change the listing text and
 * screenshot too.
 */
export const VIRTUAL_TRYON_ENABLED = false;
