import React from 'react';

// One button. variant: primary (signal), light (bone), ghost (outline). size: md | lg.
// Renders an <a> when given href, otherwise a <button>.
export default function Button({ variant = 'primary', size = 'md', href, children, className = '', ...rest }) {
  const cls = `btn-${variant} ${size === 'lg' ? 'btn-lg' : ''} ${className}`.trim();
  if (href) return <a href={href} className={cls} {...rest}>{children}</a>;
  return <button type="button" className={cls} {...rest}>{children}</button>;
}
