import type { IntroConcept } from '@/lib/intro';

// The three intro performances. Each one animates the overlay's copy of BackPageMark and the
// photo, returns its animations, and must finish with everything at rest (identity transforms,
// strokes hidden) because IntroSplash then flies the result into the banner and swaps in the
// real one. The soft shadow is a filter on the whole mark, so it follows the letters as they move.

export type Glyph = { line: number; el: SVGPathElement };
export type Stage = {
  photo: HTMLElement;      // both photos inside the frame (night underneath, lit on top)
  lit: HTMLElement;        // the lit photo: its opacity is the floodlights
  frame: HTMLElement;      // the frame itself, nudged by kick-off impacts
  lettering: HTMLElement;  // the layer holding the mark, shaken by the press
  flash: HTMLElement;
  grain: HTMLElement;
  letters: Glyph[];        // reading order
  rule: SVGRectElement;    // the red rule above "THE"
};

export function buildStage(root: HTMLElement): Stage | null {
  const letters = Array.from(root.querySelectorAll<SVGPathElement>('[data-glyph]'), el => ({ line: Number(el.dataset.line ?? 0), el }));
  const rule = root.querySelector<SVGRectElement>('[data-mark-rule]');
  const el = (name: string) => root.querySelector<HTMLElement>(`[data-intro-${name}]`);
  const photo = el('photo-layer'), lit = el('lit'), frame = el('frame'), lettering = el('stage'), flash = el('flash'), grain = el('grain');
  if (!letters.length || !rule || !photo || !lit || !frame || !lettering || !flash || !grain) return null;
  return { photo, lit, frame, lettering, flash, grain, letters, rule };
}

const play = (el: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions) => el.animate(keyframes, { fill: 'both', ...options });

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

