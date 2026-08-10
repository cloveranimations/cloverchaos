'use client';

import type { IconId } from './config';

/** Chunky, pixel-flavoured glyphs for tech nodes and ball cards. */
export default function Icon({ id, color, size = 22 }: { id: IconId; color: string; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: 'square' as const,
    strokeLinejoin: 'miter' as const,
    shapeRendering: 'geometricPrecision' as const,
  };

  switch (id) {
    case 'sword':
      return (
        <svg {...common}>
          <path d="M20 3 L20 8 L9 19 L5 19 L5 15 Z" fill={color} stroke="none" />
          <path d="M12 12 L16 16" />
          <path d="M4 20 L7 17" />
        </svg>
      );
    case 'comet':
      return (
        <svg {...common}>
          <circle cx="16.5" cy="16.5" r="3.5" fill={color} stroke="none" />
          <path d="M4 6 L10 12" />
          <path d="M8 4 L13 9" />
          <path d="M3 11 L7 15" />
        </svg>
      );
    case 'spread':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" fill={color} stroke="none" />
          <path d="M12 7 L12 2 M12 17 L12 22 M7 12 L2 12 M17 12 L22 12" />
          <path d="M12 2 L9.5 4.5 M12 2 L14.5 4.5 M12 22 L9.5 19.5 M12 22 L14.5 19.5" />
          <path d="M2 12 L4.5 9.5 M2 12 L4.5 14.5 M22 12 L19.5 9.5 M22 12 L19.5 14.5" />
        </svg>
      );
    case 'ball':
      return (
        <svg {...common}>
          <circle cx="10.5" cy="13.5" r="6.5" fill={color} stroke="none" />
          <path d="M18 3 L18 9 M15 6 L21 6" strokeWidth={2} />
        </svg>
      );
    case 'bolt':
      return (
        <svg {...common}>
          <path d="M14 2 L6 13 L11 13 L9 22 L18 10 L13 10 Z" fill={color} stroke="none" />
        </svg>
      );
    case 'skull':
      return (
        <svg {...common}>
          <path d="M5 11 A7 7 0 0 1 19 11 L19 14 A3 3 0 0 1 16 17 L8 17 A3 3 0 0 1 5 14 Z" fill={color} stroke="none" />
          <circle cx="9.5" cy="11" r="2" fill="#000" stroke="none" />
          <circle cx="14.5" cy="11" r="2" fill="#000" stroke="none" />
          <path d="M9 18 L9 21 M12 18 L12 21 M15 18 L15 21" strokeWidth={1.8} />
        </svg>
      );
    case 'radar':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" strokeWidth={1.8} />
          <circle cx="12" cy="12" r="4.5" strokeWidth={1.8} />
          <circle cx="12" cy="12" r="1.6" fill={color} stroke="none" />
          <path d="M12 12 L19 6" strokeWidth={1.8} />
        </svg>
      );
    case 'flag':
      return (
        <svg {...common}>
          <path d="M7 3 L7 21" />
          <path d="M7 4 L18 7.5 L7 11 Z" fill={color} stroke="none" />
        </svg>
      );
    case 'clock':
      return (
        <svg {...common}>
          <path d="M6 3 L18 3 M6 21 L18 21" />
          <path d="M7 3 L17 3 L12 12 L17 21 L7 21 L12 12 Z" fill={color} stroke="none" />
        </svg>
      );
    case 'core':
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" strokeWidth={2} />
          <circle cx="12" cy="12" r="3" fill={color} stroke="none" />
        </svg>
      );
  }
}
