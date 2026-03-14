import { getBackendUrl } from '../lib/apiUrl';
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { 
  Star, Play, Calendar, Tv, Film, Users, TrendingUp, 
  ExternalLink, Clock, Bookmark, Heart, Loader2 
} from 'lucide-react';
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

// Clean HTML and truncate description
const cleanDescription = (html) => {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\n/g, ' ').trim();
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

const formatStatus = (status) => {
  const statusMap = {
    RELEASING: 'Airing',
    FINISHED: 'Finished',
    NOT_YET_RELEASED: 'Not Yet Aired',
    CANCELLED: 'Cancelled',
    HIATUS: 'On Hiatus',
  };
  return statusMap[status] || status;
};

export function AnimeDetailModal({ anime, open, onOpenChange }) {
  const [detailedInfo, setDetailedInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const title = anime?.title_english || anime?.title_romaji;
  const anilistUrl = `https://anilist.co/anime/${anime?.mediaId}`;

  const fetchDetailedInfo = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/anime/details/${anime.mediaId}`, {
        withCredentials: true,
      });
      setDetailedInfo(response.data);
    } catch (error) {
      console.error('Failed to fetch anime details:', error);
      // Use existing anime data if fetch fails
      setDetailedInfo(null);
    } finally {
      setLoading(false);
    }
  }, [anime?.mediaId]);

  useEffect(() => {
    if (open && anime?.mediaId) {
      fetchDetailedInfo();
    }
  }, [open, anime?.mediaId, fetchDetailedInfo]);

  const data = detailedInfo || anime;
  const description = cleanDescription(data?.description);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden max-h-[90vh]">
        {/* Banner/Header */}
        <div className="relative h-48 overflow-hidden">
          <img
            src={data?.bannerImage || data?.coverImage}
            alt={title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          
          {/* Cover + Title overlay */}
          <div className="absolute bottom-4 left-4 right-4 flex gap-4">
            <img
              src={data?.coverImage}
              alt={title}
              className="w-24 h-36 object-cover rounded-lg shadow-xl flex-shrink-0"
            />
            <div className="flex-1 flex flex-col justify-end">
              <DialogTitle className="text-xl font-bold line-clamp-2 text-foreground">
                {title}
              </DialogTitle>
              {data?.title_english && data?.title_romaji !== data?.title_english && (
                <p className="text-sm text-muted-foreground line-clamp-1">{data?.title_romaji}</p>
              )}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {data?.averageScore && (
                  <Badge className="bg-primary/90">
                    <Star className="w-3 h-3 mr-1 fill-current" />
                    {data.averageScore}%
                  </Badge>
                )}
                {data?.format && (
                  <Badge variant="outline">{formatFormat(data.format)}</Badge>
                )}
                {data?.mediaStatus && (
                  <Badge variant="secondary">{formatStatus(data.mediaStatus)}</Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full rounded-none border-b bg-transparent h-auto p-0">
              <TabsTrigger 
                value="overview" 
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3"
              >
                Overview
              </TabsTrigger>
              <TabsTrigger 
                value="characters" 
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3"
              >
                Characters
              </TabsTrigger>
              <TabsTrigger 
                value="staff" 
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3"
              >
                Staff
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[350px]">
              <TabsContent value="overview" className="p-4 space-y-4 mt-0">
                {/* Quick Info */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  {data?.episodes && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                      <Play className="w-4 h-4 text-primary" />
                      <div>
                        <p className="text-xs text-muted-foreground">Episodes</p>
                        <p className="font-medium">{data.episodes}</p>
                      </div>
                    </div>
                  )}
                  {formatSeason(data?.season, data?.seasonYear) && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                      <Calendar className="w-4 h-4 text-primary" />
                      <div>
                        <p className="text-xs text-muted-foreground">Season</p>
                        <p className="font-medium">{formatSeason(data.season, data.seasonYear)}</p>
                      </div>
                    </div>
                  )}
                  {data?.studios && data.studios.length > 0 && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 col-span-2">
                      <Users className="w-4 h-4 text-primary" />
                      <div>
                        <p className="text-xs text-muted-foreground">Studio</p>
                        <p className="font-medium">{data.studios[0]}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Description */}
                {description && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Synopsis</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
                  </div>
                )}

                {/* Genres */}
                {data?.genres && data.genres.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Genres</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {data.genres.map((genre) => (
                        <Badge key={genre} variant="outline" className="text-xs">
                          {genre}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tags */}
                {data?.tags && data.tags.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Tags</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {data.tags.slice(0, 10).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Streaming Links */}
                {data?.streamingLinks && data.streamingLinks.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Where to Watch</h4>
                    <div className="flex flex-wrap gap-2">
                      {data.streamingLinks.map((link, idx) => (
                        <a
                          key={idx}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors hover:opacity-80"
                          style={{
                            backgroundColor: `${STREAMING_COLORS[link.site] || link.color || '#666'}20`,
                            color: STREAMING_COLORS[link.site] || link.color || 'inherit',
                            border: `1px solid ${STREAMING_COLORS[link.site] || link.color || '#666'}40`
                          }}
                        >
                          <ExternalLink className="w-3 h-3" />
                          {link.site}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* External Links */}
                <div className="pt-2 border-t border-border">
                  <a
                    href={anilistUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    View on AniList
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </TabsContent>

              <TabsContent value="characters" className="p-4 mt-0">
                {detailedInfo?.characters && detailedInfo.characters.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {detailedInfo.characters.map((char, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                        <img
                          src={char.image}
                          alt={char.name}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium line-clamp-1">{char.name}</p>
                          <p className="text-xs text-muted-foreground">{char.role}</p>
                          {char.voiceActor && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              VA: {char.voiceActor}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No character information available</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="staff" className="p-4 mt-0">
                {detailedInfo?.staff && detailedInfo.staff.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {detailedInfo.staff.map((person, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                        <img
                          src={person.image}
                          alt={person.name}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium line-clamp-1">{person.name}</p>
                          <p className="text-xs text-muted-foreground">{person.role}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No staff information available</p>
                  </div>
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
