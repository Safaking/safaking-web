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
 * Switched off while the app goes through the Play Store. Turning it back on
 * is this one line, plus the tracker files, which are not kept in git because
 * they are 15 MB and unused while this is off:
 *
 *   mkdir -p public/mediapipe/wasm
 *   curl -L -o public/mediapipe/face_landmarker.task \
 *     https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
 *   cp node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.{js,wasm} public/mediapipe/wasm/
 *
 * Without those files the mirror still works — the safa is placed by hand
 * instead of following the head.
 */
export const VIRTUAL_TRYON_ENABLED = false;
