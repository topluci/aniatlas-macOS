import { getBackendUrl } from '../lib/apiUrl';
import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { AnimeCard, AnimeCardSkeleton } from '../components/AnimeCard';
import { CalendarView, CalendarSkeleton } from '../components/CalendarView';
import { NextEpisodeCard } from '../components/NextEpisodeCard';
import { ExportModal } from '../components/ExportModal';
import { AnimeFilters, filterAndSortAnime, extractFilterOptions } from '../components/AnimeFilters';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { ScrollArea, ScrollBar } from '../components/ui/scroll-area';
import { Play, CheckCircle, Clock, Bookmark, ListVideo, Search } from 'lucide-react';
import { toast } from 'sonner';
import { loadSettings, scheduleEpisodeNotifications } from '../lib/notificationService';
import { useNavigate } from 'react-router-dom';
import { ChatButton } from '../components/ChatButton';

const API = `${getBackendUrl()}/api`;

// Detect current anime season
function getCurrentSeason() {
  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();
  let season;
  if (month >= 1 && month <= 3) season = 'WINTER';
  else if (month >= 4 && month <= 6) season = 'SPRING';
  else if (month >= 7 && month <= 9) season = 'SUMMER';
  else season = 'FALL';
  return { season, year };
}

const SEASON_LABELS = {
  WINTER: 'Winter',
  SPRING: 'Spring',
  SUMMER: 'Summer',
  FALL: 'Fall',
};

