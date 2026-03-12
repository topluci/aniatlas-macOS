import { getBackendUrl } from '../lib/apiUrl';
import { useState } from 'react';
import axios from 'axios';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { CompactCountdown } from './CountdownTimer';
import { EditAnimeModal } from './EditAnimeModal';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from './ui/hover-card';
import { Play, Clock, Star, Tv, Film, Calendar, Users, TrendingUp, Edit3, ExternalLink, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const API = `${getBackendUrl()}/api`;

// Streaming service colors
const STREAMING_COLORS = {
  'Crunchyroll': '#F47521',
  'Netflix': '#E50914',
  'Funimation': '#5B0BB5',
  'Amazon': '#00A8E1',
  'Hulu': '#1CE783',
  'Disney Plus': '#113CCF',
  'HBO Max': '#B535F6',
  'Hidive': '#00BAFF',
  'YouTube': '#FF0000',
  'Bilibili': '#00A1D6',
};

// Format helpers
const formatStatus = (status) => {
  const statusMap = {
    CURRENT: 'Watching',
    COMPLETED: 'Completed',
    PLANNING: 'Planning',
    PAUSED: 'Paused',
    DROPPED: 'Dropped',
    REPEATING: 'Rewatching',
  };
  return statusMap[status] || status;
};

const formatFormat = (format) => {
  const formatMap = {
    TV: 'TV Series',
    TV_SHORT: 'TV Short',
    MOVIE: 'Movie',
    SPECIAL: 'Special',
    OVA: 'OVA',
    ONA: 'ONA',
    MUSIC: 'Music',
  };
  return formatMap[format] || format;
};

const formatSeason = (season, year) => {
  if (!season && !year) return null;
  const seasonMap = {
    WINTER: 'Winter',
    SPRING: 'Spring', 
    SUMMER: 'Summer',
    FALL: 'Fall',
  };
  const seasonStr = seasonMap[season] || '';
  return year ? `${seasonStr} ${year}`.trim() : seasonStr;
};

const getStatusColor = (status) => {
  const colors = {
    CURRENT: 'bg-primary text-primary-foreground',
    COMPLETED: 'bg-green-500 text-white',
    PLANNING: 'bg-yellow-500 text-black',
    PAUSED: 'bg-orange-500 text-white',
    DROPPED: 'bg-red-500 text-white',
    REPEATING: 'bg-purple-500 text-white',
  };
  return colors[status] || 'bg-muted text-muted-foreground';
};

const getFormatIcon = (format) => {
  if (format === 'MOVIE') return Film;
  return Tv;
};

// Clean HTML and truncate description
const cleanDescription = (html, maxLength = 200) => {
  if (!html) return '';
  // Remove HTML tags
  const text = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\n/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
};

export function AnimeCard({ anime, showCountdown = true, onUpdate }) {
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [localAnime, setLocalAnime] = useState(anime);
  const [markingWatched, setMarkingWatched] = useState(false);
  
  const title = localAnime.title_english || localAnime.title_romaji;
  const hasNextEpisode = localAnime.nextAiringEpisode && localAnime.mediaStatus === 'RELEASING';
  const FormatIcon = getFormatIcon(localAnime.format);
  const seasonYear = formatSeason(localAnime.season, localAnime.seasonYear);
  const anilistUrl = `https://anilist.co/anime/${localAnime.mediaId}`;
  const description = cleanDescription(localAnime.description);

  const handleEditClick = (e) => {
    e.stopPropagation();
    setEditModalOpen(true);
  };

  const handleMarkWatched = async (e) => {
    e.stopPropagation();
    if (markingWatched) return;
    
    setMarkingWatched(true);
    try {
      const response = await axios.post(
        `${API}/anime/entry/${localAnime.id}/increment`,
        {},
        { withCredentials: true }
      );
      
      if (response.data.success) {
        const newProgress = response.data.progress;
        setLocalAnime({ ...localAnime, progress: newProgress });
        onUpdate?.({ ...localAnime, progress: newProgress });
        toast.success('Progress updated!', {
          description: `${title} - Episode ${newProgress}`
        });
      }
    } catch (error) {
      console.error('Failed to update progress:', error);
      toast.error('Failed to update progress');
    } finally {
      setMarkingWatched(false);
    }
  };

  const handleSave = (updatedAnime) => {
    setLocalAnime({ ...localAnime, ...updatedAnime });
    onUpdate?.(updatedAnime);
  };

  return (
    <>
      <HoverCard openDelay={300} closeDelay={100}>
        <HoverCardTrigger asChild>
          <Card
            className="anime-card group relative overflow-hidden bg-card border-border/50 hover:border-primary/30 cursor-pointer"
            data-testid={`anime-card-${localAnime.mediaId}`}
            onClick={() => window.open(anilistUrl, '_blank', 'noopener,noreferrer')}
          >
            {/* Cover Image */}
            <div className="relative aspect-[3/4] overflow-hidden">
              <img
                src={localAnime.coverImage}
                alt={title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
              
              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
              
              {/* Progress Badge */}
              <div className="absolute top-3 left-3">
                <Badge variant="secondary" className="bg-black/60 backdrop-blur-sm text-white border-0">
                  <Play className="w-3 h-3 mr-1 fill-current" />
                  {localAnime.progress}/{localAnime.episodes || '?'}
                </Badge>
              </div>

              {/* Edit Button - Shows on hover */}
              <Button
                variant="secondary"
                size="icon"
                className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 hover:bg-black/80 text-white border-0 h-8 w-8"
                onClick={handleEditClick}
                data-testid={`edit-anime-${localAnime.mediaId}`}
              >
                <Edit3 className="h-4 w-4" />
              </Button>

              {/* Quick Mark Watched Button - Shows on hover */}
              <Button
                variant="secondary"
                size="icon"
                className="absolute top-12 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-green-600 hover:bg-green-700 text-white border-0 h-6 w-6"
                onClick={handleMarkWatched}
                disabled={markingWatched}
                data-testid={`mark-watched-${localAnime.mediaId}`}
                title="Mark episode watched"
              >
                {markingWatched ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <span className="text-sm font-bold">+</span>
                )}
              </Button>

              {/* Score Badge */}
              {localAnime.score > 0 && (
                <div className="absolute top-12 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Badge className="bg-primary text-primary-foreground border-0 font-bold">
                    {localAnime.score}
                  </Badge>
                </div>
              )}

              {/* Bottom Content */}
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <h3 className="text-white font-bold text-sm line-clamp-2 mb-2">
                  {title}
                </h3>
                
                {/* Next Episode Countdown */}
                {showCountdown && hasNextEpisode && (
                  <div className="flex items-center gap-2 text-white/90">
                    <Clock className="w-3 h-3" />
                    <span className="text-xs">Ep {localAnime.nextAiringEpisode.episode}</span>
                    <CompactCountdown airingAt={localAnime.nextAiringEpisode.airingAt} />
                  </div>
                )}
              </div>
            </div>
          </Card>
        </HoverCardTrigger>
        
        <HoverCardContent 
          side="right" 
          align="start" 
          className="w-96 p-0 overflow-hidden"
          sideOffset={8}
        >
          {/* Header with cover */}
          <div className="relative h-28 overflow-hidden">
            <img
              src={localAnime.coverImage}
              alt={title}
              className="w-full h-full object-cover blur-sm scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-popover via-popover/80 to-transparent" />
            <div className="absolute bottom-3 left-3 right-3">
              <h4 className="font-bold text-sm line-clamp-1">{title}</h4>
              {localAnime.title_english && localAnime.title_romaji !== localAnime.title_english && (
                <p className="text-xs text-muted-foreground line-clamp-1">{localAnime.title_romaji}</p>
              )}
            </div>
          </div>

          {/* Content */}
          <ScrollArea className="h-[320px]">
            <div className="p-4 space-y-3">
              {/* Status & Progress Row */}
              <div className="flex items-center justify-between">
                <Badge className={`${getStatusColor(localAnime.status)} text-xs`}>
                  {formatStatus(localAnime.status)}
                </Badge>
                <div className="flex items-center gap-1 text-sm">
                  <Play className="w-3.5 h-3.5 text-primary" />
                  <span className="font-semibold">{localAnime.progress}</span>
                  <span className="text-muted-foreground">/ {localAnime.episodes || '?'} eps</span>
                </div>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {localAnime.format && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <FormatIcon className="w-3.5 h-3.5" />
                    <span>{formatFormat(localAnime.format)}</span>
                  </div>
                )}
                
                {seasonYear && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{seasonYear}</span>
                  </div>
                )}

                {localAnime.averageScore && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>Avg: <span className="text-foreground font-medium">{localAnime.averageScore}%</span></span>
                  </div>
                )}

                {localAnime.score > 0 && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Star className="w-3.5 h-3.5 text-yellow-500" />
                    <span>Your: <span className="text-foreground font-medium">{localAnime.score}/10</span></span>
                  </div>
                )}
              </div>

              {/* Studios */}
              {localAnime.studios && localAnime.studios.length > 0 && (
                <div className="flex items-start gap-1.5 text-xs">
                  <Users className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">
                    Studio: <span className="text-foreground">{localAnime.studios.join(', ')}</span>
                  </span>
                </div>
              )}

              {/* Genres */}
              {localAnime.genres && localAnime.genres.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {localAnime.genres.slice(0, 5).map((genre) => (
                    <Badge key={genre} variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                      {genre}
                    </Badge>
                  ))}
                  {localAnime.genres.length > 5 && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 text-muted-foreground">
                      +{localAnime.genres.length - 5}
                    </Badge>
                  )}
                </div>
              )}

              {/* Streaming Links */}
              {localAnime.streamingLinks && localAnime.streamingLinks.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Watch on:</span>
                  <div className="flex flex-wrap gap-2">
                    {localAnime.streamingLinks.slice(0, 5).map((link, idx) => (
                      <a
                        key={idx}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors hover:opacity-80"
                        style={{
                          backgroundColor: `${STREAMING_COLORS[link.site] || link.color || '#666'}20`,
                          color: STREAMING_COLORS[link.site] || link.color || '#fff',
                          border: `1px solid ${STREAMING_COLORS[link.site] || link.color || '#666'}40`
                        }}
                      >
                        {link.icon ? (
                          <img src={link.icon} alt={link.site} className="w-3.5 h-3.5" />
                        ) : (
                          <ExternalLink className="w-3 h-3" />
                        )}
                        {link.site}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Description/Summary */}
              {description && (
                <div className="space-y-1.5 pt-2 border-t border-border/50">
                  <span className="text-xs font-medium text-muted-foreground">Summary:</span>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {description}
                  </p>
                </div>
              )}

              {/* Action buttons */}
              <div className="pt-2 border-t border-border/50 flex items-center justify-between">
                <a
                  href={anilistUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  View on AniList →
                </a>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleEditClick}
                >
                  <Edit3 className="w-3 h-3 mr-1" />
                  Edit
                </Button>
              </div>
            </div>
          </ScrollArea>
        </HoverCardContent>
      </HoverCard>

      <EditAnimeModal
        anime={localAnime}
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        onSave={handleSave}
      />
    </>
  );
}

export function AnimeCardSkeleton() {
  return (
    <Card className="overflow-hidden bg-card border-border/50">
      <div className="aspect-[3/4] bg-muted animate-pulse" />
    </Card>
  );
}
