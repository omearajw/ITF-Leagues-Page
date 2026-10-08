// Builds lib/back-page-mark.ts: "THE / BACK / PAGE" in Anton with a red rule.
// Usage: node scripts/back-page-mark/build.mjs [out]   (default lib/back-page-mark.ts)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'opentype.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ttf = fs.readFileSync(path.join(__dirname, 'Anton-Regular.ttf'));
const font = parse(ttf.buffer.slice(ttf.byteOffset, ttf.byteOffset + ttf.byteLength));
const OUT = process.argv[2] || path.join(__dirname, '../../lib/back-page-mark.ts');
const U = 100 / font.unitsPerEm;
const TRACK = 1.5, LINE_GAP = 2.5, RULE_H = 6, RULE_GAP = 5;
const CAP = -font.charToGlyph('H').getPath(0, 0, 100).getBoundingBox().y1;
const inkLeft = ch => font.charToGlyph(ch).getPath(0, 0, 100).getBoundingBox().x1;
const LEFT = inkLeft('B');                                   // the B and P stems
const lines = ['THE', 'BACK', 'PAGE'];
const glyphs = []; const lineInk = [];
let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
lines.forEach((word, line) => {
  const base = CAP + line * (CAP + LINE_GAP);
  let x = LEFT - inkLeft(word[0]), prev = null, lx1 = Infinity, lx2 = -Infinity;
  [...word].forEach((ch, i) => {
    const g = font.charToGlyph(ch);
    if (prev) x += font.getKerningValue(prev, g) * U + TRACK;
    const p = g.getPath(x, base, 100); const b = p.getBoundingBox();
    x1 = Math.min(x1, b.x1); y1 = Math.min(y1, b.y1); x2 = Math.max(x2, b.x2); y2 = Math.max(y2, b.y2);
    lx1 = Math.min(lx1, b.x1); lx2 = Math.max(lx2, b.x2);
    glyphs.push({ key: `${word.toLowerCase()}-${i}`, line, d: p.toPathData(2) });
    x += g.advanceWidth * U; prev = g;
  });
  lineInk.push([lx1, lx2]);
});
// The rule spans "THE" exactly and sits RULE_GAP above its cap height.
const rule = { x: +lineInk[0][0].toFixed(2), y: +(0 - RULE_GAP - RULE_H).toFixed(2), width: +(lineInk[0][1] - lineInk[0][0]).toFixed(2), height: RULE_H };
y1 = Math.min(y1, rule.y);
const vb = [x1, y1, x2 - x1, y2 - y1].map(v => +v.toFixed(2));
fs.writeFileSync(OUT, `// Generated from Anton (SIL Open Font License 1.1) so the hub's "THE BACK PAGE" lockup can be
// drawn and animated as outlines; regenerate with scripts/back-page-mark/build.mjs. 100 units =
// 1em; cap height ${CAP.toFixed(2)}.
//
// Tabloid style: three lines of condensed capitals, tracked +${TRACK} with the font's kerning,
// ${LINE_GAP} units apart, each line starting on the B and P stems' left edge (the T's crossbar
// is pulled in to match). A red rule spans "THE" exactly, ${RULE_GAP} units above it. The viewBox is
// the ink and the rule, so centring the SVG centres what is drawn; the soft shadow sits outside it.

export const MARK_VIEWBOX = '${vb.join(' ')}';
export const MARK_WIDTH = ${vb[2]};
export const MARK_HEIGHT = ${vb[3]};
export const MARK_RULE = { x: ${rule.x}, y: ${rule.y}, width: ${rule.width}, height: ${rule.height} } as const;
export const MARK_SHADOW = { dx: 1.5, dy: 2, blur: 1.2, opacity: 0.6 } as const;

export type MarkGlyph = { key: string; line: 0 | 1 | 2; d: string };

export const MARK_GLYPHS: MarkGlyph[] = [
${glyphs.map(g => `  { key: '${g.key}', line: ${g.line}, d: '${g.d}' },`).join('\n')}
];
`);
console.log(JSON.stringify({ viewBox: vb, rule, lineInk: lineInk.map(l => l.map(v => +v.toFixed(2))), bytes: fs.statSync(OUT).size }));