// Floodlights: the ground at night, the red rule drawn like a chalk line, the lights clunking on
// in banks, then the letters traced in outline and filled.
function floodlights(s: Stage): Animation[] {
  const out: Animation[] = [];
  out.push(play(s.photo, [
    { offset: 0, opacity: 0, transform: 'scale(1.08)' },
    { offset: 0.25, opacity: 1, transform: 'scale(1.06)' },
    { offset: 1, opacity: 1, transform: 'scale(1)' },
  ], { duration: 1800, easing: 'cubic-bezier(0.3, 0, 0.3, 1)' }));
  // Three banks, the first catching with a flicker, the last with a flare.
  out.push(play(s.lit, [
    { offset: 0, opacity: 0, filter: 'brightness(1)' },
    { offset: 0.289, opacity: 0, filter: 'brightness(1)' },
    { offset: 0.2891, opacity: 0.38, filter: 'brightness(1)' },
    { offset: 0.328, opacity: 0.38, filter: 'brightness(1)' },
    { offset: 0.3281, opacity: 0.1, filter: 'brightness(1)' },
    { offset: 0.356, opacity: 0.1, filter: 'brightness(1)' },
    { offset: 0.3561, opacity: 0.42, filter: 'brightness(1)' },
    { offset: 0.444, opacity: 0.42, filter: 'brightness(1)' },
    { offset: 0.4441, opacity: 0.74, filter: 'brightness(1)' },
    { offset: 0.556, opacity: 0.74, filter: 'brightness(1)' },
    { offset: 0.5561, opacity: 1, filter: 'brightness(1.45)', easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
    { offset: 1, opacity: 1, filter: 'brightness(1)' },
  ], { duration: 1800 }));

  // The rule draws left to right, glowing, and loses the glow as the last bank catches.
  s.rule.style.transformOrigin = 'left center';
  out.push(play(s.rule, [
    { offset: 0, transform: 'scaleX(0)', filter: 'drop-shadow(0px 0px 3px rgba(255, 120, 140, 0.95))', easing: 'cubic-bezier(0.65, 0, 0.25, 1)' },
    { offset: 0.6, transform: 'scaleX(1)', filter: 'drop-shadow(0px 0px 3px rgba(255, 120, 140, 0.95))' },
    { offset: 1, transform: 'scaleX(1)', filter: 'drop-shadow(0px 0px 0px rgba(255, 120, 140, 0))' },
  ], { duration: 1100, delay: 150 }));

  s.letters.forEach((g, i) => {
    const length = g.el.getTotalLength();
    Object.assign(g.el.style, { stroke: '#fff', strokeWidth: '1.4', strokeLinejoin: 'round', strokeDasharray: `${length}` });
    out.push(play(g.el, [
      { offset: 0, strokeDashoffset: `${length}`, fillOpacity: 0, strokeOpacity: 1, easing: 'cubic-bezier(0.45, 0, 0.2, 1)' },
      { offset: 0.6, strokeDashoffset: '0', fillOpacity: 0, strokeOpacity: 1, easing: 'cubic-bezier(0.3, 0, 0.2, 1)' },
      { offset: 1, strokeDashoffset: '0', fillOpacity: 1, strokeOpacity: 0 },
    ], { duration: 820, delay: 1050 + i * 40 }));
  });
  return out;
}

// Kick-off: under a dark sky the red rule slides in, then each letter is struck in from off screen
// on an arc, spinning, and thuds into place with a squash while the photo jolts like the net
// taking it. Each finished line switches on another bank of floodlights.
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
    out.push(play(g.el, [
      ...flight.map(f => ({ offset: f.offset, opacity: f.opacity, transform: motion(f.x, f.y, f.deg, f.scale, f.scale) })),
      { offset: 0.92, opacity: 1, transform: motion(0, 1.5, 0, 1.07, 0.9), easing: 'cubic-bezier(0.3, 0, 0.4, 1)' },
      { offset: 1, opacity: 1, transform: motion(0, 0, 0, 1, 1) },
    ], { duration: FLIGHT, delay }));
  };

  s.rule.style.transformOrigin = 'left center';
  out.push(play(s.rule, [
    { offset: 0, opacity: 0, transform: 'translateX(-160px) scaleX(0.4)', easing: 'cubic-bezier(0.2, 0.8, 0.25, 1)' },
    { offset: 1, opacity: 1, transform: 'translateX(0px) scaleX(1)' },
  ], { duration: 520, delay: 120 }));

  const lines = [0, 1, 2].map(line => s.letters.map((g, i) => ({ g, i })).filter(({ g }) => g.line === line));
  lines[0].forEach(({ g, i }, n) => strike(g, i, n === lines[0].length - 1));
  lines[1].forEach(({ g, i }, n) => strike(g, i, n === lines[1].length - 1));
  lines[2].forEach(({ g, i }, n) => strike(g, i, n === lines[2].length - 1));

  const total = Math.max(...jolts) + 240;
  out.push(timeline(s.frame, total, { transform: 'translate(0px, 0px) scale(1)' }, jolts.map(at => ({
    at,
    steps: [[40, { transform: 'translate(0px, 4px) scale(1.008)' }], [200, { transform: 'translate(0px, 0px) scale(1)' }]],
  }))));

  const banks = [0.42, 0.76, 1];
  const lightsEnd = jolts[jolts.length - 1] + 700;
  const lights: Keyframe[] = [{ offset: 0, opacity: 0, filter: 'brightness(1)' }];
  jolts.forEach((at, i) => {
    const before = i === 0 ? 0 : banks[i - 1];
    lights.push({ offset: at / lightsEnd, opacity: before, filter: 'brightness(1)' });
    lights.push({ offset: (at + 60) / lightsEnd, opacity: banks[i], filter: i === jolts.length - 1 ? 'brightness(1.4)' : 'brightness(1)', easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' });
  });
  lights.push({ offset: 1, opacity: 1, filter: 'brightness(1)' });
  out.push(play(s.lit, lights, { duration: lightsEnd }));
  return out;
}

// Printing press: a night match covered by the press. Each line is slammed down with a jolt,
// every slam firing a flashbulb that lights the scene for an instant, then the red rule is
// stamped on last and the floodlights stay on.
const PRESS_LINES = [420, 860, 1300];
const PRESS_RULE = 1720;
const STAMP = 300, HIT = 0.72;

function press(s: Stage): Animation[] {
  const out: Animation[] = [];
  out.push(play(s.photo, [{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: 'ease-out' }));

  const stamp = (from: string, settle: string): Keyframe[] => [
    { offset: 0, opacity: 0, transform: from, filter: 'blur(0px)', easing: 'cubic-bezier(0.6, 0, 1, 0.6)' },
    { offset: HIT, opacity: 1, transform: 'translate(0px, 0px) scale(1, 1)', filter: 'blur(1.2px)', easing: 'cubic-bezier(0.2, 0.6, 0.35, 1)' },
    { offset: 0.84, opacity: 1, transform: settle, filter: 'blur(0.4px)', easing: 'ease-out' },
    { offset: 1, opacity: 1, transform: 'translate(0px, 0px) scale(1, 1)', filter: 'blur(0px)' },
  ];
  s.letters.forEach(g => {
    const line = s.letters.filter(o => o.line === g.line).map(o => o.el.getBBox());
    const x1 = Math.min(...line.map(b => b.x)), x2 = Math.max(...line.map(b => b.x + b.width));
    const y1 = Math.min(...line.map(b => b.y)), y2 = Math.max(...line.map(b => b.y + b.height));
    // Scale each letter about its line's centre, so the whole line comes down as one plate.
    const own = g.el.getBBox();
    g.el.style.transformOrigin = `${((x1 + x2) / 2 - own.x).toFixed(2)}px ${((y1 + y2) / 2 - own.y).toFixed(2)}px`;
    out.push(play(g.el, stamp('translate(0px, -30px) scale(1.9, 1.9)', 'translate(0px, 1px) scale(1.025, 0.96)'), { duration: STAMP, delay: PRESS_LINES[g.line] }));
  });
  s.rule.style.transformOrigin = 'left center';
  out.push(play(s.rule, stamp('translate(0px, -24px) scale(1.5, 2.4)', 'translate(0px, 0.5px) scale(1.01, 0.8)'), { duration: 220, delay: PRESS_RULE }));

  const impacts = [...PRESS_LINES.map(at => at + STAMP * HIT), PRESS_RULE + 220 * HIT];
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
  // The photo shakes too, scaled up slightly so its edges never show inside the frame. After the
  // last stamp it eases back to full size over half a second, like a camera settling; snapping
  // back in a frame or two reads as a jitter.
  const photoEnd = impacts[impacts.length - 1] + 760;
  out.push(timeline(s.photo, photoEnd, { transform: 'translate(0px, 0px) scale(1.03)' }, jolts.map((j, i) => ({
    at: j.at,
    steps: j.steps.map(([t, v], n) => [t, {
      transform: `${v.transform} scale(1.03)`,
      ...(i === jolts.length - 1 && n === j.steps.length - 1 ? { easing: 'cubic-bezier(0.33, 0, 0.2, 1)' } : {}),
    }] as [number, Keyframe]),
  })), { transform: 'translate(0px, 0px) scale(1)' }));
  out.push(timeline(s.flash, total, { opacity: 0 }, impacts.map(at => ({ at, steps: [[25, { opacity: 0.35 }], [160, { opacity: 0 }]] as [number, Keyframe][] }))));
  out.push(timeline(s.grain, total, { opacity: 0 }, impacts.map(at => ({ at, steps: [[20, { opacity: 0.35 }], [260, { opacity: 0 }]] as [number, Keyframe][] }))));
  // Each flashbulb shows the lit scene for an instant and lets it fall back to night; the
  // rule's stamp brings the floodlights up for good.
  const lightsEnd = impacts[impacts.length - 1] + 640;
  const flashes = impacts.slice(0, -1).map(at => ({ at, steps: [[20, { opacity: 0.95, filter: 'brightness(1.25)' }], [300, { opacity: 0.06, filter: 'brightness(1)' }]] as [number, Keyframe][] }));
  const floodlit = { at: impacts[impacts.length - 1], steps: [[20, { opacity: 1, filter: 'brightness(1.4)' }], [600, { opacity: 1, filter: 'brightness(1)' }]] as [number, Keyframe][] };
  out.push(timeline(s.lit, lightsEnd, { opacity: 0, filter: 'brightness(1)' }, [...flashes, floodlit], { opacity: 1, filter: 'brightness(1)' }));
  return out;
}

export const CHOREOGRAPHY: Record<IntroConcept, (stage: Stage) => Animation[]> = { floodlights, kickoff, press };
