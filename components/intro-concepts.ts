import { MARK_SHADOW } from '@/lib/back-page-mark';
import type { IntroConcept } from '@/lib/intro';

// The three intro performances. Each one animates the overlay's copy of BackPageMark and the
// photo, returns its animations, and must finish with everything at rest (identity transforms,
// shadows at their offsets, strokes hidden) because IntroSplash then flies the result into the
// banner and swaps in the real one.

type Layer = 'cream' | 'red' | 'dark';
export type Glyph = { line: number; cream: SVGPathElement; red: SVGPathElement; dark: SVGPathElement };
export type Stage = {
  photo: HTMLElement;      // the photo inside the frame
  frame: HTMLElement;      // the frame itself, nudged by kick-off impacts
  lettering: HTMLElement;  // the layer holding the mark, shaken by the press
  flash: HTMLElement;
  grain: HTMLElement;
  letters: Glyph[];        // reading order
  spine: Glyph;
};

export function buildStage(root: HTMLElement): Stage | null {
  const pick = (layer: Layer, key: string) => root.querySelector<SVGPathElement>(`[data-layer="${layer}"] [data-glyph="${key}"]`);
  const glyph = (key: string): Glyph | null => {
    const cream = pick('cream', key), red = pick('red', key), dark = pick('dark', key);
    return cream && red && dark ? { line: Number(cream.dataset.line ?? 1), cream, red, dark } : null;
  };
  const count = root.querySelectorAll('[data-layer="cream"] [data-glyph]:not([data-glyph="spine"])').length;
  const letters = Array.from({ length: count }, (_, i) => glyph(String(i)));
  const spine = glyph('spine');
  const el = (name: string) => root.querySelector<HTMLElement>(`[data-intro-${name}]`);
  const photo = el('photo-layer'), frame = el('frame'), lettering = el('stage'), flash = el('flash'), grain = el('grain');
  if (!spine || letters.some(g => !g) || !photo || !frame || !lettering || !flash || !grain) return null;
  return { photo, frame, lettering, flash, grain, letters: letters as Glyph[], spine };
}

const play = (el: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions) => el.animate(keyframes, { fill: 'both', ...options });

// Moves a shadow copy back under its letter: 1 = hidden beneath it, 0 = at rest, below 0 overshoots.
const tuck = (layer: 'red' | 'dark', k: number) => {
  const [x, y] = MARK_SHADOW[layer];
  return `translate(${(-x * k).toFixed(2)}px, ${(-y * k).toFixed(2)}px)`;
};
const SHADOWS = ['red', 'dark'] as const;

// A timeline of short events on one element, as a single animation so the events never
// override each other. Each event is a list of [ms after its start, keyframe values]; `end`
// is where it settles, for an element that must finish somewhere other than its resting state.
function timeline(el: Element, total: number, rest: Keyframe, events: { at: number; steps: [number, Keyframe][] }[], end: Keyframe = rest) {
  const frames: Keyframe[] = [{ ...rest, offset: 0 }];
  for (const { at, steps } of events) {
    frames.push({ ...rest, offset: at / total });
    for (const [t, values] of steps) frames.push({ ...rest, ...values, offset: Math.min(1, (at + t) / total) });
  }
  frames.push({ ...end, offset: 1 });
  return play(el, frames, { duration: total, fill: 'none' });
}

// Shadows slide out from beneath their letters with an overshoot, like the type being extruded.
function extrude(g: Glyph, delay: number, duration = 520) {
  return SHADOWS.map(layer => play(g[layer], [
    { offset: 0, opacity: 0, transform: tuck(layer, 1) },
    { offset: 0.001, opacity: 1, transform: tuck(layer, 1), easing: 'cubic-bezier(0.25, 1.6, 0.45, 1)' },
    { offset: 1, opacity: 1, transform: tuck(layer, 0) },
  ], { duration, delay }));
}

