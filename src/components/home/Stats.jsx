import React from 'react';

const fmt = n => n.toLocaleString('en-US');

// The real numbers. `cells` is [[number, label, highlight?], ...]
export default function Stats({ cells }) {
  return (
    <section className="rule grid grid-cols-2 lg:grid-cols-4">
      {cells.map(([n, label, hot], i) => (
        <div key={label} className={`flex flex-col gap-1 px-4 sm:px-8 lg:px-10 py-6 border-line ${i % 2 === 0 ? 'border-r' : ''} ${i < 2 ? 'border-b lg:border-b-0' : ''} ${i === 2 ? 'lg:border-r' : ''}`}>
          <span className={`font-display font-extrabold text-4xl sm:text-[44px] leading-none tabular-nums ${hot ? 'text-signal' : ''}`}>{fmt(n)}</span>
          <span className="label">{label}</span>
        </div>
      ))}
    </section>
  );
}
