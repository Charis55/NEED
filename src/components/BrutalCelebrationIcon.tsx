import React from "react";

interface BrutalCelebrationIconProps {
  className?: string;
  size?: number;
}

/**
 * Context-specific Neo-brutalist celebration icon depicting full job completion.
 * Features hard black outlines, geometric confetti stars, diamonds, streamers,
 * and a celebration party horn with flat brutalist fills (no cheap emojis).
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
      {/* Confetti Zig-zag streamer */}
      <path
        d="M38 20L44 14L41 8L48 4"
        stroke="#000"
        strokeWidth="2.5"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      {/* Secondary streamer */}
      <path
        d="M48 28L56 26L54 20L60 17"
        stroke="#000"
        strokeWidth="2.5"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />

      {/* 4-point brutalist star (Yellow) */}
      <path
        d="M46 6L47.5 12L53.5 13.5L47.5 15L46 21L44.5 15L38.5 13.5L44.5 12Z"
        fill="#FFE600"
        stroke="#000"
        strokeWidth="2"
        strokeLinejoin="miter"
      />

      {/* 4-point brutalist star (Cyan) */}
      <path
        d="M26 8L27 12L31 13L27 14L26 18L25 14L21 13L25 12Z"
        fill="#00F0FF"
        stroke="#000"
        strokeWidth="2"
        strokeLinejoin="miter"
      />

      {/* Diamond confetti (Pink) */}
      <rect
        x="51"
        y="32"
        width="6"
        height="6"
        transform="rotate(45 51 32)"
        fill="#FF6B8B"
        stroke="#000"
        strokeWidth="2"
      />
      {/* Diamond confetti (Green) */}
      <rect
        x="32"
        y="2"
        width="5"
        height="5"
        transform="rotate(25 32 2)"
        fill="#4ADE80"
        stroke="#000"
        strokeWidth="2"
      />

      {/* Confetti Dots */}
      <circle cx="20" cy="18" r="2" fill="#000" />
      <circle cx="58" cy="28" r="2" fill="#000" />
      <circle cx="40" cy="28" r="2.5" fill="#FFE600" stroke="#000" strokeWidth="1.5" />

      {/* Party Popper Cone Base (Yellow) */}
      <path
        d="M10 54L34 30L42 38L18 62L10 54Z"
        fill="#FFE600"
        stroke="#000"
        strokeWidth="2.5"
        strokeLinejoin="miter"
      />

      {/* Middle Stripe (Pink) */}
      <path
        d="M18 46L30 34L36 40L24 52L18 46Z"
        fill="#FF6B8B"
        stroke="#000"
        strokeWidth="2.5"
        strokeLinejoin="miter"
      />

      {/* Horn Mouth Rim (Cyan) */}
      <ellipse
        cx="38"
        cy="34"
        rx="6"
        ry="4"
        transform="rotate(-45 38 34)"
        fill="#00F0FF"
        stroke="#000"
        strokeWidth="2.5"
      />
    </svg>
  );
}
