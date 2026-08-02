'use client';

import { supabase } from '@/lib/supabase';

/**
 * Verification document handling.
 *
 * PII rule enforced here, not just documented: full Aadhaar and full bank
 * account numbers are never sent to the database. `lastFourOf` is the only way
 * a number reaches a column, and it keeps four digits.
 */

export const VERIFICATION_BUCKET = 'verification-docs';

export type SubjectType = 'artist' | 'supplier';
export type DocReviewState = 'pending' | 'approved' | 'rejected';
export type VerificationState = 'unverified' | 'pending' | 'verified' | 'rejected';

export type DocType =
  | 'aadhaar_front' | 'aadhaar_back' | 'selfie' | 'certificate' | 'experience_proof'
  | 'gst_certificate' | 'shop_photo' | 'bank_proof' | 'pan';

export interface DocSpec {
  type: DocType;
  label: string;
  hint: string;
  required: boolean;
  /** Asks for the last 4 digits alongside the upload. */
  wantsReference?: boolean;
}

export const ARTIST_DOCS: DocSpec[] = [
  {
    type: 'aadhaar_front', label: 'Aadhaar (front)', required: true, wantsReference: true,
    hint: 'Photo of the front. We store only the last 4 digits — never the full number.',
  },
  {
    type: 'aadhaar_back', label: 'Aadhaar (back)', required: false,
    hint: 'Optional, but speeds up approval.',
  },
  {
    type: 'selfie', label: 'Selfie', required: true,
    hint: 'A clear photo of your face, to match against your Aadhaar.',
  },
  {
    type: 'certificate', label: 'Safa tying certificate', required: true,
    hint: 'SafaKing Academy or any recognised training certificate.',
  },
  {
    type: 'experience_proof', label: 'Experience proof', required: false,
    hint: 'Event photos, client letters, or anything showing past work.',
  },
];

export const SUPPLIER_DOCS: DocSpec[] = [
  {
    type: 'shop_photo', label: 'Shop photo', required: true,
    hint: 'Outside of your shop or workshop, with the name board visible.',
  },
  {
    type: 'bank_proof', label: 'Bank proof', required: true, wantsReference: true,
    hint: 'Cancelled cheque or passbook page. We store only the last 4 digits.',
  },
  {
    type: 'gst_certificate', label: 'GST certificate', required: false,
    hint: 'Only if your business is GST registered.',
  },
  { type: 'pan', label: 'PAN card', required: false, hint: 'Optional, helps with payouts.' },
];

export interface VerificationDocument {
  id: string;
  owner_id: string;
  subject_type: SubjectType;
  doc_type: DocType;
  storage_path: string;
  original_name: string | null;
  reference_last4: string | null;
  status: DocReviewState;
  rejection_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
}

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

/**
 * Reduces any identifier to its last four digits.
 * This is the ONLY value permitted to reach the database.
 */
export function lastFourOf(value: string): string | null {
  const digits = (value ?? '').replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-4) : null;
}

/** Basic Aadhaar shape check — 12 digits. Does not validate the checksum. */
export function looksLikeAadhaar(value: string): boolean {
  return (value ?? '').replace(/\D/g, '').length === 12;
}

export function describeError(error: unknown): string {
  const err = error as { message?: string; statusCode?: string } | null;
  if (!err) return 'Upload failed. Please try again.';
  if (err.message?.includes('Bucket not found')) {
    return 'Document storage is not set up yet — run supabase/006_verification.sql.';
  }
  if (err.message?.includes('row-level security') || err.statusCode === '403') {
    return 'You do not have permission to upload this document. Try signing in again.';
  }
  return err.message ?? 'Upload failed. Please try again.';
}

export async function listMyDocuments(ownerId: string): Promise<VerificationDocument[]> {
  const { data, error } = await supabase
    .from('verification_documents')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(describeError(error));
  return (data as VerificationDocument[]) ?? [];
}

/**
 * Uploads one document and records it.
 *
 * @param referenceNumber Full Aadhaar / account number, if the spec asks for it.
 *                        Only its last four digits are persisted.
 */
export async function uploadDocument(params: {
  ownerId: string;
  subjectType: SubjectType;
  docType: DocType;
  file: File;
  referenceNumber?: string;
}): Promise<VerificationDocument> {
  const { ownerId, subjectType, docType, file, referenceNumber } = params;

  if (file.size > MAX_BYTES) {
    throw new Error('That file is larger than 5 MB. Please upload a smaller photo.');
  }
  if (!ALLOWED.includes(file.type)) {
    throw new Error('Upload a JPG, PNG, WEBP or PDF.');
  }

  const extension = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  // First path segment must be the owner id — the storage policy checks it.
  const path = `${ownerId}/${docType}-${Date.now()}.${extension}`;

  const { error: uploadErr } = await supabase.storage
    .from(VERIFICATION_BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type });

  if (uploadErr) throw new Error(describeError(uploadErr));

  // Replace any previous attempt at this document type so the unique index
  // (one live document per type) does not reject the new upload.
  await supabase
    .from('verification_documents')
    .delete()
    .eq('owner_id', ownerId)
    .eq('doc_type', docType)
    .neq('status', 'rejected');

  const { data, error } = await supabase
    .from('verification_documents')
    .insert({
      owner_id: ownerId,
      subject_type: subjectType,
      doc_type: docType,
      storage_path: path,
      original_name: file.name,
      // Never the full number.
      reference_last4: referenceNumber ? lastFourOf(referenceNumber) : null,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    // Do not leave an orphaned file behind if the row failed.
    await supabase.storage.from(VERIFICATION_BUCKET).remove([path]);
    throw new Error(describeError(error));
  }

  return data as VerificationDocument;
}

/** Short-lived URL for viewing a private document. */
export async function signedUrlFor(storagePath: string, seconds = 300): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(VERIFICATION_BUCKET)
    .createSignedUrl(storagePath, seconds);

  if (error) return null;
  return data?.signedUrl ?? null;
}
