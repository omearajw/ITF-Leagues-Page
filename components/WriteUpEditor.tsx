'use client';

import { useEffect, useRef, useState } from 'react';

// Text colours from the site's default theme (app/globals.css), as hex because they're saved into
// the write-up itself: ink, brand-2, live-2, win-2 and dim. Each is light enough to read on the
// dark background; brand (the deep red) is left out because it's too dark for text.
const COLOURS = [
  { hex: '#f6f2eb', name: 'Cream' },
  { hex: '#ff707c', name: 'Red' },
  { hex: '#fcd34d', name: 'Amber' },
  { hex: '#4ade80', name: 'Green' },
  { hex: '#aaa194', name: 'Grey' },
];
const EMOJI = ['⚽', '🔥', '😂', '😭', '🏆', '💀', '🧤', '🚀', '🤡', '👀', '🎯', '🥇'];

type Props = { name: string; initialHtml: string; placeholder?: string; onChange?: (html: string) => void };

// Dependency-free rich text editor built on contentEditable. The HTML it produces is
// sanitised on render (lib/richtext.ts), so the toolbar only needs to be convenient.
export default function WriteUpEditor({ name, initialHtml, placeholder, onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState(initialHtml);
  const [showColours, setShowColours] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== initialHtml) ref.current.innerHTML = initialHtml;
  }, [initialHtml]);

  const sync = () => {
    const value = ref.current?.innerHTML || '';
    setHtml(value);
    onChange?.(value);
  };
  const run = (command: string, value?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, value);
    sync();
  };
  const insertText = (text: string) => { ref.current?.focus(); document.execCommand('insertText', false, text); sync(); };
  // Pasted text arrives as plain text. Inserted as it is, Safari keeps its line breaks as raw
  // newline characters, which a page doesn't show, so the paragraphs run together. Building the
  // paragraphs ourselves keeps them in every browser: a blank line starts a new paragraph, a
  // single line break stays a line break.
  const onPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain').replace(/\r\n?/g, '\n');
    const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    if (paragraphs.length <= 1 && !text.includes('\n')) document.execCommand('insertText', false, text);
    else document.execCommand('insertHTML', false, paragraphs.map(p => `<p>${escape(p).replace(/\n/g, '<br>')}</p>`).join(''));
    sync();
  };

  const Btn = ({ label, title, onClick, className = '' }: { label: React.ReactNode; title: string; onClick: () => void; className?: string }) => (
    <button type="button" title={title} onMouseDown={e => e.preventDefault()} onClick={onClick} className={`px-2 py-1 rounded text-sm font-bold text-ink-2 hover:bg-surface-3 ${className}`}>{label}</button>
  );

  return (
    <div className="flex flex-col flex-grow">
      <input type="hidden" name={name} value={html} />
      <div className="flex flex-wrap items-center gap-0.5 border border-line border-b-0 rounded-t-lg bg-surface-2 px-2 py-1 relative">
        <Btn label={<b>B</b>} title="Bold" onClick={() => run('bold')} />
        <Btn label={<i>I</i>} title="Italic" onClick={() => run('italic')} />
        <Btn label={<u>U</u>} title="Underline" onClick={() => run('underline')} />
        <span className="w-px h-5 bg-line mx-1" />
        <Btn label="H" title="Heading" onClick={() => run('formatBlock', 'h2')} />
        <Btn label="h" title="Sub-heading" onClick={() => run('formatBlock', 'h3')} />
        <Btn label="¶" title="Normal text" onClick={() => run('formatBlock', 'p')} />
        <span className="w-px h-5 bg-line mx-1" />
        <Btn label="• List" title="Bullet list" onClick={() => run('insertUnorderedList')} />
        <Btn label="1. List" title="Numbered list" onClick={() => run('insertOrderedList')} />
        <span className="w-px h-5 bg-line mx-1" />
        <Btn label={<span className="inline-block w-4 h-4 rounded-full align-middle" style={{ background: 'linear-gradient(90deg,#ff707c,#fcd34d,#4ade80,#f6f2eb)' }} />} title="Text colour" onClick={() => { setShowColours(v => !v); setShowEmoji(false); }} />
        <Btn label="😀" title="Emoji" onClick={() => { setShowEmoji(v => !v); setShowColours(false); }} />
        <span className="w-px h-5 bg-line mx-1" />
        <Btn label="✕" title="Clear formatting" onClick={() => { run('removeFormat'); run('formatBlock', 'p'); }} className="text-faint" />
        {showColours && (
          <div className="absolute left-2 top-full mt-1 z-10 flex gap-1 p-2 bg-surface border border-line rounded-lg shadow-lg">
            {COLOURS.map(c => <button key={c.hex} type="button" onMouseDown={e => e.preventDefault()} onClick={() => { run('foreColor', c.hex); setShowColours(false); }} className="w-6 h-6 rounded-full border border-white/20" style={{ background: c.hex }} title={c.name} aria-label={c.name} />)}
          </div>
        )}
        {showEmoji && (
          <div className="absolute left-2 top-full mt-1 z-10 flex flex-wrap gap-1 p-2 w-56 bg-surface border border-line rounded-lg shadow-lg">
            {EMOJI.map(e => <button key={e} type="button" onMouseDown={ev => ev.preventDefault()} onClick={() => { insertText(e); setShowEmoji(false); }} className="w-8 h-8 text-lg rounded hover:bg-surface-3">{e}</button>)}
          </div>
        )}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={sync}
        onBlur={sync}
        onPaste={onPaste}
        data-placeholder={placeholder}
        className="writeup min-h-[10rem] flex-grow w-full p-3 border border-line rounded-b-lg bg-surface-2 focus:ring-2 focus:ring-brand-2 focus:outline-none text-sm text-ink empty:before:content-[attr(data-placeholder)] empty:before:text-faint"
      />
    </div>
  );
}
