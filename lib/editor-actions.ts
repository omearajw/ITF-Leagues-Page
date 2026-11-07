'use server';

import { cookies } from 'next/headers';
import { updateTag } from 'next/cache';
import { createAdminClient } from '@/utils/supabase/admin';
import { SITE_DATA_TAG } from '@/lib/site-cache';
import { toPlainText } from '@/lib/richtext';

// Saving and publishing write-ups. Drafts live in page_content_drafts, which only the server can
// read, so unpublished text never reaches the public site; publishing copies a write-up into
// page_content, which the pages show. Neither reloads the editor, so changes still being typed in
// other write-ups are never lost.

export type DraftInput = { id: string; content: string };
export type ActionResult = { ok: boolean; error?: string; at?: string };

async function isStaff() {
  const role = (await cookies()).get('itf_role')?.value;
  return !!role && (role === process.env.ADMIN_SECRET_TOKEN || role === process.env.EDITOR_SECRET_TOKEN);
}

// Saves every changed write-up as a draft. A write-up whose text now matches what is published
// (or that has been emptied) has its draft removed instead.
export async function saveDrafts(gwNumber: number, drafts: DraftInput[], published: Record<string, string>): Promise<ActionResult> {
  if (!(await isStaff())) return { ok: false, error: 'Not signed in as staff' };
  const db = createAdminClient();
  const at = new Date().toISOString();
  const keep = drafts.filter(d => toPlainText(d.content).trim() && d.content !== (published[d.id] ?? ''));
  const drop = drafts.filter(d => !keep.includes(d));
  if (keep.length) {
    const { error } = await db.from('page_content_drafts').upsert(keep.map(d => ({ id: d.id, gw_number: gwNumber, content: d.content, updated_at: at })), { onConflict: 'id,gw_number' });
    if (error) return { ok: false, error: error.message };
  }
  for (const d of drop) {
    const { error } = await db.from('page_content_drafts').delete().eq('id', d.id).eq('gw_number', gwNumber);
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true, at };
}

// Puts one write-up live and clears its draft.
export async function publishWriteUp(gwNumber: number, id: string, title: string, content: string): Promise<ActionResult> {
  if (!(await isStaff())) return { ok: false, error: 'Not signed in as staff' };
  if (!toPlainText(content).trim()) return { ok: false, error: 'The write-up is empty' };
  const db = createAdminClient();
  const at = new Date().toISOString();
  const { error } = await db.from('page_content').upsert({ id, gw_number: gwNumber, title, content, updated_at: at }, { onConflict: 'id,gw_number' });
  if (error) return { ok: false, error: error.message };
  await db.from('page_content_drafts').delete().eq('id', id).eq('gw_number', gwNumber);
  updateTag(SITE_DATA_TAG);
  return { ok: true, at };
}
