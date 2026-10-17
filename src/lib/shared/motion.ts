/**
 * Motion tokens, shared between CSS and any component that needs to schedule
 * an animation. Keeping them here means the CSS custom properties in
 * styles/motion.css and any JS-side timing cannot drift apart.
 */

export const motion = {
  instant: 90,
  fast: 160,
  base: 260,
  slow: 420,
  reveal: 640,
  staggerStep: 55
} as const;

export const easing = {
  out: 'cubic-bezier(0.16, 1, 0.3, 1)',
  inOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
  spring: 'cubic-bezier(0.34, 1.4, 0.64, 1)'
} as const;

/** Stagger delay for a card at `index` inside its group. */
export function staggerDelay(index: number, step = motion.staggerStep): number {
  return Math.min(index * step, 420);
}

/** True when the visitor asked for reduced motion. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
