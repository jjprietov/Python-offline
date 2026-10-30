import React from 'react';

interface PythonLogoProps {
  className?: string;
}

export function PythonLogo({ className = "w-7 h-7" }: PythonLogoProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 110 110"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Python Logo"
    >
      <defs>
        <linearGradient id="python-blue-grad" x1="15%" y1="15%" x2="85%" y2="85%">
          <stop offset="0%" stopColor="#387EB8" />
          <stop offset="100%" stopColor="#306998" />
        </linearGradient>
        <linearGradient id="python-yellow-grad" x1="15%" y1="15%" x2="85%" y2="85%">
          <stop offset="0%" stopColor="#FFE873" />
          <stop offset="100%" stopColor="#FFD43B" />
        </linearGradient>
        <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodOpacity="0.25" />
        </filter>
      </defs>
      {/* Blue Snake */}
      <path
        d="M54.2 2C27.9 2 29.5 13.4 29.5 13.4L29.6 25.2H54.7V28.8H19.7C19.7 28.8 2 26.8 2 53.6C2 80.4 17.5 79.5 17.5 79.5H26.8V66.5C26.8 66.5 26.3 50.8 42.4 50.8H67.6C67.6 50.8 82.2 51.3 82.2 37.1V15.7C82.2 15.7 84.3 2 54.2 2ZM40.3 9.8C43.1 9.8 45.4 12.1 45.4 14.9C45.4 17.7 43.1 20 40.3 20C37.5 20 35.2 17.7 35.2 14.9C35.2 12.1 37.5 9.8 40.3 9.8Z"
        fill="url(#python-blue-grad)"
        filter="url(#shadow)"
      />
      {/* Yellow Snake */}
      <path
        d="M55.8 108C82.1 108 80.5 96.6 80.5 96.6L80.4 84.8H55.3V81.2H90.3C90.3 81.2 108 83.2 108 56.4C108 29.6 92.5 30.5 92.5 30.5H83.2V43.5C83.2 43.5 83.7 59.2 67.6 59.2H42.4C42.4 59.2 27.8 58.7 27.8 72.9V94.3C27.8 94.3 25.7 108 55.8 108ZM69.7 100.2C66.9 100.2 64.6 97.9 64.6 95.1C64.6 92.3 66.9 90 69.7 90C72.5 90 74.8 92.3 74.8 95.1C74.8 97.9 72.5 100.2 69.7 100.2Z"
        fill="url(#python-yellow-grad)"
        filter="url(#shadow)"
      />
    </svg>
  );
}
