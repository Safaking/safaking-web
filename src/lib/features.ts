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
 * Set this to false to take it off the site in one line; the Play listing
 * mentions the mirror, so change the listing text and screenshot too.
 */
export const VIRTUAL_TRYON_ENABLED = true;
