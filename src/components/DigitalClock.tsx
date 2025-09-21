import React, { useState, useEffect } from 'react';

const DigitalClock: React.FC = () => {
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('pl-PL', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('pl-PL', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="text-center">
      <div className="text-lg font-mono font-semibold text-gray-800">
        {formatTime(currentTime)}
      </div>
      <div className="text-sm text-gray-600">
        {formatDate(currentTime)}
      </div>
    </div>
  );
};

export default DigitalClock;
