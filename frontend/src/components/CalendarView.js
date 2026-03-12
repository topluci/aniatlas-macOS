import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Grid3X3,
  List,
  Globe,
} from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  isToday,
} from 'date-fns';

// Status → accent colour (border + dot)
const STATUS_STYLE = {
  FIRST_EPISODE: { border: 'ring-yellow-500', dot: 'bg-yellow-400', label: 'First Episode' },
  AIRING_NOW:    { border: 'ring-green-500',  dot: 'bg-green-400',  label: 'Airing Now' },
  UPCOMING:      { border: 'ring-sky-500',     dot: 'bg-sky-400',    label: 'Upcoming' },
  COMPLETED:     { border: 'ring-purple-400',  dot: 'bg-purple-400', label: 'Completed' },
};

function getStatus(schedule) {
  const now = Date.now();
  const t = schedule.airingAt * 1000;
  if (schedule.episode === 1) return 'FIRST_EPISODE';
  if (Math.abs(t - now) < 60 * 60 * 1000) return 'AIRING_NOW';
  if (t < now) return 'COMPLETED';
  return 'UPCOMING';
}

export function CalendarView({ schedules }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('monthly');

  const schedulesByDate = useMemo(() => {
    const grouped = {};
    schedules.forEach((s) => {
      const key = format(new Date(s.airingAt * 1000), 'yyyy-MM-dd');
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(s);
    });
    return grouped;
  }, [schedules]);

  const days = useMemo(() => {
    if (view === 'monthly') {
      return eachDayOfInterval({
        start: startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 }),
        end: endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 }),
      });
    }
    return eachDayOfInterval({
      start: startOfWeek(currentDate, { weekStartsOn: 0 }),
      end: endOfWeek(currentDate, { weekStartsOn: 0 }),
    });
  }, [currentDate, view]);

  const nav = (dir) => {
    if (view === 'monthly') setCurrentDate(dir === 'next' ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
    else setCurrentDate(dir === 'next' ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
  };

  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <Card className="bg-card border-border/50" data-testid="calendar-view">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarIcon className="h-4 w-4 text-primary" />
              {view === 'monthly'
                ? format(currentDate, 'MMMM yyyy')
                : `Week of ${format(startOfWeek(currentDate), 'MMM d, yyyy')}`}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <Globe className="h-3 w-3" />{userTimezone}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Tabs value={view} onValueChange={setView} className="hidden sm:block">
              <TabsList className="h-8">
                <TabsTrigger value="monthly" className="text-xs px-3" data-testid="view-monthly">
                  <Grid3X3 className="h-3 w-3 mr-1" />Month
                </TabsTrigger>
                <TabsTrigger value="weekly" className="text-xs px-3" data-testid="view-weekly">
                  <List className="h-3 w-3 mr-1" />Week
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => nav('prev')} data-testid="calendar-prev">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setCurrentDate(new Date())} data-testid="calendar-today">
                Today
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => nav('next')} data-testid="calendar-next">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Legend — coloured dots */}
        <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t border-border/40">
          <span className="text-xs text-muted-foreground">Legend:</span>
          {Object.entries(STATUS_STYLE).map(([key, s]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${s.dot}`} />
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </div>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <TooltipProvider>
          <div className={`grid grid-cols-7 gap-2 ${view === 'weekly' ? 'auto-rows-[280px]' : 'auto-rows-[130px]'}`}>
            {days.map((day) => {
              const key = format(day, 'yyyy-MM-dd');
              const slots = schedulesByDate[key] || [];
              const inMonth = view === 'weekly' || isSameMonth(day, currentDate);
              const today = isToday(day);

              return (
                <div
                  key={key}
                  className={`
                    relative p-2 rounded-lg border overflow-hidden
                    ${inMonth ? 'bg-card border-border/30' : 'bg-muted/20 border-transparent'}
                    ${today ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''}
                  `}
                  data-testid={`calendar-day-${key}`}
                >
                  {/* Day number */}
                  <p className={`text-xs font-semibold mb-1.5 ${today ? 'text-primary' : inMonth ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {format(day, 'd')}
                  </p>

                  {/* Vertical stack of posters — max 2 shown */}
                  <div className="flex flex-col gap-1 overflow-hidden" style={{ maxHeight: 'calc(100% - 24px)' }}>
                    {slots.slice(0, 2).map((s) => (
                      <PosterItem key={s.id} schedule={s} />
                    ))}
                  </div>

                  {/* "+X more" text, not a badge */}
                  {slots.length > 2 && (
                    <p className="absolute bottom-1 left-0 right-0 text-center text-[9px] text-muted-foreground">
                      +{slots.length - 2} more
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}

function PosterItem({ schedule }) {
  const title = schedule.title_english || schedule.title_romaji;
  const status = getStatus(schedule);
  const style = STATUS_STYLE[status];
  const airTime = format(new Date(schedule.airingAt * 1000), 'h:mm a');

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          onClick={() => window.open(`https://anilist.co/anime/${schedule.mediaId}`, '_blank', 'noopener,noreferrer')}
          className={`group relative flex items-center gap-1.5 rounded cursor-pointer hover:bg-muted/50 transition-colors p-0.5`}
          data-testid={`schedule-item-${schedule.id}`}
        >
          {/* Coloured status bar on left edge */}
          <div className={`w-0.5 self-stretch rounded-full flex-shrink-0 ${style.dot}`} />

          {/* Poster thumbnail */}
          <div className={`relative flex-shrink-0 w-7 h-10 rounded overflow-hidden ring-1 ${style.border}`}>
            <img
              src={schedule.coverImage}
              alt={title}
              loading="lazy"
              className="w-full h-full object-cover"
            />
            {status === 'AIRING_NOW' && (
              <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            )}
          </div>

          {/* Episode + time text */}
          <div className="flex-1 min-w-0 overflow-hidden">
            <p className="text-[9px] font-medium text-foreground/90 leading-tight truncate">Ep {schedule.episode}</p>
            <p className="text-[8px] text-muted-foreground leading-tight">{airTime}</p>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[200px]">
        <p className="font-semibold text-sm">{title}</p>
        <p className="text-xs text-muted-foreground">Episode {schedule.episode} · {airTime}</p>
        <p className="text-xs text-primary mt-1">Open on AniList ↗</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function CalendarSkeleton() {
  return (
    <Card className="bg-card border-border/50">
      <CardHeader>
        <div className="h-6 w-40 bg-muted animate-pulse rounded" />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="h-[130px] bg-muted/50 animate-pulse rounded-lg" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
