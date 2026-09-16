// d-2026-09-16-sr-inline-markdown-rendering. content/page.schema.json's own
// description has called block.text "markdown-safe" since it was first
// authored -- but nothing downstream ever actually parsed markdown out of
// it: Block.astro rendered `{block.text}` as a plain Astro/JSX text node
// (auto-escaped, never re-interpreted), on the assumption a consumer that
// wanted real markdown would "wrap this or replace it" (this file's own
// prior doc comment). No consumer ever did. Found live, 2026-09-16: every
// real bridged article carries real markdown in its body -- **bold**
// clauses, [text](url) links in a close block's CTA sentence -- authored
// straight through from the source article's own canonical markdown body,
// and it was rendering as literal asterisks and bracket-paren text on
// production pages (confirmed on luh.tech's real insight articles).
//
// This is a narrow, safe formatter -- not a markdown parser. It supports
// exactly the two constructs real content actually uses (bold, inline
// links) plus italic for symmetry with bold, and nothing else: no
// headings/lists/code/images (those are already their own real
// block.blockType values or diagram/image blocks, never markdown syntax
// inside a text block). Escapes the raw text FIRST, then only its own
// three regexes can introduce a tag -- safe for real authored content
// (not user input) without needing a full sanitizer dependency.
function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

// Same href shape page.schema.json's own cta.href pattern already allows
// (anchor, same-site path, or an https:// URL) -- a markdown link outside
// that shape is left as literal escaped text rather than becoming an
// unvetted href, matching this schema family's existing "mailto: is not
// permitted" discipline.
const SAFE_HREF = /^(#[a-z0-9-]+|\/[a-z0-9\-/]*|https:\/\/[^\s")]+)$/i;

export function formatInlineMarkdown(text: string): string {
	let html = escapeHtml(text);
	html = html.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label: string, href: string) => {
		if (!SAFE_HREF.test(href)) return match;
		const external = href.startsWith('https://');
		return `<a href="${href}" class="underline decoration-accent-primary/50 underline-offset-2 hover:decoration-accent-primary"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${label}</a>`;
	});
	html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
	html = html.replace(/(?<![a-zA-Z0-9])_([^_]+)_(?![a-zA-Z0-9])/g, '<em>$1</em>');
	return html;
}
