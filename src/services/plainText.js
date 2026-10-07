// Archive.org descriptions are the uploader's HTML. The site shows them as text: line breaks
// kept, every tag dropped (never rendered), the common entities decoded (names are case-sensitive in HTML: &Eacute; and &eacute; differ).
const MAX = 20000; // longer than any real description; keeps a hostile one from freezing the page
// HTML entity suffix to combining mark: Caf&eacute; = e + acute
const ACCENTS = { acute: '\u0301', grave: '\u0300', circ: '\u0302', uml: '\u0308', tilde: '\u0303', cedil: '\u0327' };
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'",
  copy: '\u00a9', reg: '\u00ae', trade: '\u2122', mdash: '\u2014', ndash: '\u2013', hellip: '\u2026',
  lsquo: '\u2018', rsquo: '\u2019', ldquo: '\u201c', rdquo: '\u201d', laquo: '\u00ab', raquo: '\u00bb',
  bull: '\u2022', middot: '\u00b7', deg: '\u00b0', times: '\u00d7', frac12: '\u00bd', euro: '\u20ac', pound: '\u00a3',
  // accented letters: the base letter plus the entity's accent suffix
  ...Object.fromEntries([...'AEIOUaeiouNnCcYy'].flatMap(l => Object.entries(ACCENTS).flatMap(([suffix, mark]) => {
    const ch = (l + mark).normalize('NFC');
    return ch.length === 1 && ch !== l + mark ? [[l + suffix, ch]] : [];
  }))) };

export function plainText(value) {
  if (value == null) return '';
  const html = (Array.isArray(value) ? value.join('\n') : String(value)).slice(0, MAX);
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>|<(p|div)\b[^>]*>|<\/(p|div|li|h\d)>/gi, '\n')
    .replace(/<(?:"[^"<]*"|'[^'<]*'|[^<>"'])*>/g, '') // never scans past the next '<', so an unclosed one costs nothing
    .replace(/&(#\d+|#x[0-9a-f]+|\w+);/gi, (all, name) => {
      if (name[0] === '#') {
        const code = name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1));
        return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ''; // past Unicode: dropped, not thrown
      }
      return Object.hasOwn(ENTITIES, name) ? ENTITIES[name] : Object.hasOwn(ENTITIES, name.toLowerCase()) && /^(amp|lt|gt|quot|apos|nbsp)$/i.test(name) ? ENTITIES[name.toLowerCase()] : all;
    })
    .replace(/[ \t\u00a0]+/g, ' ')
    .split('\n').map(line => line.trim()).filter(Boolean).join('\n');
}
