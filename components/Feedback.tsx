'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { MessageSquare, Star, X } from 'lucide-react';
import { submitFeedback } from '@/lib/feedback-actions';
import { FEEDBACK_KINDS, OPEN_FEEDBACK_EVENT, type FeedbackState } from '@/lib/feedback';

// Anything that opens the form (the footer link, the phone menu item) just announces it, so the
// one dialog lives in the layout and survives the phone menu closing.
export function FeedbackTrigger({ className = '', onClick, children = 'Feedback' }: { className?: string; onClick?: () => void; children?: React.ReactNode }) {
  return (
    <button type="button" className={className} onClick={() => { onClick?.(); window.dispatchEvent(new Event(OPEN_FEEDBACK_EVENT)); }}>
      {children}
    </button>
  );
}

// The navbar's button: an icon with the word, so the banner and ticker can point people to it.
export function FeedbackNavButton() {
  return (
    <FeedbackTrigger className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold text-ink-2 hover:text-white transition px-2 py-1.5 rounded-sm">
      <MessageSquare size={16} aria-hidden="true" />
      Feedback
    </FeedbackTrigger>
  );
}

// A quiet line under a write-up or tool, asking while the reader has an opinion.
export function FeedbackPrompt({ children, className = 'mt-6 pt-3 border-t border-line' }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`text-sm text-dim ${className}`}>
      {children}{' '}
      <FeedbackTrigger className="font-semibold text-brand-2 hover:underline">Send feedback</FeedbackTrigger>
    </p>
  );
}

const BANNER_KEY = 'itf_feedback_banner_seen';

// Shown once per device on the hub, then gone for good once dismissed or used. It only appears
// after mounting (the server can't know whether it has been seen), so it never mismatches.
export function FeedbackBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try { if (!localStorage.getItem(BANNER_KEY)) setShow(true); } catch {}
  }, []);
  if (!show) return null;
  const dismiss = () => {
    setShow(false);
    try { localStorage.setItem(BANNER_KEY, '1'); } catch {}
  };
  return (
    <aside aria-label="Feedback" className="panel flex flex-wrap items-center gap-x-6 gap-y-3">
      <p className="flex-1 min-w-[15rem] text-ink-2">
        <b className="text-ink">The site&apos;s just been rebuilt.</b> Spotted something broken, or got an idea? Tell us.{' '}
        <span className="text-dim">You&apos;ll always find Feedback in the top bar.</span>
      </p>
      <div className="flex items-center gap-2">
        <FeedbackTrigger onClick={dismiss} className="rounded-sm bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/85 whitespace-nowrap">Send feedback</FeedbackTrigger>
        <button type="button" onClick={dismiss} aria-label="Dismiss" className="p-1.5 rounded-sm text-dim hover:text-ink">
          <X size={18} aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}

export function FeedbackDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  // A new key each time it opens, so a second message starts from a blank form.
  const [session, setSession] = useState(0);

  useEffect(() => {
    const open = () => { setSession(s => s + 1); dialog.current?.showModal(); };
    window.addEventListener(OPEN_FEEDBACK_EVENT, open);
    return () => window.removeEventListener(OPEN_FEEDBACK_EVENT, open);
  }, []);

  const close = () => dialog.current?.close();

  return (
    <dialog
      ref={dialog}
      aria-labelledby="feedback-title"
      onClick={e => { if (e.target === dialog.current) close(); }}
      className="m-auto w-[min(34rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-md border border-line bg-surface p-5 sm:p-6 text-ink backdrop:bg-black/70"
    >
      {session > 0 && <FeedbackForm key={session} onClose={close} />}
    </dialog>
  );
}

const input = 'w-full rounded-sm border border-line bg-surface-2 px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-brand-2';

function FeedbackForm({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();
  const [state, action, pending] = useActionState<FeedbackState, FormData>(submitFeedback, {});
  const v = state.values ?? {};
  const [rating, setRating] = useState(0);

  const header = (
    <div className="flex items-start justify-between gap-4 mb-4">
      <h2 id="feedback-title" className="font-display text-3xl leading-none text-ink">Feedback</h2>
      <button type="button" onClick={onClose} aria-label="Close" className="-mr-1 -mt-1 p-1 rounded-sm text-dim hover:text-ink">
        <X size={20} aria-hidden="true" />
      </button>
    </div>
  );

  if (state.ok) {
    return (
      <div>
        {header}
        <p className="text-ink-2">Thanks, that&apos;s been sent.</p>
        <button type="button" onClick={onClose} className="mt-5 rounded-sm bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/85">Close</button>
      </div>
    );
  }

  return (
    <form action={action}>
      {header}
      <input type="hidden" name="page" value={pathname} />
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />

      <fieldset className="mb-5">
        <legend className="label mb-2">What&apos;s it about?</legend>
        <div className="flex flex-wrap gap-2">
          {FEEDBACK_KINDS.map(kind => (
            <label key={kind.key} className="cursor-pointer">
              <input type="radio" name="kind" value={kind.key} required defaultChecked={v.kind === kind.key} className="peer sr-only" />
              <span className="block rounded-sm border border-line px-3 py-1.5 text-sm text-ink-2 hover:text-ink peer-checked:border-brand peer-checked:bg-brand peer-checked:text-white peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-brand-2">
                {kind.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="mb-5">
        <legend className="label mb-2">Rating <span className="normal-case tracking-normal font-normal">(optional)</span></legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map(n => (
            <label key={n} className="cursor-pointer">
              <input type="radio" name="rating" value={n} defaultChecked={v.rating === String(n)} className="peer sr-only" onChange={() => setRating(n)} />
              <Star size={28} aria-hidden="true" className={`rounded-sm peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-brand-2 ${n <= rating ? 'fill-live text-live' : 'text-faint hover:text-dim'}`} />
              <span className="sr-only">{n} out of 5</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block mb-5">
        <span className="label block mb-2">Details</span>
        <textarea name="details" required maxLength={4000} rows={5} defaultValue={v.details} className={input} placeholder="What happened, or what would you like to see?" />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        <label className="block">
          <span className="label block mb-2">Your name <span className="normal-case tracking-normal font-normal">(optional)</span></span>
          <input type="text" name="manager_name" maxLength={120} autoComplete="name" defaultValue={v.manager_name} className={input} />
        </label>
        <label className="block">
          <span className="label block mb-2">Email <span className="normal-case tracking-normal font-normal">(optional)</span></span>
          <input type="email" name="email" maxLength={200} autoComplete="email" defaultValue={v.email} className={input} />
        </label>
      </div>

      {state.error && <p role="alert" className="mb-4 text-sm text-loss-2">{state.error}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-sm border border-line px-4 py-2 text-sm font-semibold text-ink-2 hover:text-ink hover:border-faint">Cancel</button>
        <button type="submit" disabled={pending} className="rounded-sm bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/85 disabled:opacity-60">
          {pending ? 'Sending…' : 'Send'}
        </button>
      </div>
    </form>
  );
}
