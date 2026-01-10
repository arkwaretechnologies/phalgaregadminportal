'use client';

import React from 'react';

type LoadingSpinnerProps = {
  className?: string;
  label?: string;
};

export default function LoadingSpinner({ className, label }: LoadingSpinnerProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className || ''}`}>
      <svg
        className="h-4 w-4 animate-spin text-current"
        viewBox="0 0 24 24"
        aria-hidden={label ? undefined : true}
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
        />
      </svg>
      {label ? <span className="text-sm">{label}</span> : null}
    </span>
  );
}

