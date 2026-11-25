import React from 'react';

export type ReactionType = 'like' | 'love' | 'haha' | 'wow' | 'buon' | 'huhu' | 'angry' | 'dislike' | 'sad' | null;

interface SvgIconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  color?: string;
}

/** 1. LIKE — Refined Architectural Thumbs-Up */
export const IconReactionLike: React.FC<SvgIconProps> = ({ size = 18, className, style, color = 'var(--color-primary)' }) => (
  <svg
    aria-hidden="true"
    focusable="false"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
  >
    <path d="M7 10v12" />
    <path
      d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"
      fill={color}
      fillOpacity={0.16}
    />
  </svg>
);

/** 2. LOVE — Refined Editorial Heart */
export const IconReactionLove: React.FC<SvgIconProps> = ({
  size = 18,
  className,
  style,
  color = 'var(--color-error-text, var(--color-error))',
}) => (
  <svg
    aria-hidden="true"
    focusable="false"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
  >
    <path
      d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
      fill={color}
      fillOpacity={0.2}
    />
  </svg>
);

/** 3. HAHA — Clean Minimalist Joy Face */
export const IconReactionHaha: React.FC<SvgIconProps> = ({ size = 18, className, style, color = 'var(--color-sun)' }) => (
  <svg
    aria-hidden="true"
    focusable="false"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
  >
    <circle cx="12" cy="12" r="9.5" fill={color} fillOpacity={0.15} />
    <path d="M8 14s1.5 2.5 4 2.5 4-2.5 4-2.5" />
    <path d="M8.5 9.5 10 10.5 8.5 11.5" />
    <path d="M15.5 9.5 14 10.5 15.5 11.5" />
  </svg>
);

/** 4. WOW — Alpine Star / Compass Spark */
export const IconReactionWow: React.FC<SvgIconProps> = ({ size = 18, className, style, color = 'var(--color-sky)' }) => (
  <svg
    aria-hidden="true"
    focusable="false"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
  >
    <path d="m12 3 2.1 5.9L20 11l-5.9 2.1L12 19l-2.1-5.9L4 11l5.9-2.1Z" fill={color} fillOpacity={0.18} />
  </svg>
);

/** 5. BUỒN — Minimalist Empathy Face */
export const IconReactionBuon: React.FC<SvgIconProps> = ({ size = 18, className, style, color = 'var(--color-stream)' }) => (
  <svg
    aria-hidden="true"
    focusable="false"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
  >
    <circle cx="12" cy="12" r="9.5" fill={color} fillOpacity={0.15} />
    <path d="M16 16s-1.5-2-4-2-4 2-4 2" />
    <line x1="9" y1="9.5" x2="9.01" y2="9.5" strokeWidth="2.4" />
    <line x1="15" y1="9.5" x2="15.01" y2="9.5" strokeWidth="2.4" />
  </svg>
);

/** 6. HUHU — Rain Cloud / Deep Sympathy */
export const IconReactionHuhu: React.FC<SvgIconProps> = ({ size = 18, className, style, color = 'var(--color-sky)' }) => (
  <svg
    aria-hidden="true"
    focusable="false"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
  >
    <path
      d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"
      fill={color}
      fillOpacity={0.14}
    />
    <path d="M8 19v2" />
    <path d="M12 17v4" />
    <path d="M16 19v2" />
  </svg>
);

/** 7. ANGRY — Intense Flame / Warning */
export const IconReactionAngry: React.FC<SvgIconProps> = ({ size = 18, className, style, color = 'var(--color-earth)' }) => (
  <svg
    aria-hidden="true"
    focusable="false"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
  >
    <path
      d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"
      fill={color}
      fillOpacity={0.18}
    />
  </svg>
);

/** 8. DISLIKE — Architectural Thumbs-Down */
export const IconReactionDislike: React.FC<SvgIconProps> = ({ size = 18, className, style, color = 'var(--color-text-muted)' }) => (
  <svg
    aria-hidden="true"
    focusable="false"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
  >
    <path d="M17 14V2" />
    <path
      d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"
      fill={color}
      fillOpacity={0.14}
    />
  </svg>
);

/** Unified Dynamic SVG Reaction Component */
export const TrekReactionSvg: React.FC<{
  name: ReactionType | string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  color?: string;
}> = ({ name, size = 18, className, style, color }) => {
  switch (name) {
    case 'like':
      return <IconReactionLike size={size} className={className} style={style} color={color} />;
    case 'love':
      return <IconReactionLove size={size} className={className} style={style} color={color} />;
    case 'haha':
      return <IconReactionHaha size={size} className={className} style={style} color={color} />;
    case 'wow':
      return <IconReactionWow size={size} className={className} style={style} color={color} />;
    case 'buon':
    case 'sad':
      return <IconReactionBuon size={size} className={className} style={style} color={color} />;
    case 'huhu':
      return <IconReactionHuhu size={size} className={className} style={style} color={color} />;
    case 'angry':
      return <IconReactionAngry size={size} className={className} style={style} color={color} />;
    case 'dislike':
      return <IconReactionDislike size={size} className={className} style={style} color={color} />;
    default:
      return <IconReactionLike size={size} className={className} style={style} color={color} />;
  }
};
