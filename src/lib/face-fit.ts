'use client';

/**
 * Finds the head in the camera picture so the safa can sit on it by itself.
 *
 * Google's MediaPipe face landmarker runs entirely on the phone — nothing is
 * uploaded, it costs nothing to run, and it works in the app and the browser
 * alike. The model and its runtime are served from our own domain
 * (public/mediapipe), so no third-party CDN is involved.
 *
 * It is always optional: if the model cannot load — an old WebView, a slow
 * connection — the mirror stays on manual placement and nobody sees an error.
 */

import type { FaceLandmarker, NormalizedLandmark } from '@mediapipe/tasks-vision';

/** Points on MediaPipe's face mesh that describe where a turban goes. */
const FOREHEAD_TOP = 10;
const CHIN = 152;
const LEFT_EYE_OUTER = 33;
const RIGHT_EYE_OUTER = 263;
const LEFT_CHEEK = 234;
const RIGHT_CHEEK = 454;

/** One reading of the head, in the picture's own pixels. */
export interface FaceReading {
  foreheadX: number;
  foreheadY: number;
  faceWidthPx: number;
  faceHeightPx: number;
  /** Head tilt in degrees, clockwise. */
  rotationDeg: number;
  sourceWidth: number;
  sourceHeight: number;
}

export interface FaceTracker {
  /** A live camera frame. Returns null when no face is in view. */
  readVideo(video: HTMLVideoElement, timestampMs: number): FaceReading | null;
  /** A still photo. Switching the model to still-image mode takes a moment. */
  readImage(image: HTMLImageElement): Promise<FaceReading | null>;
  close(): void;
}

let loading: Promise<FaceTracker | null> | null = null;

/**
 * Loads the tracker once and shares it. Returns null — never throws — when the
 * model is unavailable, so the caller simply stays on manual placement.
 */
export function loadFaceTracker(): Promise<FaceTracker | null> {
  if (!loading) loading = create().catch(() => null);
  return loading;
}

async function create(): Promise<FaceTracker | null> {
  const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
  const fileset = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
  const open = (delegate: 'GPU' | 'CPU') =>
    FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: '/mediapipe/face_landmarker.task', delegate },
      runningMode: 'VIDEO',
      numFaces: 1,
    });
  // The graphics card does this far faster, but some WebViews have no WebGL2.
  const landmarker = await open('GPU').catch(() => open('CPU'));

  let mode: 'VIDEO' | 'IMAGE' = 'VIDEO';
  const setMode = async (next: 'VIDEO' | 'IMAGE') => {
    if (mode === next) return;
    await landmarker.setOptions({ runningMode: next });
    mode = next;
  };

  return {
    readVideo(video, timestampMs) {
      if (mode !== 'VIDEO' || !video.videoWidth) return null;
      const result = landmarker.detectForVideo(video, timestampMs);
      return toReading(result?.faceLandmarks?.[0], video.videoWidth, video.videoHeight);
    },
    async readImage(image) {
      if (!image.naturalWidth) return null;
      await setMode('IMAGE');
      const result = (landmarker as FaceLandmarker).detect(image);
      return toReading(result?.faceLandmarks?.[0], image.naturalWidth, image.naturalHeight);
    },
    close() {
      landmarker.close();
      loading = null;
    },
  };
}

function toReading(
  landmarks: NormalizedLandmark[] | undefined,
  width: number,
  height: number
): FaceReading | null {
  if (!landmarks || landmarks.length < RIGHT_CHEEK) return null;
  const at = (index: number) => ({ x: landmarks[index].x * width, y: landmarks[index].y * height });

  const forehead = at(FOREHEAD_TOP);
  const chin = at(CHIN);
  const leftEye = at(LEFT_EYE_OUTER);
  const rightEye = at(RIGHT_EYE_OUTER);
  const leftCheek = at(LEFT_CHEEK);
  const rightCheek = at(RIGHT_CHEEK);

  const span = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

  return {
    foreheadX: forehead.x,
    foreheadY: forehead.y,
    faceWidthPx: span(leftCheek, rightCheek),
    faceHeightPx: span(forehead, chin),
    // The line between the eyes says which way the head is tilted.
    rotationDeg: (Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * 180) / Math.PI,
    sourceWidth: width,
    sourceHeight: height,
  };
}

/** Where the safa sits, in fractions of the stage — the shape the mirror uses. */
export interface StageFit {
  x: number;
  y: number;
  width: number;
  rotation: number;
}

/** A safa is wider than the head it sits on. */
const SAFA_TO_FACE_WIDTH = 1.78;
/** It comes down over the top of the forehead rather than balancing above it. */
const FOREHEAD_OVERLAP = 0.14;

/**
 * Turns a reading into a place on the stage, allowing for the picture being
 * cropped to fill (CSS object-cover) and, for the camera, mirrored.
 */
export function readingToFit(
  reading: FaceReading,
  stage: { width: number; height: number },
  safaAspect: number,
  mirrored: boolean
): StageFit | null {
  if (!stage.width || !stage.height || !reading.faceWidthPx) return null;

  const safaWidthPx = reading.faceWidthPx * SAFA_TO_FACE_WIDTH;
  const safaHeightPx = safaWidthPx * safaAspect;

  // Straight up from the head, whichever way it is tilted.
  const radians = (reading.rotationDeg * Math.PI) / 180;
  const upX = Math.sin(radians);
  const upY = -Math.cos(radians);
  const lift = safaHeightPx / 2 - reading.faceHeightPx * FOREHEAD_OVERLAP;

  const centreX = reading.foreheadX + upX * lift;
  const centreY = reading.foreheadY + upY * lift;

  // Same crop the stage shows: fill it, centre the overflow.
  const cover = Math.max(stage.width / reading.sourceWidth, stage.height / reading.sourceHeight);
  const drawWidth = reading.sourceWidth * cover;
  const drawHeight = reading.sourceHeight * cover;
  const offsetX = (stage.width - drawWidth) / 2;
  const offsetY = (stage.height - drawHeight) / 2;

  const x = (offsetX + centreX * cover) / stage.width;
  const y = (offsetY + centreY * cover) / stage.height;

  return {
    x: mirrored ? 1 - x : x,
    y,
    width: (safaWidthPx * cover) / stage.width,
    rotation: mirrored ? -reading.rotationDeg : reading.rotationDeg,
  };
}

/** Eases towards a new reading so the safa does not jitter frame to frame. */
export function smoothFit(previous: StageFit | null, next: StageFit, ease = 0.35): StageFit {
  if (!previous) return next;
  const blend = (from: number, to: number) => from + (to - from) * ease;
  return {
    x: blend(previous.x, next.x),
    y: blend(previous.y, next.y),
    width: blend(previous.width, next.width),
    rotation: blend(previous.rotation, next.rotation),
  };
}
