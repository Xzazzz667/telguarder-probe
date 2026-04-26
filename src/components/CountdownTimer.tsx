import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

interface TimeRemaining {
  hours: number;
  minutes: number;
  seconds: number;
}

const INTERVAL_MS = 36 * 60 * 60 * 1000; // 36 heures

export function CountdownTimer() {
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>({ hours: 36, minutes: 0, seconds: 0 });
  const [nextRun, setNextRun] = useState<Date | null>(null);

  // Charger la dernière exécution depuis la base pour calculer la prochaine (last + 36h)
  useEffect(() => {
    const loadNextRun = async () => {
      const { data, error } = await supabase
        .from('scrape_schedule_state' as any)
        .select('last_run_at')
        .eq('id', 1)
        .maybeSingle();

      if (error) {
        console.warn('CountdownTimer: cannot read schedule state', error);
        // Fallback : maintenant + 36h
        setNextRun(new Date(Date.now() + INTERVAL_MS));
        return;
      }

      const last = (data as any)?.last_run_at ? new Date((data as any).last_run_at) : null;
      if (last) {
        setNextRun(new Date(last.getTime() + INTERVAL_MS));
      } else {
        setNextRun(new Date(Date.now() + INTERVAL_MS));
      }
    };

    loadNextRun();
    // Recharger toutes les 2 minutes au cas où le job s'est déclenché
    const refresh = setInterval(loadNextRun, 120000);
    return () => clearInterval(refresh);
  }, []);

  useEffect(() => {
    if (!nextRun) return;

    const tick = () => {
      const diff = Math.max(0, nextRun.getTime() - Date.now());
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeRemaining({ hours, minutes, seconds });
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [nextRun]);

  const formatTime = (value: number): string => value.toString().padStart(2, '0');

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-primary-glow/5 border-primary/20 shadow-[var(--shadow-sm)]">
      <div className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Clock className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-foreground mb-1">
              Prochaine mise à jour automatique (toutes les 36h)
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
