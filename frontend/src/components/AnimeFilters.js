import { useState } from 'react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './ui/command';
import { Search, X, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// Filter options
const YEARS = Array.from({ length: 30 }, (_, i) => 2025 - i);
const SEASONS = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];
const FORMATS = ['TV', 'TV_SHORT', 'MOVIE', 'SPECIAL', 'OVA', 'ONA', 'MUSIC'];
const AIRING_STATUSES = ['RELEASING', 'FINISHED', 'NOT_YET_RELEASED', 'CANCELLED', 'HIATUS'];
const SORT_OPTIONS = [
  { value: 'title', label: 'Title A-Z' },
  { value: 'title-desc', label: 'Title Z-A' },
  { value: 'score', label: 'Score (High to Low)' },
  { value: 'score-asc', label: 'Score (Low to High)' },
  { value: 'progress', label: 'Progress' },
  { value: 'year', label: 'Year (Newest)' },
  { value: 'year-asc', label: 'Year (Oldest)' },
];

const ALL_GENRES = [
  'Action', 'Adventure', 'Comedy', 'Drama', 'Ecchi', 'Fantasy', 'Horror',
  'Mahou Shoujo', 'Mecha', 'Music', 'Mystery', 'Psychological', 'Romance',
  'Sci-Fi', 'Slice of Life', 'Sports', 'Supernatural', 'Thriller'
];

const formatLabel = (value) => {
  const labels = {
    TV: 'TV Series',
    TV_SHORT: 'TV Short',
    MOVIE: 'Movie',
    SPECIAL: 'Special',
    OVA: 'OVA',
    ONA: 'ONA',
    MUSIC: 'Music',
    RELEASING: 'Airing',
    FINISHED: 'Finished',
    NOT_YET_RELEASED: 'Not Yet Aired',
    CANCELLED: 'Cancelled',
    HIATUS: 'Hiatus',
    WINTER: 'Winter',
    SPRING: 'Spring',
    SUMMER: 'Summer',
    FALL: 'Fall',
  };
  return labels[value] || value;
};

// Custom native select component styled to match
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
          {typeof opt === 'object' ? opt.label : formatLabel(opt)}
        </option>
      ))}
    </select>
  );
}

