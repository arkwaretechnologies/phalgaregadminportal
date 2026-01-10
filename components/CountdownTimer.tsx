'use client';

import { useState, useEffect } from 'react';

interface CountdownTimerProps {
  registrationDate: string | null;
  status: string | null;
}

export default function CountdownTimer({
  registrationDate,
  status,
}: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<string>('--:--:--');
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    // Reset the expired flag when status or registration date changes
    setIsExpired(false);
    
    // Normalize status to uppercase for comparison
    const normalizedStatus = status?.toUpperCase() || null;
    
    if (!registrationDate || normalizedStatus !== 'PENDING') {
      setTimeLeft('--:--:--');
      return;
    }

    const updateTimer = () => {
      const registrationTime = new Date(registrationDate).getTime();
      const now = new Date().getTime();
      const deadline = registrationTime + 24 * 60 * 60 * 1000; // 24 hours in milliseconds
      const difference = deadline - now;

      if (difference <= 0) {
        setIsExpired(true);
        setTimeLeft('EXPIRED');
        return;
      }

      const hours = Math.floor(difference / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft(
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      );
      setIsExpired(false);
    };

    // Update immediately
    updateTimer();

    // Update every second
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [registrationDate, status]);

  // Normalize status to uppercase for comparison
  const normalizedStatus = status?.toUpperCase() || null;
  
  if (!registrationDate || normalizedStatus !== 'PENDING') {
    return <span className="text-sm text-gray-400">-</span>;
  }

  if (isExpired) {
    return (
      <span className="text-sm font-semibold text-red-600 animate-pulse">
        EXPIRED
      </span>
    );
  }

  // Determine color based on time remaining
  const hours = parseInt(timeLeft.split(':')[0]);
  let colorClass = 'text-green-600';
  if (hours < 2) {
    colorClass = 'text-red-600 font-semibold';
  } else if (hours < 6) {
    colorClass = 'text-yellow-600 font-medium';
  }

  return (
    <span className={`text-sm font-mono ${colorClass}`}>
      {timeLeft}
    </span>
  );
}
