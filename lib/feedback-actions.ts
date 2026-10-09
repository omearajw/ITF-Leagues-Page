'use server';

import { createAdminClient } from '@/utils/supabase/admin';
import { FEEDBACK_KINDS, type FeedbackState } from '@/lib/feedback';

const KINDS = new Set<string>(FEEDBACK_KINDS.map(k => k.key));
const field = (value: FormDataEntryValue | null, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

export async function submitFeedback(_previous: FeedbackState, formData: FormData): Promise<FeedbackState> {
  // A field people never see: bots fill it in, so pretend it worked and store nothing.
  if (field(formData.get('website'), 200)) return { ok: true };

  const kind = field(formData.get('kind'), 40);
  const details = field(formData.get('details'), 4000);
  const email = field(formData.get('email'), 200);
  const rating = Number(formData.get('rating'));
  const managerName = field(formData.get('manager_name'), 120);
  const values = { kind, details, email, manager_name: managerName, rating: String(formData.get('rating') ?? '') };
  if (!KINDS.has(kind)) return { error: 'Pick what it’s about.', values };
  if (!details) return { error: 'Add a few words about it.', values };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'That email address doesn’t look right.', values };

  const { error } = await createAdminClient().from('feedback').insert({
    manager_name: managerName || null,
    email: email || null,
    kind,
    rating: Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null,
    details,
    page: field(formData.get('page'), 300) || null,
  });
  if (error) {
    console.error('Feedback insert failed:', error.message);
    return { error: 'Sorry, that didn’t send. Please try again in a minute.', values };
  }
  return { ok: true };
}
