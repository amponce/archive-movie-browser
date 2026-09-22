# UI

Three layers. Pages compose, primitives style, tokens define.

- **Tokens** are in `tailwind.config.js`: colours (`ink`, `bone`, `signal`, `line`, `muted`, `dim`, `panel`, `nitrate`) and type (`font-display`, `font-sans`, `font-mono`). Nothing else defines a colour or a family.
- **Shapes** are in `src/index.css` under `@layer components`: `.btn-*`, `.display`, `.eyebrow`, `.label`, `.field`, `.panel`, `.film-frame`, `.section`, `.gutter`. A visual change to a button is a change to one line there.
- **Primitives** live here: `Button`, `Section`, `FilmCard`, `SearchField`. They take content and behaviour, not class names.
- **Layout** is `src/layout/SiteHeader` and `SiteFooter`, on every page.

Pages under `src/pages` and the film browser compose these. If you find yourself writing a long `className` in a page, it belongs in a primitive or in `index.css`.
