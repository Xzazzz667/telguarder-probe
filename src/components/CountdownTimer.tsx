import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface TimeRemaining {
  hours: number;
  minutes: number;
  seconds: number;
}

export function CountdownTimer() {
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>({ hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const calculateTimeRemaining = (): TimeRemaining => {
      const now = new Date();
      
      // La routine tourne toutes les heures à la minute 0
      const nextRun = new Date(now);
      nextRun.setMinutes(0);
      nextRun.setSeconds(0);
      nextRun.setMilliseconds(0);
      
      // Si on a dépassé l'heure actuelle, passer à l'heure suivante
      if (nextRun <= now) {
        nextRun.setHours(nextRun.getHours() + 1);
      }
      
      const diff = nextRun.getTime() - now.getTime();
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      return { hours, minutes, seconds };
    };

    // Mise à jour initiale
    setTimeRemaining(calculateTimeRemaining());

    // Mise à jour toutes les secondes
    const interval = setInterval(() => {
      setTimeRemaining(calculateTimeRemaining());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (value: number): string => {
    return value.toString().padStart(2, '0');
  };

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-primary-glow/5 border-primary/20 shadow-[var(--shadow-sm)]">
      <div className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Clock className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-foreground mb-1">
              Prochaine mise à jour automatique
            </h3>
            <div className="flex items-center gap-2">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-primary tabular-nums">
                  {formatTime(timeRemaining.hours)}
                </span>
                <span className="text-xs text-muted-foreground">h</span>
              </div>
              <span className="text-xl text-muted-foreground">:</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-primary tabular-nums">
                  {formatTime(timeRemaining.minutes)}
                </span>
                <span className="text-xs text-muted-foreground">m</span>
              </div>
              <span className="text-xl text-muted-foreground">:</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-primary tabular-nums">
                  {formatTime(timeRemaining.seconds)}
                </span>
                <span className="text-xs text-muted-foreground">s</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