export function AnimeFilters({ filters, onFiltersChange, availableGenres = [], availableTags = [] }) {
  const [genreOpen, setGenreOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);

  const genres = availableGenres.length > 0 ? availableGenres : ALL_GENRES;
  
  const updateFilter = (key, value) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange({
      search: '',
      year: '',
      season: '',
      format: '',
      status: '',
      genre: '',
      tag: '',
      sort: 'title',
    });
  };

  const activeFiltersCount = Object.entries(filters).filter(
    ([key, value]) => value && key !== 'sort' && key !== 'search'
  ).length;

  return (
    <div className="space-y-4">
      {/* Search and Sort Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search anime..."
            value={filters.search || ''}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="pl-9"
            data-testid="anime-search-input"
          />
        </div>

        {/* Sort Select */}
        <NativeSelect
          value={filters.sort || 'title'}
          onChange={(value) => updateFilter('sort', value)}
          options={SORT_OPTIONS}
          placeholder="Sort by"
          className="w-full sm:w-[180px]"
        />
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap gap-2">
        {/* Year */}
        <NativeSelect
          value={filters.year || ''}
          onChange={(value) => updateFilter('year', value)}
          options={YEARS.map(y => ({ value: String(y), label: String(y) }))}
          placeholder="All Years"
          className="w-[100px]"
        />

        {/* Season */}
        <NativeSelect
          value={filters.season || ''}
          onChange={(value) => updateFilter('season', value)}
          options={SEASONS.map(s => ({ value: s, label: formatLabel(s) }))}
          placeholder="All Seasons"
          className="w-[110px]"
        />

        {/* Format */}
        <NativeSelect
          value={filters.format || ''}
          onChange={(value) => updateFilter('format', value)}
          options={FORMATS.map(f => ({ value: f, label: formatLabel(f) }))}
          placeholder="All Formats"
          className="w-[120px]"
        />

        {/* Airing Status */}
        <NativeSelect
          value={filters.status || ''}
          onChange={(value) => updateFilter('status', value)}
          options={AIRING_STATUSES.map(s => ({ value: s, label: formatLabel(s) }))}
          placeholder="All Statuses"
          className="w-[130px]"
        />

        {/* Genre Multi-select */}
        <Popover open={genreOpen} onOpenChange={setGenreOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[120px] justify-between" data-testid="filter-genre">
              {filters.genre || 'Genre'}
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-0">
            <Command>
              <CommandInput placeholder="Search genre..." />
              <CommandList>
                <CommandEmpty>No genre found.</CommandEmpty>
                <CommandGroup>
                  <CommandItem onSelect={() => { updateFilter('genre', ''); setGenreOpen(false); }}>
                    <Check className={`mr-2 h-4 w-4 ${!filters.genre ? 'opacity-100' : 'opacity-0'}`} />
                    All Genres
                  </CommandItem>
                  {genres.map((genre) => (
                    <CommandItem
                      key={genre}
                      onSelect={() => { updateFilter('genre', genre); setGenreOpen(false); }}
                    >
                      <Check className={`mr-2 h-4 w-4 ${filters.genre === genre ? 'opacity-100' : 'opacity-0'}`} />
                      {genre}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Tags Multi-select */}
        {availableTags.length > 0 && (
          <Popover open={tagOpen} onOpenChange={setTagOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[100px] justify-between" data-testid="filter-tag">
                {filters.tag || 'Tag'}
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0">
              <Command>
                <CommandInput placeholder="Search tag..." />
                <CommandList>
                  <CommandEmpty>No tag found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem onSelect={() => { updateFilter('tag', ''); setTagOpen(false); }}>
                      <Check className={`mr-2 h-4 w-4 ${!filters.tag ? 'opacity-100' : 'opacity-0'}`} />
                      All Tags
                    </CommandItem>
                    {availableTags.slice(0, 30).map((tag) => (
                      <CommandItem
                        key={tag}
                        onSelect={() => { updateFilter('tag', tag); setTagOpen(false); }}
                      >
                        <Check className={`mr-2 h-4 w-4 ${filters.tag === tag ? 'opacity-100' : 'opacity-0'}`} />
                        {tag}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}

        {/* Clear Filters */}
        {activeFiltersCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
            <X className="h-4 w-4 mr-1" />
            Clear ({activeFiltersCount})
          </Button>
        )}
      </div>

      {/* Active Filters Display */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.year && (
            <Badge variant="secondary" className="gap-1">
              Year: {filters.year}
              <X className="h-3 w-3 cursor-pointer" onClick={() => updateFilter('year', '')} />
            </Badge>
          )}
          {filters.season && (
            <Badge variant="secondary" className="gap-1">
              {formatLabel(filters.season)}
              <X className="h-3 w-3 cursor-pointer" onClick={() => updateFilter('season', '')} />
            </Badge>
          )}
          {filters.format && (
            <Badge variant="secondary" className="gap-1">
              {formatLabel(filters.format)}
              <X className="h-3 w-3 cursor-pointer" onClick={() => updateFilter('format', '')} />
            </Badge>
          )}
          {filters.status && (
            <Badge variant="secondary" className="gap-1">
              {formatLabel(filters.status)}
              <X className="h-3 w-3 cursor-pointer" onClick={() => updateFilter('status', '')} />
            </Badge>
          )}
          {filters.genre && (
            <Badge variant="secondary" className="gap-1">
              {filters.genre}
              <X className="h-3 w-3 cursor-pointer" onClick={() => updateFilter('genre', '')} />
            </Badge>
          )}
          {filters.tag && (
            <Badge variant="secondary" className="gap-1">
              #{filters.tag}
              <X className="h-3 w-3 cursor-pointer" onClick={() => updateFilter('tag', '')} />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

// Helper function to filter and sort anime list
export function filterAndSortAnime(animeList, filters) {
  let filtered = [...animeList];

  // Search filter
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    filtered = filtered.filter((anime) =>
      (anime.title_english?.toLowerCase().includes(searchLower)) ||
      (anime.title_romaji?.toLowerCase().includes(searchLower))
    );
  }

  // Year filter
  if (filters.year) {
    filtered = filtered.filter((anime) => anime.seasonYear === parseInt(filters.year));
  }

  // Season filter
  if (filters.season) {
    filtered = filtered.filter((anime) => anime.season === filters.season);
  }

  // Format filter
  if (filters.format) {
    filtered = filtered.filter((anime) => anime.format === filters.format);
  }

  // Airing Status filter
  if (filters.status) {
    filtered = filtered.filter((anime) => anime.mediaStatus === filters.status);
  }

  // Genre filter
  if (filters.genre) {
    filtered = filtered.filter((anime) => anime.genres?.includes(filters.genre));
  }

  // Tag filter
  if (filters.tag) {
    filtered = filtered.filter((anime) => anime.tags?.includes(filters.tag));
  }

  // Sort
  const sortKey = filters.sort || 'title';
  filtered.sort((a, b) => {
    switch (sortKey) {
      case 'title':
        return (a.title_english || a.title_romaji || '').localeCompare(b.title_english || b.title_romaji || '');
      case 'title-desc':
        return (b.title_english || b.title_romaji || '').localeCompare(a.title_english || a.title_romaji || '');
      case 'score':
        return (b.score || 0) - (a.score || 0);
      case 'score-asc':
        return (a.score || 0) - (b.score || 0);
      case 'progress':
        return (b.progress || 0) - (a.progress || 0);
      case 'year':
        return (b.seasonYear || 0) - (a.seasonYear || 0);
      case 'year-asc':
        return (a.seasonYear || 0) - (b.seasonYear || 0);
      default:
        return 0;
    }
  });

  return filtered;
}

// Extract unique values from anime list for filter options
export function extractFilterOptions(animeList) {
  const genres = new Set();
  const tags = new Set();

  animeList.forEach((anime) => {
    anime.genres?.forEach((g) => genres.add(g));
    anime.tags?.forEach((t) => tags.add(t));
  });

  return {
    genres: Array.from(genres).sort(),
    tags: Array.from(tags).sort(),
  };
}