export function Dashboard() {
  const [animeList, setAnimeList] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('schedule');
  const navigate = useNavigate();

  const current = getCurrentSeason();
  const [seasonFilter, setSeasonFilter] = useState('all'); // 'all' | 'current' | 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL'

  const [filters, setFilters] = useState({
    search: '',
    year: '',
    season: '',
    format: '',
    status: '',
    genre: '',
    tag: '',
    sort: 'title',
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [listRes, scheduleRes] = await Promise.all([
        axios.get(`${API}/anime/list`, { withCredentials: true }),
        axios.get(`${API}/anime/schedule`, { withCredentials: true }),
      ]);
      setAnimeList(listRes.data.entries || []);
      setSchedules(scheduleRes.data.schedules || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load data', { description: 'Please refresh the page to try again.' });
    } finally {
      setLoading(false);
    }
  };

  // Apply seasonal filter first
  const seasonFiltered = useMemo(() => {
    if (seasonFilter === 'all') return animeList;
    if (seasonFilter === 'current') {
      return animeList.filter(a =>
        a.season === current.season && a.seasonYear === current.year
      );
    }
    return animeList.filter(a => a.season === seasonFilter);
  }, [animeList, seasonFilter, current]);

  const watching = useMemo(() => seasonFiltered.filter((a) => a.status === 'CURRENT' || a.status === 'REPEATING'), [seasonFiltered]);
  const completed = useMemo(() => animeList.filter((a) => a.status === 'COMPLETED'), [animeList]);
  const planning = useMemo(() => animeList.filter((a) => a.status === 'PLANNING'), [animeList]);
  const filterOptions = useMemo(() => extractFilterOptions(animeList), [animeList]);

  const filteredWatching = useMemo(
    () => filterAndSortAnime(watching, filters),
    [watching, filters]
  );
  const filteredAll = useMemo(
    () => filterAndSortAnime(seasonFiltered, filters),
    [seasonFiltered, filters]
  );

  // Build season pill options
  const seasonOptions = useMemo(() => {
    const seasons = new Set();
    animeList.forEach(a => { if (a.season) seasons.add(a.season); });
    return Array.from(seasons);
  }, [animeList]);

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="dashboard">
      <Navbar animeList={animeList} schedules={schedules} />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Your Anime Schedule</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Track your watching list and never miss an episode</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/browse')} data-testid="browse-btn">
              <Search className="mr-2 h-4 w-4" />Browse Anime
            </Button>
            <ExportModal />
          </div>
        </div>

        {/* Inline stats row — minimal */}
        <div className="flex items-center gap-4 mb-6 text-sm text-muted-foreground border-b border-border/40 pb-4">
          <StatPill label="Watching" value={watching.length} accent />
          <span className="text-border/60">|</span>
          <StatPill label="Completed" value={completed.length} />
          <span className="text-border/60">|</span>
          <StatPill label="Planning" value={planning.length} />
          <span className="text-border/60">|</span>
          <StatPill label="Total" value={animeList.length} />
        </div>

        {/* Top row: Next Episode */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="lg:col-span-1">
            <NextEpisodeCard schedules={schedules} loading={loading} />
          </div>
          <div className="lg:col-span-2">
            {!loading && schedules.length > 1 && (
              <UpcomingEpisodesStrip schedules={schedules} />
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="schedule" data-testid="tab-schedule">
                <Clock className="h-4 w-4 mr-2" />Schedule
              </TabsTrigger>
              <TabsTrigger value="watching" data-testid="tab-watching">
                <Play className="h-4 w-4 mr-2" />Watching
                <Badge variant="secondary" className="ml-2 text-xs">{watching.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="all" data-testid="tab-all">
                <ListVideo className="h-4 w-4 mr-2" />All Lists
              </TabsTrigger>
            </TabsList>

            {/* Seasonal filter pills — shown on non-schedule tabs */}
            {activeTab !== 'schedule' && (
              <div className="flex items-center gap-1.5 flex-wrap mt-2 pt-2 border-t border-border/30">
                <span className="text-xs text-muted-foreground mr-1">Season:</span>
                <SeasonPill label="All" active={seasonFilter === 'all'} onClick={() => setSeasonFilter('all')} />
                <SeasonPill
                  label={`${SEASON_LABELS[current.season]} ${current.year}`}
                  active={seasonFilter === 'current'}
                  onClick={() => setSeasonFilter('current')}
                />
                {seasonOptions.filter(s => s !== current.season).map(s => (
                  <SeasonPill
                    key={s}
                    label={SEASON_LABELS[s] || s}
                    active={seasonFilter === s}
                    onClick={() => setSeasonFilter(s)}
                  />
                ))}
              </div>
            )}
          </div>

          <TabsContent value="schedule" className="space-y-6">
            {loading ? <CalendarSkeleton /> : <CalendarView schedules={schedules} loading={loading} />}
          </TabsContent>

          <TabsContent value="watching" className="space-y-6">
            <AnimeFilters filters={filters} onFiltersChange={setFilters} availableGenres={filterOptions.genres} availableTags={filterOptions.tags} />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {loading
                ? Array.from({ length: 6 }).map((_, i) => <AnimeCardSkeleton key={i} />)
                : filteredWatching.length > 0
                  ? filteredWatching.map((anime) => <AnimeCard key={anime.id} anime={anime} />)
                  : <div className="col-span-full text-center py-12"><p className="text-muted-foreground text-sm">No anime currently watching</p></div>
              }
            </div>
          </TabsContent>

          <TabsContent value="all" className="space-y-6">
            <AnimeFilters filters={filters} onFiltersChange={setFilters} availableGenres={filterOptions.genres} availableTags={filterOptions.tags} />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {loading
                ? Array.from({ length: 12 }).map((_, i) => <AnimeCardSkeleton key={i} />)
                : filteredAll.length > 0
                  ? filteredAll.map((anime) => <AnimeCard key={anime.id} anime={anime} showCountdown={anime.status === 'CURRENT'} />)
                  : <div className="col-span-full text-center py-12"><p className="text-muted-foreground text-sm">No anime found</p></div>
              }
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <Footer />
      <ChatButton />
    </div>
  );
}

// Inline stat — "21 Watching"
function StatPill({ label, value, accent }) {
  return (
    <span className={accent ? 'text-foreground font-semibold' : ''} data-testid={`stat-${label.toLowerCase()}`}>
      <span className={accent ? 'text-primary' : 'text-foreground font-medium'}>{value}</span>{' '}
      {label}
    </span>
  );
}

// Season filter pill button
function SeasonPill({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
        active
          ? 'bg-primary text-primary-foreground border-primary'
          : 'border-border/50 text-muted-foreground hover:border-primary/50 hover:text-foreground'
      }`}
    >
      {label}
    </button>
  );
}

// Upcoming strip — fills the right column next to Next Episode
function UpcomingEpisodesStrip({ schedules }) {
  const upcomingEpisodes = schedules
    .sort((a, b) => a.airingAt - b.airingAt)
    .slice(1, 12);

  if (upcomingEpisodes.length === 0) return null;

  const formatTimeUntil = (timestamp) => {
    const diff = timestamp - Math.floor(Date.now() / 1000);
    if (diff < 0) return 'Aired';
    const days = Math.floor(diff / 86400);
    const hours = Math.floor((diff % 86400) / 3600);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h`;
    return `${Math.floor(diff / 60)}m`;
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium">Coming Up Next</h3>
        <span className="text-xs text-muted-foreground">{upcomingEpisodes.length} episodes</span>
      </div>
      <ScrollArea className="flex-1 w-full whitespace-nowrap">
        <div className="flex gap-3 pb-2">
          {upcomingEpisodes.map((episode, idx) => {
            const title = episode.title_english || episode.title_romaji;
            return (
              <a
                key={`${episode.mediaId}-${episode.episode}-${idx}`}
                href={`https://anilist.co/anime/${episode.mediaId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 group"
              >
                {/* ~20% larger than before: w-14 h-20 */}
                <div className="relative w-14 h-20 rounded overflow-hidden border border-border/40 group-hover:border-primary/60 transition-all group-hover:scale-105 duration-150">
                  <img
                    src={episode.coverImage}
                    alt={title}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-[9px] text-white font-medium">AniList ↗</span>
                  </div>
                </div>
                {/* Brighter text than before */}
                <div className="mt-1 w-14">
                  <p className="text-[9px] text-foreground/80 truncate font-medium">Ep {episode.episode}</p>
                  <p className="text-[9px] text-primary/80">{formatTimeUntil(episode.airingAt)}</p>
                </div>
              </a>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
