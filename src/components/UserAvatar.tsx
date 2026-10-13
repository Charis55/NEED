"use client";

import React, { useState, useEffect } from 'react';
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
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [photoURL]);

  if (photoURL && !hasError) {
    return (
      <img 
        src={photoURL} 
        alt={name || "User profile"} 
        className={cn("object-cover w-full h-full", className)} 
        onError={() => setHasError(true)}
      />
    );
  }

  const initial = name?.trim() ? name.trim().charAt(0).toUpperCase() : '?';

  return (
    <div className={cn("flex items-center justify-center bg-[var(--color-brutal-yellow)] text-black font-black uppercase select-none", className)}>
      {initial}
    </div>
  );
}
