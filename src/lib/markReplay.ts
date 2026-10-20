// A venture's animated mark plays again when it is clicked (0.22.0,
// d-2026-10-20-st-mark-replay). L4 2026-10-20: "the logo does not animate
// when you click ... this applies on all svg animations per the template".
// Every animated mark in the pack ran once on load and then sat on its last
// frame: Ectropy's reveal once per browser session, luh.tech's drop-in and
// the VentureMark marks once per page. Clicking a mark did nothing visible.
//
// An element opts in with data-mark-replay="<group>". Two kinds of mark:
//   - inline markup (an <svg> or a wrapper around one) whose CSS animations
//     are restarted in place;
//   - an <img> of an animated SVG, which a page cannot restart, so it gets
//     a fresh data: URL of the animated file (data-mark-replay-src, else its
//     own src). data:, not blob:, because ectropy.ai's CSP allows data: and
//     https: images but not blob:. Each replay's URL differs by a trailing
//     comment, so the browser draws a new image and its timeline starts at 0.
// A click that opens this same page replays in place and does not reload.
// A click that opens another page of the site leaves the group pending in
// sessionStorage, and that page replays it on load: the nav logo links to
// "/", so from any other page the replay is what the home page shows.
// Reduced motion: nothing replays.

export const REPLAY_ATTR = 'data-mark-replay';
export const REPLAY_SRC_ATTR = 'data-mark-replay-src';
export const PENDING_KEY = 'mark-replay-pending';

export type ReplayTarget = 'here' | 'next' | 'away';

/** Where a click on a mark lands: 'here' with no link or a link to this
 * page, 'next' for another page of this site, 'away' for another origin. */
export function replayTarget(href: string | null | undefined, current: string): ReplayTarget {
	if (!href) return 'here';
	let to: URL;
	let from: URL;
	try {
		from = new URL(current);
		to = new URL(href, from);
	} catch {
		return 'here';
	}
	if (to.origin !== from.origin) return 'away';
	const path = (u: URL) => u.pathname.replace(/\/index\.html$/, '/').replace(/(.)\/$/, '$1');
	return path(to) === path(from) && to.search === from.search ? 'here' : 'next';
}

/** The data: URL for replay number n of an SVG's text. */
export function replayDataUrl(svgText: string, n: number): string {
	return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`${svgText}<!--replay ${n}-->`)}`;
}

const svgText = new Map<string, Promise<string>>();
let replays = 0;

/** Play one mark from its first frame. */
export function replayMark(el: Element): void {
	if (el.tagName === 'IMG') {
		const img = el as HTMLImageElement;
		const src = img.getAttribute(REPLAY_SRC_ATTR) || img.currentSrc || img.src;
		if (!src) return;
		if (!svgText.has(src)) {
			svgText.set(src, fetch(src).then((r) => (r.ok ? r.text() : Promise.reject(new Error(`${r.status}`)))));
		}
		const n = ++replays;
		svgText.get(src)!.then(
			(text) => { img.src = replayDataUrl(text, n); },
			() => { svgText.delete(src); },
		);
		return;
	}
	if (typeof el.getAnimations === 'function') {
		for (const a of el.getAnimations({ subtree: true })) {
			a.cancel();
			a.play();
		}
	}
}

function replayGroup(doc: Document, group: string): void {
	for (const el of doc.querySelectorAll(`[${REPLAY_ATTR}]`)) {
		if (el.getAttribute(REPLAY_ATTR) === group) replayMark(el);
	}
}

/** Wire every [data-mark-replay] on the page: replay on click, and replay a
 * group a click on the previous page left pending. */
export function installMarkReplay(doc: Document = document, win: Window = window): void {
	if (win.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
	let pending: string | null = null;
	try {
		pending = win.sessionStorage.getItem(PENDING_KEY);
		if (pending !== null) win.sessionStorage.removeItem(PENDING_KEY);
	} catch { /* storage unavailable: no carried replay */ }
	if (pending !== null) replayGroup(doc, pending);

	doc.addEventListener('click', (e) => {
		const el = (e.target as Element | null)?.closest?.(`[${REPLAY_ATTR}]`);
		if (!el) return;
		const link = el.closest('a[href]') as HTMLAnchorElement | null;
		const newTab = !!link && (link.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0);
		const where = newTab ? 'here' : replayTarget(link?.getAttribute('href'), win.location.href);
		if (where === 'here') {
			if (link && !newTab && new URL(link.href).hash === win.location.hash) e.preventDefault();
			replayMark(el);
		} else if (where === 'next') {
			try { win.sessionStorage.setItem(PENDING_KEY, el.getAttribute(REPLAY_ATTR) ?? ''); } catch { /* the next page plays as it would */ }
		}
	});
}
