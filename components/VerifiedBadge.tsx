import React from 'react';

interface VerifiedBadgeProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string | null;
}

export function VerifiedBadge({ size = 'md', className = '', label }: VerifiedBadgeProps) {
  const sizeMap = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 text-cyan-400 group relative ${className}`}
      title={label || 'ZEV Verified Official Account'}
    >
      <svg
        className={`${sizeMap[size]} drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]`}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M10.5213 2.62368C11.3147 1.75255 12.6853 1.75255 13.4787 2.62368L14.4944 3.73887C14.9006 4.18485 15.4851 4.42695 16.0886 4.39868L17.5979 4.32799C18.7772 4.27276 19.7272 5.22283 19.672 6.40212L19.6013 7.91144C19.573 8.51489 19.8151 9.09941 20.2611 9.50561L21.3763 10.5213C22.2475 11.3147 22.2475 12.6853 21.3763 13.4787L20.2611 14.4944C19.8151 14.9006 19.573 15.4851 19.6013 16.0886L19.672 17.5979C19.7272 18.7772 18.7772 19.7272 17.5979 19.672L16.0886 19.6013C15.4851 19.573 14.9006 19.8151 14.4944 20.2611L13.4787 21.3763C12.6853 22.2475 11.3147 22.2475 10.5213 21.3763L9.50561 20.2611C9.09941 19.8151 8.51489 19.573 7.91144 19.6013L6.40212 19.672C5.22283 19.7272 4.27276 18.7772 4.32799 17.5979L4.39868 16.0886C4.42695 15.4851 4.18485 14.9006 3.73887 14.4944L2.62368 13.4787C1.75255 12.6853 1.75255 11.3147 2.62368 10.5213L3.73887 9.50561C4.18485 9.09941 4.42695 8.51489 4.39868 7.91144L4.32799 6.40212C4.27276 5.22283 5.22283 4.27276 6.40212 4.32799L7.91144 4.39868C8.51489 4.42695 9.09941 4.18485 9.50561 3.73887L10.5213 2.62368Z"
          fill="url(#blueTickGradient)"
        />
        <path
          d="M8.5 12.2L11 14.7L15.8 9.5"
          stroke="white"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <defs>
          <linearGradient id="blueTickGradient" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
            <stop stopColor="#38BDF8" />
            <stop offset="1" stopColor="#0284C7" />
          </linearGradient>
        </defs>
      </svg>
    </span>
  );
}
