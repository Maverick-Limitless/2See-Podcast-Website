/**
 * Scroll-reveal controller.
 *
 * One observer watches every `[data-reveal]` and `[data-reveal-x]` element. Content
 * that is already on screen when it is observed is revealed immediately, so
 * above-the-fold material is never left invisible if scripting is slow or the
 * observer is unavailable.
 *
 * Without this controller, a `data-reveal` element would stay at opacity 0 —
 * which is a real trap, because the markup looks correct and only a screenshot
 * shows the problem.
 */

export function observeReveals(root: ParentNode = document): void {
  // Both entrance variants are observed by the same controller, so a new
  // variant can never ship without its reveal wiring.
  const targets = Array.from(
    root.querySelectorAll<HTMLElement>('[data-reveal], [data-reveal-x]')
  );
  if (targets.length === 0) return;

  const reveal = (element: HTMLElement): void => {
    element.classList.add('is-revealed');
  };

  if (typeof IntersectionObserver === 'undefined') {
    // No observer support: show everything rather than hiding content.
    for (const element of targets) reveal(element);
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        reveal(entry.target as HTMLElement);
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.05 }
  );

  for (const element of targets) {
    // Anything already inside the viewport is revealed right away, without
    // waiting for a callback cycle.
    const rect = element.getBoundingClientRect();
    const onScreen = rect.top < window.innerHeight && rect.bottom > 0;
    if (onScreen) reveal(element);
    else observer.observe(element);
  }
}

/** Re-scans the document. Called after client-side navigation. */
export function refreshReveals(): void {
  observeReveals(document);
}
