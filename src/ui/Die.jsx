import React from 'react';

// A twenty-sided die seen face on.
export function Die({ die, selected, spent, rolling, onClick, children, label }) {
  const consistent = die.parts.length === 3;
  // A die that cannot be pressed is drawn as a plain element, so it can sit inside a button.
  const Tag = onClick ? 'button' : 'span';
  const props = onClick
    ? { type: 'button', 'aria-pressed': selected ? 'true' : 'false', 'aria-label': label ?? `Die showing ${die.value}`, onClick }
    : { role: 'img', 'aria-label': label ?? `Die showing ${die.value}`, 'aria-pressed': selected ? 'true' : undefined };
  return (
    <Tag className={`die ${spent ? 'spent' : ''} ${rolling ? 'rolling' : ''}`} {...props}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <polygon className="face" points="50,3 91,26 91,74 50,97 9,74 9,26" />
        <polygon className="facet" points="50,20 78,68 22,68" />
        <path className="facet" d="M50 3 L50 20 M91 26 L78 68 M9 26 L22 68 M50 97 L22 68 M50 97 L78 68 M9 26 L50 20 L91 26 M9 74 L22 68 M91 74 L78 68" />
      </svg>
      <b>{die.value}</b>
      {consistent || die.lucky ? (
        <small>
          {consistent ? die.parts.join('+') : null}
          {die.lucky ? ' +1' : ''}
        </small>
      ) : null}
      {children}
    </Tag>
  );
}
