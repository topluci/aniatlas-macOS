import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { CountdownTimer } from './CountdownTimer';
import { Clock } from 'lucide-react';

export function NextEpisodeCard({ schedules, loading }) {
  const nextEpisode = schedules && schedules.length > 0
    ? schedules.reduce((closest, current) => {
        if (!closest) return current;
        return current.airingAt < closest.airingAt ? current : closest;
      }, null)
    : null;

  if (loading) return <NextEpisodeCardSkeleton />;

  if (!nextEpisode) {
    return (
      <Card className="bg-card border-border/50" data-testid="next-episode-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Clock className="h-4 w-4 text-primary" />
            Next Episode
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No upcoming episodes in your watchlist.</p>
        </CardContent>
      </Card>
    );
  }

  const title = nextEpisode.title_english || nextEpisode.title_romaji;

  return (
    <Card className="bg-card border-border/50" data-testid="next-episode-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Clock className="h-4 w-4 text-primary" />
          Next Episode
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="flex gap-3">
          {/* Smaller cover image */}
          <img
            src={nextEpisode.coverImage}
            alt={title}
            className="w-14 h-20 object-cover rounded flex-shrink-0"
          />

          {/* Info — clean text, no badges or glows */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm leading-snug line-clamp-2 mb-1">{title}</h3>
            <p className="text-xs text-muted-foreground mb-3">Episode {nextEpisode.episode}</p>

            <p className="text-xs text-muted-foreground mb-1">Airs in</p>
            <CountdownTimer airingAt={nextEpisode.airingAt} className="text-base" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function NextEpisodeCardSkeleton() {
  return (
    <Card className="bg-card border-border/50">
      <CardHeader>
        <div className="h-5 w-28 bg-muted animate-pulse rounded" />
      </CardHeader>
      <CardContent>
        <div className="flex gap-3">
          <div className="w-14 h-20 bg-muted animate-pulse rounded" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
            <div className="h-3 w-16 bg-muted animate-pulse rounded" />
            <div className="h-5 w-24 bg-muted animate-pulse rounded" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
