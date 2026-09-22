import React from 'react';

// One button. variant: primary (signal), light (bone), ghost (outline). size: md | lg.
// Renders an <a> when given href, otherwise a <button>.
// Class names are spelled out so Tailwind sees them: a template string would be purged.
const VARIANTS = { primary: 'btn-primary', light: 'btn-light', ghost: 'btn-ghost' };

export default function Button({ variant = 'primary', size = 'md', href, children, className = '', ...rest }) {
  const cls = `${VARIANTS[variant] || VARIANTS.primary} ${size === 'lg' ? 'btn-lg' : ''} ${className}`.trim();
  if (href) return <a href={href} className={cls} {...rest}>{children}</a>;
  return <button type="button" className={cls} {...rest}>{children}</button>;
}
