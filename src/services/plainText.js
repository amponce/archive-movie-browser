// Archive.org descriptions are the uploader's HTML. The site shows them as text: line breaks
// kept, every tag dropped (never rendered), the common entities decoded.
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

export function plainText(value) {
  if (value == null) return '';
  const html = Array.isArray(value) ? value.join('\n') : String(value);
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>|<(p|div)\b[^>]*>|<\/(p|div|li|h\d)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#\d+|#x[0-9a-f]+|\w+);/gi, (all, name) => {
      if (name[0] === '#') return String.fromCodePoint(name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1)));
      return ENTITIES[name.toLowerCase()] ?? all;
    })
    .replace(/[ \t\u00a0]+/g, ' ')
    .split('\n').map(line => line.trim()).filter(Boolean).join('\n');
}
