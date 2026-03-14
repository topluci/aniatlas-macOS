import { getBackendUrl } from '../lib/apiUrl';
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { ScrollArea } from '../components/ui/scroll-area';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '../components/ui/hover-card';
import { AnimeDetailModal } from '../components/AnimeDetailModal';
import { Search, Loader2, Star, Play, Calendar, Tv, Film, TrendingUp, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const API = `${getBackendUrl()}/api`;

// Options
const YEARS = Array.from({ length: 30 }, (_, i) => 2025 - i);
const SEASONS = [
  { value: 'WINTER', label: 'Winter' },
  { value: 'SPRING', label: 'Spring' },
  { value: 'SUMMER', label: 'Summer' },
  { value: 'FALL', label: 'Fall' },
];
const FORMATS = [
  { value: 'TV', label: 'TV Series' },
  { value: 'TV_SHORT', label: 'TV Short' },
  { value: 'MOVIE', label: 'Movie' },
  { value: 'SPECIAL', label: 'Special' },
  { value: 'OVA', label: 'OVA' },
  { value: 'ONA', label: 'ONA' },
];
const STATUSES = [
  { value: 'RELEASING', label: 'Airing' },
  { value: 'FINISHED', label: 'Finished' },
  { value: 'NOT_YET_RELEASED', label: 'Not Yet Aired' },
];
const SORT_OPTIONS = [
  { value: 'POPULARITY_DESC', label: 'Popularity' },
  { value: 'TRENDING_DESC', label: 'Trending' },
  { value: 'SCORE_DESC', label: 'Score' },
  { value: 'START_DATE_DESC', label: 'Newest' },
  { value: 'START_DATE', label: 'Oldest' },
  { value: 'TITLE_ROMAJI', label: 'Title' },
];
const GENRES = [
  'Action', 'Adventure', 'Comedy', 'Drama', 'Ecchi', 'Fantasy', 'Horror',
  'Mecha', 'Music', 'Mystery', 'Psychological', 'Romance', 'Sci-Fi',
  'Slice of Life', 'Sports', 'Supernatural', 'Thriller'
];

const STREAMING_COLORS = {
  'Crunchyroll': '#F47521',
  'Netflix': '#E50914',
  'Funimation': '#5B0BB5',
  'Amazon': '#00A8E1',
  'Hulu': '#1CE783',
  'Disney Plus': '#113CCF',
  'HBO Max': '#B535F6',
  'Hidive': '#00BAFF',
};

const cleanDescription = (html, maxLength = 250) => {
  if (!html) return '';
  const text = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\n/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
};

// Native select component
function NativeSelect({ value, onChange, options, placeholder, className }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={typeof opt === 'object' ? opt.value : opt} value={typeof opt === 'object' ? opt.value : opt}>
          {typeof opt === 'object' ? opt.label : opt}
        </option>
      ))}
    </select>
  );
}

