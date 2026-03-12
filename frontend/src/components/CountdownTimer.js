import { useState, useEffect } from 'react';

// Helper function to calculate time left
const calculateTimeLeft = (timestamp) => {
  const difference = timestamp * 1000 - Date.now();
  
  if (difference <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  }

  const isAiringSoon = difference < 60 * 60 * 1000;

  return {
    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
    hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((difference / 1000 / 60) % 60),
    seconds: Math.floor((difference / 1000) % 60),
    expired: false,
    isAiringSoon
  };
};

const calculateCompactTimeLeft = (timestamp) => {
  const difference = timestamp * 1000 - Date.now();
  
  if (difference <= 0) {
    return { text: 'Airing Now', expired: true };
  }

  const days = Math.floor(difference / (1000 * 60 * 60 * 24));
  const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((difference / 1000 / 60) % 60);

  if (days > 0) {
    return { text: `${days}d ${hours}h`, expired: false };
  } else if (hours > 0) {
    return { text: `${hours}h ${minutes}m`, expired: false };
  } else {
    return { text: `${minutes}m`, expired: false };
  }
};

export function CountdownTimer({ airingAt, className = '' }) {
  const [timeLeft, setTimeLeft] = useState(() => calculateTimeLeft(airingAt));

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(airingAt));
    }, 1000);

    return () => clearInterval(timer);
  }, [airingAt]);

  if (timeLeft.expired) {
    return <span className={`text-green-500 font-bold ${className}`}>Airing Now</span>;
  }

  return (
    <div className={`flex items-center gap-1 font-mono ${className}`}>
      {timeLeft.days > 0 && (
        <>
          <TimeUnit value={timeLeft.days} label="d" />
          <span className="text-muted-foreground">:</span>
        </>
      )}
      <TimeUnit value={timeLeft.hours} label="h" />
      <span className="text-muted-foreground">:</span>
      <TimeUnit value={timeLeft.minutes} label="m" />
      <span className="text-muted-foreground">:</span>
      <TimeUnit value={timeLeft.seconds} label="s" />
    </div>
  );
}

function TimeUnit({ value, label }) {
  return (
    <div className="flex items-baseline">
      <span className="text-foreground font-bold">{String(value).padStart(2, '0')}</span>
      <span className="text-xs text-muted-foreground ml-0.5">{label}</span>
    </div>
  );
}

export function CompactCountdown({ airingAt }) {
  const [timeLeft, setTimeLeft] = useState(() => calculateCompactTimeLeft(airingAt));

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateCompactTimeLeft(airingAt));
    }, 1000);

    return () => clearInterval(timer);
  }, [airingAt]);

  if (timeLeft.expired) {
    return <span className="text-xs font-bold text-green-500">Airing Now</span>;
  }

  return (
    <span className="text-xs font-medium text-muted-foreground">
      {timeLeft.text}
    </span>
  );
}
