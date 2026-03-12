import { getBackendUrl } from '../lib/apiUrl';
import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { ScrollArea } from '../components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Search, Loader2, Music, Play, Disc3, Mic2, ChevronLeft, ChevronRight, ExternalLink, Volume2, Users, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';

const API = `${getBackendUrl()}/api`;

// Settings storage key
const SETTINGS_KEY = 'anischedule_notification_settings';

// Get adult content setting
const getAdultContentEnabled = () => {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const settings = JSON.parse(stored);
      return settings.adultContent === true;
    }
  } catch {}
  return false;
};

// Debounce hook
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function AniSongsPage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({ songs: [], anime_results: [], expanded_query: null });
  const [recentAnime, setRecentAnime] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedAnime, setSelectedAnime] = useState(null);
  const [animeThemes, setAnimeThemes] = useState(null);
  const [themesLoading, setThemesLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [viewMode, setViewMode] = useState('anime'); // 'anime' or 'songs'

  const isAniListUser = user?.platform !== 'mal';
  const debouncedSearch = useDebounce(searchQuery, 400);

  // Fetch recent anime on mount
  useEffect(() => {
    fetchRecentAnime();
  }, []);

  // Live search with debounce
  useEffect(() => {
    if (debouncedSearch.trim()) {
      performSearch(debouncedSearch);
    } else {
      setSearchResults({ songs: [], anime_results: [], expanded_query: null });
      setViewMode('anime');
    }
  }, [debouncedSearch]);

  const fetchRecentAnime = async (pageNum = 1) => {
    setLoading(true);
    try {
      const adultEnabled = getAdultContentEnabled();
      const response = await axios.get(`${API}/anime/songs/recent?page=${pageNum}&sfw=${!adultEnabled}`, {
        withCredentials: true,
      });
      setRecentAnime(response.data.results);
      setPagination(response.data.pagination);
      setPage(pageNum);
    } catch (error) {
      console.error('Failed to fetch recent anime:', error);
      toast.error('Failed to load anime');
    } finally {
      setLoading(false);
    }
  };

  const performSearch = async (query) => {
    setSearchLoading(true);
    try {
      const adultEnabled = getAdultContentEnabled();
      const response = await axios.get(
        `${API}/anime/songs/search?q=${encodeURIComponent(query)}&sfw=${!adultEnabled}`,
        { withCredentials: true }
      );
      setSearchResults(response.data);
      
      // Auto-switch to songs view if songs found
      if (response.data.songs && response.data.songs.length > 0) {
        setViewMode('songs');
      } else {
        setViewMode('anime');
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSearch = (e) => {
    e?.preventDefault();
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults({ songs: [], anime_results: [] });
    setViewMode('anime');
  };

  const fetchAnimeThemes = async (anime) => {
    setSelectedAnime(anime);
    setThemesLoading(true);
    setAnimeThemes(null);

    try {
      const response = await axios.get(`${API}/anime/songs/${anime.mal_id}`, {
        withCredentials: true,
      });
      setAnimeThemes(response.data);
    } catch (error) {
      console.error('Failed to fetch themes:', error);
      toast.error('Failed to load themes');
    } finally {
      setThemesLoading(false);
    }
  };

  const hasSearchResults = searchQuery.trim() && (searchResults.songs?.length > 0 || searchResults.anime_results?.length > 0);

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="anisongs-page">
      <Navbar />

      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold mb-2 flex items-center gap-3">
              <Music className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
              AniSongs
            </h1>
            <p className="text-sm text-muted-foreground">
              Discover anime openings, endings, OSTs, and more
            </p>
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="mb-4">
            <div className="relative max-w-2xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search: anime, song, artist, AOT OP, MHA ED..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10"
                data-testid="anisongs-search"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              {searchLoading && (
                <div className="absolute right-10 top-1/2 -translate-y-1/2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                </div>
              )}
            </div>
            {/* Query expansion hint */}
            {searchResults.expanded_query && searchResults.expanded_query !== searchQuery && (
              <p className="text-sm text-muted-foreground mt-2">
                Showing results for "<span className="text-primary font-medium">{searchResults.expanded_query}</span>"
              </p>
            )}
            {!searchQuery && (
              <p className="text-xs text-muted-foreground mt-2">
                Try: "AOT OP", "MHA ED", "JJK opening", "Frieren", "YOASOBI", "LiSA"
              </p>
            )}
          </form>

          {/* View Mode Toggle (when searching) */}
          {hasSearchResults && (
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm text-muted-foreground">View:</span>
              <div className="flex rounded-lg border border-border overflow-hidden">
                <button
                  onClick={() => setViewMode('songs')}
                  className={`px-3 py-1.5 text-sm ${viewMode === 'songs' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                >
                  Songs ({searchResults.songs?.length || 0})
                </button>
                <button
                  onClick={() => setViewMode('anime')}
                  className={`px-3 py-1.5 text-sm ${viewMode === 'anime' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                >
                  Anime ({searchResults.anime_results?.length || 0})
                </button>
              </div>
            </div>
          )}

          {/* Song Type Tags */}
          <div className="flex flex-wrap gap-2 mb-6">
            <SongTypeTag icon={<Play className="w-3 h-3" />} label="OP" />
            <SongTypeTag icon={<Disc3 className="w-3 h-3" />} label="ED" />
            <SongTypeTag icon={<Volume2 className="w-3 h-3" />} label="OST" />
            <SongTypeTag icon={<Sparkles className="w-3 h-3" />} label="Insert" />
            <SongTypeTag icon={<Users className="w-3 h-3" />} label="Character" />
            <SongTypeTag icon={<Music className="w-3 h-3" />} label="Theme" />
          </div>

          {/* Results */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : hasSearchResults ? (
            viewMode === 'songs' && searchResults.songs?.length > 0 ? (
              // Songs Grid
              <div>
                <h2 className="text-lg font-semibold mb-4">
                  Songs for "{searchQuery}"
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {searchResults.songs.map((song, idx) => (
                    <SongCard key={idx} song={song} isAniListUser={isAniListUser} />
                  ))}
                </div>
              </div>
            ) : (
              // Anime Grid
              <div>
                <h2 className="text-lg font-semibold mb-4">
                  Results for "{searchQuery}"
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                  {searchResults.anime_results?.map((anime) => (
                    <AnimeCard
                      key={anime.mal_id}
                      anime={anime}
                      onClick={() => fetchAnimeThemes(anime)}
                    />
                  ))}
                </div>
              </div>
            )
          ) : (
            // Recent Anime
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Current Season</h2>
                {pagination && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchRecentAnime(page - 1)}
                      disabled={!pagination.has_previous_page || loading}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {pagination.current_page}/{pagination.last_visible_page}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchRecentAnime(page + 1)}
                      disabled={!pagination.has_next_page || loading}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                {recentAnime.map((anime) => (
                  <AnimeCard
                    key={anime.mal_id}
                    anime={anime}
                    onClick={() => fetchAnimeThemes(anime)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />

      {/* Themes Modal */}
      <ThemesModal
        anime={selectedAnime}
        themes={animeThemes}
        loading={themesLoading}
        open={!!selectedAnime}
        onOpenChange={(open) => !open && setSelectedAnime(null)}
        isAniListUser={isAniListUser}
      />
    </div>
  );
}

function SongTypeTag({ icon, label }) {
  return (
    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-muted/50 border border-border/50 text-xs text-muted-foreground">
      {icon}
      <span>{label}</span>
    </div>
  );
}

function SongCard({ song, isAniListUser }) {
  const title = song.title || song.raw?.split('"')[1] || 'Unknown Song';
  const artist = song.artist || 'Unknown Artist';
  const anime = song.anime;
  const songType = song.song_type || 'Theme';
  
  const spotifyUrl = `https://open.spotify.com/search/${encodeURIComponent(`${title} ${artist}`)}`;
  const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${title} ${artist} anime`)}`;
  const malUrl = anime ? `https://myanimelist.net/anime/${anime.mal_id}` : null;
  const anilistUrl = anime ? `https://anilist.co/search/anime?search=${encodeURIComponent(anime.title)}` : null;

  return (
    <Card className="p-3 hover:border-primary/30 transition-colors">
      <div className="flex gap-3">
        {/* Anime Cover */}
        {anime?.image && (
          <img
            src={anime.image}
            alt={anime.title}
            className="w-12 h-16 object-cover rounded flex-shrink-0"
          />
        )}
        
        <div className="flex-1 min-w-0">
          {/* Song Type Badge */}
          <Badge variant="outline" className="text-[10px] mb-1">
            {songType}
          </Badge>
          
          {/* Song Title */}
          <p className="font-medium text-sm line-clamp-1">{title}</p>
          
          {/* Artist */}
          <p className="text-xs text-muted-foreground flex items-center gap-1 line-clamp-1">
            <Mic2 className="w-3 h-3 flex-shrink-0" />
            {artist}
          </p>
          
          {/* Anime Title */}
          {anime && (
            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
              {anime.title_english || anime.title}
            </p>
          )}
          
          {/* Action Links */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            <a
              href={spotifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-500 hover:bg-green-500/20"
            >
              Spotify
            </a>
            <a
              href={youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 hover:bg-red-500/20"
            >
              YouTube
            </a>
            {malUrl && (
              <a
                href={malUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 hover:bg-blue-500/20"
              >
                MAL
              </a>
            )}
            {isAniListUser && anilistUrl && (
              <a
                href={anilistUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20"
              >
                AniList
              </a>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function AnimeCard({ anime, onClick }) {
  return (
    <Card
      className="group cursor-pointer overflow-hidden bg-card border-border/50 hover:border-primary/30 transition-colors"
      onClick={onClick}
      data-testid={`anime-card-${anime.mal_id}`}
    >
      <div className="relative aspect-[3/4] overflow-hidden">
        <img
          src={anime.image}
          alt={anime.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
        
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
          <div className="p-2 sm:p-3 rounded-full bg-primary/90">
            <Music className="h-4 w-4 sm:h-6 sm:w-6 text-primary-foreground" />
          </div>
        </div>

        {anime.score && (
          <Badge className="absolute top-1.5 left-1.5 bg-primary/90 text-[10px] px-1.5">
            ★ {anime.score}
          </Badge>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-3">
          <h3 className="text-white font-bold text-xs sm:text-sm line-clamp-2">
            {anime.title_english || anime.title}
          </h3>
          <p className="text-white/70 text-[10px] sm:text-xs mt-0.5">
            {anime.type} {anime.year && `• ${anime.year}`}
          </p>
        </div>
      </div>
    </Card>
  );
}

function ThemesModal({ anime, themes, loading, open, onOpenChange, isAniListUser }) {
  if (!anime) return null;

  const title = anime.title_english || anime.title;
  const malUrl = `https://myanimelist.net/anime/${anime.mal_id}`;
  const anilistUrl = `https://anilist.co/search/anime?search=${encodeURIComponent(anime.title)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-hidden p-0">
        {/* Header */}
        <div className="relative h-28 sm:h-32 overflow-hidden">
          <img
            src={anime.image}
            alt={title}
            className="w-full h-full object-cover blur-sm scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
          <div className="absolute bottom-3 sm:bottom-4 left-3 sm:left-4 right-3 sm:right-4 flex items-end gap-3">
            <img
              src={anime.image}
              alt={title}
              className="w-12 h-18 sm:w-16 sm:h-24 object-cover rounded-lg shadow-lg"
            />
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base sm:text-lg font-bold line-clamp-1">{title}</DialogTitle>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {anime.type} {anime.year && `• ${anime.year}`}
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : themes ? (
          <Tabs defaultValue="openings" className="w-full">
            <TabsList className="w-full rounded-none border-b bg-transparent h-auto p-0 grid grid-cols-2">
              <TabsTrigger
                value="openings"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-2 sm:py-3 text-xs sm:text-sm"
              >
                <Play className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                OP ({themes.openings?.length || 0})
              </TabsTrigger>
              <TabsTrigger
                value="endings"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-2 sm:py-3 text-xs sm:text-sm"
              >
                <Disc3 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                ED ({themes.endings?.length || 0})
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[250px] sm:h-[280px]">
              <TabsContent value="openings" className="p-3 sm:p-4 mt-0">
                {themes.openings?.length > 0 ? (
                  <div className="space-y-2 sm:space-y-3">
                    {themes.openings.map((theme, idx) => (
                      <ThemeCard key={idx} theme={theme} type="OP" />
                    ))}
                  </div>
                ) : (
                  <EmptyThemes type="openings" />
                )}
              </TabsContent>

              <TabsContent value="endings" className="p-3 sm:p-4 mt-0">
                {themes.endings?.length > 0 ? (
                  <div className="space-y-2 sm:space-y-3">
                    {themes.endings.map((theme, idx) => (
                      <ThemeCard key={idx} theme={theme} type="ED" />
                    ))}
                  </div>
                ) : (
                  <EmptyThemes type="endings" />
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            Failed to load themes
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-border p-2 sm:p-3 flex items-center justify-between text-xs sm:text-sm">
          <a
            href={malUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            MyAnimeList
            <ExternalLink className="w-3 h-3" />
          </a>
          {isAniListUser && (
            <a
              href={anilistUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline flex items-center gap-1"
            >
              View on AniList
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ThemeCard({ theme, type }) {
  const hasInfo = theme.title && theme.artist;
  const title = theme.title || theme.raw?.split('"')[1] || 'Unknown';
  const artist = theme.artist || '';
  
  const searchQuery = hasInfo ? `${theme.title} ${theme.artist}` : theme.raw;
  const spotifyUrl = `https://open.spotify.com/search/${encodeURIComponent(searchQuery)}`;
  const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery + ' anime')}`;

  return (
    <div className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
      <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/10 flex items-center justify-center">
        {type === 'OP' ? (
          <Play className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
        ) : (
          <Disc3 className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        {hasInfo ? (
          <>
            <p className="font-medium text-xs sm:text-sm line-clamp-1">
              {type} {theme.number}: {theme.title}
            </p>
            <p className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1">
              <Mic2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              {theme.artist}
            </p>
            {theme.episodes && (
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                {theme.episodes}
              </p>
            )}
          </>
        ) : (
          <p className="text-xs sm:text-sm line-clamp-2">{theme.raw}</p>
        )}
        
        <div className="flex gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
          <a
            href={spotifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded bg-green-500/10 text-green-500 hover:bg-green-500/20"
          >
            Spotify
          </a>
          <a
            href={youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded bg-red-500/10 text-red-500 hover:bg-red-500/20"
          >
            YouTube
          </a>
        </div>
      </div>
    </div>
  );
}

function EmptyThemes({ type }) {
  return (
    <div className="text-center py-8 text-muted-foreground">
      <Music className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-2 opacity-50" />
      <p className="text-xs sm:text-sm">No {type} found</p>
    </div>
  );
}
