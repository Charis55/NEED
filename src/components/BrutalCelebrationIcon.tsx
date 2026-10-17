import React from "react";

interface BrutalCelebrationIconProps {
  className?: string;
  size?: number;
}

/**
 * Context-specific Neo-brutalist celebration icon depicting full job completion.
 * Features a bold golden victory trophy with handles, a prominent completion checkmark,
 * geometric pedestal base, and celebratory sparkle stars with thick 3.5px black outlines.
 */
export default function BrutalCelebrationIcon({ className = "w-8 h-8", size }: BrutalCelebrationIconProps) {
  const style = size ? { width: size, height: size } : undefined;

  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {/* Celebration Star - Top Left */}
      <path
        d="M9 3L11 8L16 10L11 12L9 17L7 12L2 10L7 8Z"
        fill="#FFE600"
        stroke="#000"
        strokeWidth="2"
        strokeLinejoin="miter"
      />

      {/* Celebration Star - Top Right */}
      <path
        d="M55 3L57 8L62 10L57 12L55 17L53 12L48 10L53 8Z"
        fill="#00F0FF"
        stroke="#000"
        strokeWidth="2"
        strokeLinejoin="miter"
      />

      {/* Confetti spark dots */}
      <circle cx="8" cy="38" r="2.5" fill="#000" />
      <circle cx="56" cy="38" r="2.5" fill="#000" />
      <circle cx="15" cy="52" r="2" fill="#FF6B8B" stroke="#000" strokeWidth="1.5" />
      <circle cx="49" cy="52" r="2" fill="#00F0FF" stroke="#000" strokeWidth="1.5" />

      {/* Left Trophy Handle */}
      <path
        d="M20 18C11 18 8 28 19 32"
        stroke="#000"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* Right Trophy Handle */}
      <path
        d="M44 18C53 18 56 28 45 32"
        stroke="#000"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* Trophy Chalice / Cup Body */}
      <path
        d="M19 14C19 28 25 36 32 36C39 36 45 28 45 14H19Z"
        fill="#FFE600"
        stroke="#000"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />

      {/* Trophy Rim */}
      <rect
        x="17"
        y="10"
        width="30"
        height="5"
        fill="#FFE600"
        stroke="#000"
        strokeWidth="3.5"
      />

      {/* Victory / Completion Checkmark in center of cup */}
      <path
        d="M26 23L30 27L38 18"
        stroke="#000"
        strokeWidth="3.5"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />

      {/* Trophy Stem */}
      <rect
        x="28"
        y="36"
        width="8"
        height="9"
        fill="#FF6B8B"
        stroke="#000"
        strokeWidth="3"
      />

      {/* Trophy Pedestal Tier 1 */}
      <rect
        x="22"
        y="45"
        width="20"
        height="6"
        fill="#00F0FF"
        stroke="#000"
        strokeWidth="3"
      />

      {/* Trophy Base Tier 2 */}
      <rect
        x="14"
        y="51"
        width="36"
        height="7"
        fill="#000"
        stroke="#000"
        strokeWidth="2"
      />
    </svg>
  );
}
