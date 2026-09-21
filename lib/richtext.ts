// Write-ups are stored as a small subset of HTML produced by the in-site editor.
// Everything rendered passes through this allow-list, so only these tags and
// attributes can ever reach the page.

const ALLOWED: Record<string, string[]> = {
  p: [], br: [], div: [], b: [], strong: [], i: [], em: [], u: [], s: [],
  h2: [], h3: [], ul: [], ol: [], li: [], blockquote: [],
  span: ['style'], a: ['href'],
};
const BLOCK_AS_P = new Set(['div']);
const COLOR = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\))$/i;

export function isHtml(content: string | null | undefined): boolean {
  return !!content && /<\/?[a-z][^>]*>/i.test(content);
}

function cleanAttrs(tag: string, attrs: string): string {
  const allowed = ALLOWED[tag] || [];
  let out = '';
  if (allowed.includes('style')) {
    const m = attrs.match(/style\s*=\s*"([^"]*)"/i) || attrs.match(/style\s*=\s*'([^']*)'/i);
    const color = m && m[1].match(/color\s*:\s*([^;]+)/i);
    if (color && COLOR.test(color[1].trim())) out += ` style="color:${color[1].trim()}"`;
  }
  if (allowed.includes('href')) {
    const m = attrs.match(/href\s*=\s*"([^"]*)"/i) || attrs.match(/href\s*=\s*'([^']*)'/i);
    if (m && /^https?:\/\//i.test(m[1])) out += ` href="${m[1].replace(/"/g, '&quot;')}" target="_blank" rel="noopener noreferrer"`;
  }
  return out;
}

export function sanitizeHtml(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|iframe|object|embed)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<(\/?)([a-z0-9]+)([^>]*)>/gi, (_, close: string, rawTag: string, attrs: string) => {
      let tag = rawTag.toLowerCase();
      // Browsers emit <font color> for colour changes; keep the colour, drop the tag.
      if (tag === 'font') {
        if (close) return '</span>';
        const m = attrs.match(/color\s*=\s*"([^"]*)"/i) || attrs.match(/color\s*=\s*'([^']*)'/i);
        return m && COLOR.test(m[1].trim()) ? `<span style="color:${m[1].trim()}">` : '<span>';
      }
      if (!(tag in ALLOWED)) return '';
      if (BLOCK_AS_P.has(tag)) tag = 'p';
      if (close) return `</${tag}>`;
      return `<${tag}${cleanAttrs(tag, attrs)}>`;
    });
}

// Plain text for previews and tickers.
export function toPlainText(content: string | null | undefined): string {
  if (!content) return '';
  if (!isHtml(content)) return content;
  return content
    .replace(/<\/(p|div|h2|h3|li|blockquote)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
