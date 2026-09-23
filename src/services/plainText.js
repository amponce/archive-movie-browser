// Archive.org descriptions are the uploader's HTML. The site shows them as text: line breaks
// kept, every tag dropped (never rendered), the common entities decoded.
const MAX = 20000; // longer than any real description; keeps a hostile one from freezing the page
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

export function plainText(value) {
  if (value == null) return '';
  const html = (Array.isArray(value) ? value.join('\n') : String(value)).slice(0, MAX);
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>|<(p|div)\b[^>]*>|<\/(p|div|li|h\d)>/gi, '\n')
    .replace(/<[^<>]*>/g, '') // never scans past the next '<', so an unclosed one costs nothing
    .replace(/&(#\d+|#x[0-9a-f]+|\w+);/gi, (all, name) => {
      if (name[0] === '#') {
        const code = name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1));
        return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ''; // past Unicode: dropped, not thrown
      }
      return ENTITIES[name.toLowerCase()] ?? all;
    })
    .replace(/[ \t\u00a0]+/g, ' ')
    .split('\n').map(line => line.trim()).filter(Boolean).join('\n');
}
