import { isHtml, sanitizeHtml } from '@/lib/richtext';

// Renders a write-up: sanitised HTML from the editor, or older plain text with its line breaks.
export default function RichText({ content, className = '' }: { content: string | null | undefined; className?: string }) {
  if (!content) return null;
  if (!isHtml(content)) return <div className={`whitespace-pre-line ${className}`}>{content}</div>;
  return <div className={`writeup ${className}`} dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }} />;
}
