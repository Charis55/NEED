import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface UserAvatarProps {
  photoURL?: string | null;
  name?: string | null;
  className?: string;
}

export default function UserAvatar({ photoURL, name, className }: UserAvatarProps) {
  if (photoURL) {
    return (
      <img 
        src={photoURL} 
        alt={name || "User profile"} 
        className={cn("object-cover", className)} 
      />
    );
  }

  const initial = name ? name.charAt(0).toUpperCase() : '?';

  return (
    <div className={cn("flex items-center justify-center bg-[var(--color-brutal-yellow)] text-black font-black uppercase", className)}>
      {initial}
    </div>
  );
}
