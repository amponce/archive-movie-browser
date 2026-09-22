import React from 'react';

// A row on a page: eyebrow, title, one line of why, and an optional "more" link on the right.
export default function Section({ id, eyebrow, title, blurb, more, href, children }) {
  return (
    <section id={id} className="section">
      <div className="flex items-end justify-between gap-6">
        <div className="flex flex-col gap-1.5 min-w-0">
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h2 className="display text-3xl sm:text-4xl">{title}</h2>
          {blurb && <p className="text-[15px] text-muted">{blurb}</p>}
        </div>
        {more && (
          <a href={href} className="nav-link shrink-0 flex items-center gap-2 min-h-[44px] hover:text-signal">
            {more} <span aria-hidden="true">→</span>
          </a>
        )}
      </div>
      {children}
    </section>
  );
}

// Six across on a desktop, three on a tablet, two on a phone
export function CardGrid({ children }) {
  return <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 sm:gap-6">{children}</div>;
}