// Floodlights: the dark ground, a chalk line drawn upwards, the lights clunking on in banks,
// the letters traced in outline around the spine and filled, then the shadows extruded.
function floodlights(s: Stage): Animation[] {
  const out: Animation[] = [];
  out.push(play(s.photo, [
    { offset: 0, opacity: 0, filter: 'brightness(0.6)', transform: 'scale(1.08)' },
    { offset: 0.25, opacity: 0, filter: 'brightness(0.6)' },
    { offset: 0.2501, opacity: 0.4, filter: 'brightness(0.7)' },
    { offset: 0.29, opacity: 0.4, filter: 'brightness(0.7)' },
    { offset: 0.2901, opacity: 0.12, filter: 'brightness(0.7)' },
    { offset: 0.32, opacity: 0.12, filter: 'brightness(0.7)' },
    { offset: 0.3201, opacity: 0.42, filter: 'brightness(0.75)' },
    { offset: 0.42, opacity: 0.42, filter: 'brightness(0.75)' },
    { offset: 0.4201, opacity: 0.78, filter: 'brightness(0.92)' },
    { offset: 0.54, opacity: 0.78, filter: 'brightness(0.95)' },
    { offset: 0.5401, opacity: 1, filter: 'brightness(1.55)', easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
    { offset: 1, opacity: 1, filter: 'brightness(1)', transform: 'scale(1)' },
  ], { duration: 1700 }));

  // Thin and glowing while it draws, then thickening to full weight as the last bank catches.
  s.spine.cream.style.transformOrigin = 'center bottom';
  out.push(play(s.spine.cream, [
    { offset: 0, transform: 'scale(0.12, 0)', filter: 'drop-shadow(0px 0px 3px rgba(255, 246, 230, 0.95))', easing: 'cubic-bezier(0.65, 0, 0.25, 1)' },
    { offset: 0.5, transform: 'scale(0.12, 1)', filter: 'drop-shadow(0px 0px 3px rgba(255, 246, 230, 0.95))' },
    { offset: 0.78, transform: 'scale(0.12, 1)', filter: 'drop-shadow(0px 0px 3px rgba(255, 246, 230, 0.95))', easing: 'cubic-bezier(0.3, 1.5, 0.5, 1)' },
    { offset: 1, transform: 'scale(1, 1)', filter: 'drop-shadow(0px 0px 0px rgba(255, 246, 230, 0))' },
  ], { duration: 1000, delay: 150 }));

  s.letters.forEach((g, i) => {
    const length = g.cream.getTotalLength();
    Object.assign(g.cream.style, { stroke: '#fdf6ee', strokeWidth: '1.4', strokeLinejoin: 'round', strokeDasharray: `${length}` });
    // A soft dark halo keeps the thin outline readable against the bright fog while it traces.
    out.push(play(g.cream, [
      { offset: 0, strokeDashoffset: `${length}`, fillOpacity: 0, strokeOpacity: 1, filter: 'drop-shadow(0px 0px 1.5px rgba(20, 12, 6, 0.6))', easing: 'cubic-bezier(0.45, 0, 0.2, 1)' },
      { offset: 0.6, strokeDashoffset: '0', fillOpacity: 0, strokeOpacity: 1, filter: 'drop-shadow(0px 0px 1.5px rgba(20, 12, 6, 0.6))', easing: 'cubic-bezier(0.3, 0, 0.2, 1)' },
      { offset: 1, strokeDashoffset: '0', fillOpacity: 1, strokeOpacity: 0, filter: 'drop-shadow(0px 0px 0px rgba(20, 12, 6, 0))' },
    ], { duration: 820, delay: 950 + i * 40 }));
  });

  [s.spine, ...s.letters].forEach((g, i) => out.push(...extrude(g, 1900 + i * 16, 420)));
  return out;
}

// Kick-off: each letter is struck in from off screen on an arc, spinning, and thuds into place
// with a squash; its shadow punches out on impact and the photo jolts like the net taking it.
const LAUNCH: [number, number, number][] = [
  [-430, 520, -320], [170, 660, 250], [560, 470, 380],
  [-620, 380, -420], [-150, 720, 300], [390, 640, -280], [730, 310, 440],
  [-540, 610, 360], [90, 740, -400], [470, 570, 300], [690, 430, -360],
];
const FLIGHT_SAMPLES = [0, 0.12, 0.25, 0.4, 0.55, 0.7, 0.85, 1];

function kickoff(s: Stage): Animation[] {
  const out: Animation[] = [];
  const START = 250, GAP = 85, FLIGHT = 640, IMPACT = 0.84;
  out.push(play(s.photo, [{ opacity: 0, transform: 'scale(1.1)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 700, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' }));

  const motion = (x: number, y: number, deg: number, sx: number, sy: number) => `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${deg.toFixed(1)}deg) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
  const jolts: number[] = [];
  let slot = 0;

  const strike = (g: Glyph, i: number, lastInLine: boolean) => {
    const [dx, dy, spin] = LAUNCH[i % LAUNCH.length];
    const delay = START + slot++ * GAP;
    if (lastInLine) jolts.push(delay + FLIGHT * IMPACT);
    // A quadratic arc from the launch point, over a point above the letter's home, down into it.
    const cx = dx * 0.3, cy = -220;
    const flight = FLIGHT_SAMPLES.map(t => {
      const u = 1 - t;
      const x = u * u * dx + 2 * u * t * cx;
      const y = u * u * dy + 2 * u * t * cy;
      const scale = t < 0.6 ? 0.5 + (1.15 - 0.5) * (t / 0.6) : 1.15 - 0.15 * ((t - 0.6) / 0.4);
      return { offset: t * IMPACT, x, y, deg: spin * Math.pow(u, 1.5), scale, opacity: Math.min(1, t / 0.12) };
    });
    // Shadow copies stay hidden in flight, where they would fringe the letter's edges.
    const frames = (prefix: (k: number) => string, overshoot: number, shadow: boolean) => [
      ...flight.map(f => ({ offset: f.offset, opacity: shadow ? 0 : f.opacity, transform: `${prefix(1)} ${motion(f.x, f.y, f.deg, f.scale, f.scale)}` })),
      { offset: 0.92, opacity: 1, transform: `${prefix(overshoot)} ${motion(0, 1.5, 0, 1.07, 0.9)}`, easing: 'cubic-bezier(0.3, 0, 0.4, 1)' },
      { offset: 1, opacity: 1, transform: `${prefix(0)} ${motion(0, 0, 0, 1, 1)}` },
    ];
    out.push(play(g.cream, frames(() => 'translate(0px, 0px)', 0, false), { duration: FLIGHT, delay }));
    for (const layer of SHADOWS) out.push(play(g[layer], frames(k => tuck(layer, k), -0.3, true), { duration: FLIGHT, delay }));
  };

  const lines = [0, 1, 2].map(line => s.letters.map((g, i) => ({ g, i })).filter(({ g }) => g.line === line));
  lines[0].forEach(({ g, i }, n) => strike(g, i, n === lines[0].length - 1));

  // The spine goes up like a goalpost before "back" arrives, then its shadow punches out.
  const spineAt = START + slot++ * GAP + 60;
  s.spine.cream.style.transformOrigin = 'center bottom';
  out.push(play(s.spine.cream, [
    { offset: 0, transform: 'scale(1, 0)', easing: 'cubic-bezier(0.2, 0.9, 0.3, 1.25)' },
    { offset: 1, transform: 'scale(1, 1)' },
  ], { duration: 420, delay: spineAt }));
  out.push(...extrude(s.spine, spineAt + 380, 380));

  lines[1].forEach(({ g, i }, n) => strike(g, i, n === lines[1].length - 1));
  lines[2].forEach(({ g, i }, n) => strike(g, i, n === lines[2].length - 1));

  const total = Math.max(...jolts) + 240;
  out.push(timeline(s.frame, total, { transform: 'translate(0px, 0px) scale(1)' }, jolts.map(at => ({
    at,
    steps: [[40, { transform: 'translate(0px, 4px) scale(1.008)' }], [200, { transform: 'translate(0px, 0px) scale(1)' }]],
  }))));
  return out;
}

// Printing press: a flash of paper, the photo coming up like fresh ink, each line slammed down
// with a jolt and its ink spreading, then the spine snapping down to lock b and p together.
const PRESS_LINES = [420, 860, 1300];
const PRESS_SPINE = 1720;
const STAMP = 300, HIT = 0.72;

function press(s: Stage): Animation[] {
  const out: Animation[] = [];
  out.push(play(s.photo, [
    { offset: 0, opacity: 0, filter: 'grayscale(1) contrast(1.45) brightness(1.08)' },
    { offset: 0.12, opacity: 0, filter: 'grayscale(1) contrast(1.45) brightness(1.08)' },
    { offset: 0.1201, opacity: 1, filter: 'grayscale(1) contrast(1.45) brightness(1.08)', easing: 'cubic-bezier(0.3, 0, 0.3, 1)' },
    { offset: 1, opacity: 1, filter: 'grayscale(0) contrast(1) brightness(1)' },
  ], { duration: 1400 }));

  s.letters.forEach(g => {
    const line = s.letters.filter(o => o.line === g.line).map(o => o.cream.getBBox());
    const x1 = Math.min(...line.map(b => b.x)), x2 = Math.max(...line.map(b => b.x + b.width));
    const y1 = Math.min(...line.map(b => b.y)), y2 = Math.max(...line.map(b => b.y + b.height));
    // Scale each letter about its line's centre, so the whole line comes down as one plate.
    const own = g.cream.getBBox();
    const origin = `${((x1 + x2) / 2 - own.x).toFixed(2)}px ${((y1 + y2) / 2 - own.y).toFixed(2)}px`;
    const delay = PRESS_LINES[g.line];
    // Shadow copies appear only when the plate hits; while the line fades in they would show through it.
    const frames = (prefix: (k: number) => string, overshoot: number, blur: boolean, shadow: boolean) => [
      { offset: 0, opacity: 0, transform: `${prefix(1)} translate(0px, -30px) scale(1.9, 1.9)`, ...(blur ? { filter: 'blur(0px)' } : {}), easing: 'cubic-bezier(0.6, 0, 1, 0.6)' },
      { offset: HIT, opacity: shadow ? 0 : 1, transform: `${prefix(1)} translate(0px, 0px) scale(1, 1)`, ...(blur ? { filter: 'blur(1.6px)' } : {}), easing: 'cubic-bezier(0.2, 0.6, 0.35, 1)' },
      { offset: 0.84, opacity: 1, transform: `${prefix(overshoot)} translate(0px, 1px) scale(1.025, 0.96)`, ...(blur ? { filter: 'blur(0.6px)' } : {}), easing: 'ease-out' },
      { offset: 1, opacity: 1, transform: `${prefix(0)} translate(0px, 0px) scale(1, 1)`, ...(blur ? { filter: 'blur(0px)' } : {}) },
    ];
    for (const el of [g.cream, g.red, g.dark]) el.style.transformOrigin = origin;
    out.push(play(g.cream, frames(() => 'translate(0px, 0px)', 0, false, false), { duration: STAMP, delay }));
    out.push(play(g.red, frames(k => tuck('red', k), -0.2, false, true), { duration: STAMP, delay }));
    out.push(play(g.dark, frames(k => tuck('dark', k), -0.2, true, true), { duration: STAMP, delay }));
  });

  s.spine.cream.style.transformOrigin = 'center top';
  out.push(play(s.spine.cream, [
    { offset: 0, transform: 'scale(1, 0)', easing: 'cubic-bezier(0.7, 0, 1, 0.5)' },
    { offset: 1, transform: 'scale(1, 1)' },
  ], { duration: 170, delay: PRESS_SPINE }));
  out.push(...extrude(s.spine, PRESS_SPINE + 170, 280));

  const impacts = [...PRESS_LINES.map(at => at + STAMP * HIT), PRESS_SPINE + 170];
  const strength = [1, 1, 1.25, 0.6];
  const total = impacts[impacts.length - 1] + 240;
  const shake = (k: number): [number, Keyframe][] => [
    [25, { transform: `translate(${-6 * k}px, ${4 * k}px)` }],
    [55, { transform: `translate(${5 * k}px, ${-3 * k}px)` }],
    [95, { transform: `translate(${-3 * k}px, ${2 * k}px)` }],
    [145, { transform: `translate(${1.5 * k}px, ${-1 * k}px)` }],
    [220, { transform: 'translate(0px, 0px)' }],
  ];
  const jolts = impacts.map((at, i) => ({ at, steps: shake(strength[i]) }));
  out.push(timeline(s.lettering, total, { transform: 'translate(0px, 0px)' }, jolts));
  // The photo shakes too, scaled up slightly so its edges never show inside the frame.
  out.push(timeline(s.photo, total, { transform: 'translate(0px, 0px) scale(1.03)' }, jolts.map(j => ({ at: j.at, steps: j.steps.map(([t, v]) => [t, { transform: `${v.transform} scale(1.03)` }] as [number, Keyframe]) })), { transform: 'translate(0px, 0px) scale(1)' }));
  out.push(timeline(s.flash, total, { opacity: 0 }, [
    { at: 100, steps: [[50, { opacity: 0.55 }], [280, { opacity: 0 }]] },
    ...impacts.map(at => ({ at, steps: [[30, { opacity: 0.14 }], [170, { opacity: 0 }]] as [number, Keyframe][] })),
  ]));
  out.push(timeline(s.grain, total, { opacity: 0 }, [
    { at: 100, steps: [[60, { opacity: 0.5 }], [400, { opacity: 0 }]] },
    ...impacts.map(at => ({ at, steps: [[20, { opacity: 0.35 }], [260, { opacity: 0 }]] as [number, Keyframe][] })),
  ]));
  return out;
}

export const CHOREOGRAPHY: Record<IntroConcept, (stage: Stage) => Animation[]> = { floodlights, kickoff, press };
