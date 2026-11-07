'use client';

import { useEffect, useState, useTransition } from 'react';
import WriteUpEditor from '@/components/WriteUpEditor';
import { saveDrafts, publishWriteUp } from '@/lib/editor-actions';
import { toPlainText } from '@/lib/richtext';

export type EditorItem = { id: string; title: string; published: string | null; publishedAt: string | null; draft: string | null; draftAt: string | null };

type Entry = { published: string | null; publishedAt: string | null; saved: string; draftAt: string | null; current: string };

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

// Every write-up for one week on a single board. "Save all drafts" keeps every change without
// putting it on the site; each write-up's Publish puts that one live. Nothing reloads the page, so
// edits in progress elsewhere on the board are never lost, and leaving with unsaved changes asks
// first.
export default function EditorBoard({ gw, items }: { gw: number; items: EditorItem[] }) {
  const [entries, setEntries] = useState<Record<string, Entry>>(() => Object.fromEntries(items.map(i => [i.id, {
    published: i.published, publishedAt: i.publishedAt, draftAt: i.draftAt,
    saved: i.draft ?? i.published ?? '', current: i.draft ?? i.published ?? '',
  }])));
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, startTransition] = useTransition();
  const [publishing, setPublishing] = useState<string | null>(null);

  const unsaved = items.filter(i => entries[i.id].current !== entries[i.id].saved);

  useEffect(() => {
    if (unsaved.length === 0) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsaved.length]);

  const update = (id: string, change: Partial<Entry>) => setEntries(prev => ({ ...prev, [id]: { ...prev[id], ...change } }));

  const saveAll = () => startTransition(async () => {
    const changed = unsaved.map(i => ({ id: i.id, content: entries[i.id].current }));
    const published = Object.fromEntries(items.map(i => [i.id, entries[i.id].published ?? '']));
    const result = await saveDrafts(gw, changed, published);
    if (!result.ok) { setMessage({ text: `Not saved: ${result.error}`, error: true }); return; }
    changed.forEach(c => update(c.id, { saved: c.content, draftAt: result.at ?? null }));
    setMessage({ text: `Saved ${changed.length} draft${changed.length === 1 ? '' : 's'} at ${when(result.at ?? null)}` });
  });

  const publish = (item: EditorItem) => {
    setPublishing(item.id);
    startTransition(async () => {
      const content = entries[item.id].current;
      const result = await publishWriteUp(gw, item.id, item.title, content);
      setPublishing(null);
      if (!result.ok) { setMessage({ text: `${item.title} not published: ${result.error}`, error: true }); return; }
      update(item.id, { published: content, publishedAt: result.at ?? null, saved: content, draftAt: null });
      setMessage({ text: `${item.title} published` });
    });
  };

  return (
    <div>
      <div className="sticky top-0 z-20 -mx-2 px-2 py-3 mb-6 bg-bg/95 backdrop-blur border-b border-line flex flex-wrap items-center gap-x-4 gap-y-2">
        <button type="button" onClick={saveAll} disabled={busy || unsaved.length === 0}
          className="bg-panel text-white py-2 px-4 rounded-lg font-semibold hover:bg-surface-2 transition disabled:opacity-40 disabled:cursor-not-allowed">
          Save all drafts
        </button>
        <span className="text-sm text-dim">
          {unsaved.length > 0 ? <span className="text-live-2 font-semibold">{unsaved.length} write-up{unsaved.length === 1 ? '' : 's'} with unsaved changes</span> : 'Everything is saved'}
        </span>
        {message && <span className={`text-sm ${message.error ? 'text-loss-2' : 'text-win-2'}`}>{message.text}</span>}
        <p className="w-full text-xs text-faint">Drafts are kept but not shown on the site. Publish a write-up to put it live.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {items.map(item => {
          const e = entries[item.id];
          const dirty = e.current !== e.saved;
          const draftPending = !dirty && e.saved !== (e.published ?? '') && !!e.draftAt;
          const status = dirty ? { text: 'Unsaved changes', cls: 'text-live-2' }
            : draftPending ? { text: `Draft saved ${when(e.draftAt)} · not published`, cls: 'text-brand-2' }
            : e.published ? { text: `Published ${when(e.publishedAt)}`, cls: 'text-win-2' }
            : { text: 'Not written yet', cls: 'text-faint' };
          const empty = !toPlainText(e.current).trim();
          const upToDate = e.current === (e.published ?? '');
          return (
            <div key={item.id} className="bg-surface p-6 rounded-xl border flex flex-col">
              <div className="flex items-baseline justify-between gap-3 mb-4">
                <h2 className="text-lg font-bold text-ink">{item.title}</h2>
                <span className={`text-xs font-semibold text-right ${status.cls}`}>{status.text}</span>
              </div>
              <WriteUpEditor name={`content-${item.id}`} initialHtml={item.draft ?? item.published ?? ''} placeholder={`Write the summary for Gameweek ${gw}...`}
                onChange={html => update(item.id, { current: html })} />
              <button type="button" onClick={() => publish(item)} disabled={busy || empty || upToDate}
                className="mt-3 bg-brand text-white py-2 px-4 rounded-lg font-semibold hover:bg-brand/85 transition disabled:opacity-40 disabled:cursor-not-allowed">
                {publishing === item.id ? 'Publishing…' : upToDate && e.published ? 'Published' : `Publish GW${gw} write-up`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