export function BrowsePage() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pageInfo, setPageInfo] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedQuery, setExpandedQuery] = useState(null);
  
  // Filters - use empty string for "all"
  const [searchQuery, setSearchQuery] = useState('');
  const [genre, setGenre] = useState('');
  const [year, setYear] = useState('');
  const [season, setSeason] = useState('');
  const [format, setFormat] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('POPULARITY_DESC');

  const searchAnime = useCallback(async (page = 1) => {
    setLoading(true);
    setExpandedQuery(null);
    try {
      const params = new URLSearchParams();
      params.append('page', page);
      params.append('perPage', 24);
      params.append('sort', sort);
      
      if (searchQuery) params.append('query', searchQuery);
      if (genre) params.append('genre', genre);
      if (year) params.append('year', year);
      if (season) params.append('season', season);
      if (format) params.append('format', format);
      if (status) params.append('status', status);

      const response = await axios.get(`${API}/anime/search?${params.toString()}`, {
        withCredentials: true,
      });

      setResults(response.data.results || []);
      setPageInfo(response.data.pageInfo || {});
      setCurrentPage(page);
      
      // Check if query was expanded (for showing user feedback)
      if (response.data.expanded_query && response.data.expanded_query !== searchQuery) {
        setExpandedQuery(response.data.expanded_query);
      }
    } catch (error) {
      console.error('Search failed:', error);
      toast.error('Search failed', { description: 'Please try again.' });
    } finally {
      setLoading(false);
    }
  }, [searchQuery, genre, year, season, format, status, sort]);

  useEffect(() => {
    searchAnime(1);
  }, [genre, year, season, format, status, sort, searchAnime]);

  const handleSearch = (e) => {
    e.preventDefault();
    searchAnime(1);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setGenre('');
    setYear('');
    setSeason('');
    setFormat('');
    setStatus('');
    setSort('POPULARITY_DESC');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="browse-page">
      <Navbar />
      
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Browse Anime</h1>
          <p className="text-muted-foreground mt-1">
            Discover and search for anime across the database
          </p>
        </div>

        {/* Search & Filters */}
        <div className="space-y-4 mb-8">
          {/* Search Bar */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search: anime titles, AOT, MHA, JJK..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="browse-search-input"
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
            </Button>
          </form>
          
          {/* Query expansion hint */}
          {expandedQuery && (
            <p className="text-sm text-muted-foreground">
              Showing results for "<span className="text-primary font-medium">{expandedQuery}</span>"
            </p>
          )}
          
          {/* Alias hint */}
          {!searchQuery && (
            <p className="text-xs text-muted-foreground">
              Try shortcuts: AOT, MHA, JJK, FMAB, OPM, DS, SAO, CSM, Solo Leveling, Frieren...
            </p>
          )}

          {/* Filter Row using native selects */}
          <div className="flex flex-wrap gap-2">
            <NativeSelect
              value={genre}
              onChange={setGenre}
              options={GENRES}
              placeholder="All Genres"
              className="w-[130px]"
            />

            <NativeSelect
              value={year}
              onChange={setYear}
              options={YEARS.map(y => ({ value: String(y), label: String(y) }))}
              placeholder="All Years"
              className="w-[100px]"
            />

            <NativeSelect
              value={season}
              onChange={setSeason}
              options={SEASONS}
              placeholder="All Seasons"
              className="w-[110px]"
            />

            <NativeSelect
              value={format}
              onChange={setFormat}
              options={FORMATS}
              placeholder="All Formats"
              className="w-[120px]"
            />

            <NativeSelect
              value={status}
              onChange={setStatus}
              options={STATUSES}
              placeholder="All Statuses"
              className="w-[140px]"
            />

            <NativeSelect
              value={sort}
              onChange={setSort}
              options={SORT_OPTIONS}
              placeholder="Sort"
              className="w-[130px]"
            />

            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear All
            </Button>
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {Array.from({ length: 24 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <div className="aspect-[3/4] bg-muted animate-pulse" />
              </Card>
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {results.map((anime) => (
                <BrowseAnimeCard key={anime.mediaId} anime={anime} />
              ))}
            </div>

            {results.length === 0 && (
              <div className="text-center py-16">
                <p className="text-muted-foreground">No anime found matching your criteria.</p>
              </div>
            )}

            {/* Pagination */}
            {pageInfo.lastPage > 1 && (
              <div className="flex items-center justify-center gap-4 mt-8">
                <Button
                  variant="outline"
                  disabled={currentPage <= 1}
                  onClick={() => searchAnime(currentPage - 1)}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {pageInfo.lastPage}
                </span>
                <Button
                  variant="outline"
                  disabled={!pageInfo.hasNextPage}
                  onClick={() => searchAnime(currentPage + 1)}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}

function BrowseAnimeCard({ anime }) {
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const title = anime.title_english || anime.title_romaji;
  const anilistUrl = `https://anilist.co/anime/${anime.mediaId}`;
  const description = cleanDescription(anime.description);
  const FormatIcon = anime.format === 'MOVIE' ? Film : Tv;

  const handleCardClick = (e) => {
    e.preventDefault();
    setDetailModalOpen(true);
  };

  return (
    <>
      <HoverCard openDelay={300} closeDelay={100}>
        <HoverCardTrigger asChild>
          <Card
            className="group relative overflow-hidden bg-card border-border/50 hover:border-primary/30 cursor-pointer"
            onClick={handleCardClick}
          >
            <div className="relative aspect-[3/4] overflow-hidden">
              <img
                src={anime.coverImage}
                alt={title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
              
              {/* Score */}
              {anime.averageScore && (
                <div className="absolute top-2 left-2">
                  <Badge className="bg-primary/90 text-primary-foreground border-0 text-xs">
                    <Star className="w-3 h-3 mr-1 fill-current" />
                    {anime.averageScore}%
                  </Badge>
                </div>
              )}

              <div className="absolute bottom-0 left-0 right-0 p-3">
                <h3 className="text-white font-bold text-sm line-clamp-2">{title}</h3>
                <div className="flex items-center gap-2 mt-1 text-xs text-white/70">
                  {anime.format && <span>{anime.format}</span>}
                  {anime.seasonYear && <span>• {anime.seasonYear}</span>}
                </div>
              </div>
            </div>
          </Card>
        </HoverCardTrigger>
        
        <HoverCardContent side="right" align="start" className="w-96 p-0 overflow-hidden" sideOffset={8}>
          <div className="relative h-24 overflow-hidden">
            <img src={anime.coverImage} alt={title} className="w-full h-full object-cover blur-sm scale-110" />
            <div className="absolute inset-0 bg-gradient-to-t from-popover via-popover/80 to-transparent" />
            <div className="absolute bottom-3 left-3 right-3">
              <h4 className="font-bold text-sm line-clamp-1">{title}</h4>
            </div>
          </div>

          <ScrollArea className="h-[280px]">
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                {anime.format && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <FormatIcon className="w-3.5 h-3.5" />
                    <span>{anime.format}</span>
                  </div>
                )}
                {anime.seasonYear && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{anime.season} {anime.seasonYear}</span>
                  </div>
                )}
                {anime.episodes && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Play className="w-3.5 h-3.5" />
                    <span>{anime.episodes} episodes</span>
                  </div>
                )}
                {anime.averageScore && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>{anime.averageScore}% score</span>
                  </div>
                )}
              </div>

              {anime.studios && anime.studios.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Studio: <span className="text-foreground">{anime.studios.join(', ')}</span>
                </p>
              )}

              {anime.genres && anime.genres.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {anime.genres.slice(0, 5).map((genreItem) => (
                    <Badge key={genreItem} variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                      {genreItem}
                    </Badge>
                  ))}
                </div>
              )}

              {anime.streamingLinks && anime.streamingLinks.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Watch on:</span>
                  <div className="flex flex-wrap gap-2">
                    {anime.streamingLinks.slice(0, 4).map((link, idx) => (
                      <a
                        key={idx}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs"
                        style={{
                          backgroundColor: `${STREAMING_COLORS[link.site] || '#666'}20`,
                          color: STREAMING_COLORS[link.site] || '#fff',
                        }}
                      >
                        <ExternalLink className="w-3 h-3" />
                        {link.site}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {description && (
                <div className="pt-2 border-t border-border/50">
                  <span className="text-xs font-medium text-muted-foreground">Summary:</span>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-1">{description}</p>
                </div>
              )}

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
                  className="h-6 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDetailModalOpen(true);
                  }}
                >
                  Full Details
                </Button>
              </div>
            </div>
          </ScrollArea>
        </HoverCardContent>
      </HoverCard>

      <AnimeDetailModal 
        anime={anime} 
        open={detailModalOpen} 
        onOpenChange={setDetailModalOpen} 
      />
    </>
  );
}
