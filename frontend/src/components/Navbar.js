import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from './ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { NotificationDropdown } from './NotificationDropdown';
import { Calendar, Sun, Moon, Monitor, LogOut, ExternalLink, Music, ChevronDown, Tv, Settings, Menu, X, Bell } from 'lucide-react';

// Detect macOS Electron for traffic light padding
const isElectronMac = typeof window !== 'undefined' && !!window.electronAPI?.isElectron && !!window.electronAPI?.isMac;

export function Navbar({ animeList = [], schedules = [] }) {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [browseDropdownOpen, setBrowseDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const browseContainerRef = useRef(null);
  const closeTimeoutRef = useRef(null);

  const getThemeIcon = () => {
    if (theme === 'light') return <Sun className="h-4 w-4" />;
    if (theme === 'dark') return <Moon className="h-4 w-4" />;
    return <Monitor className="h-4 w-4" />;
  };

  const isMALUser = user?.platform === 'mal';
  const platformLabel = isMALUser ? 'MyAnimeList' : 'AniList';
  const profileUrl = isMALUser
    ? `https://myanimelist.net/profile/${user?.username}`
    : `https://anilist.co/user/${user?.username}`;

  const isBrowseActive = location.pathname === '/browse' || location.pathname === '/anisongs';

  const handleBrowseContainerEnter = () => {
    if (closeTimeoutRef.current) { clearTimeout(closeTimeoutRef.current); closeTimeoutRef.current = null; }
    setBrowseDropdownOpen(true);
  };
  const handleBrowseContainerLeave = () => {
    closeTimeoutRef.current = setTimeout(() => setBrowseDropdownOpen(false), 300);
  };

  const navigateTo = (path) => {
    setMobileMenuOpen(false);
    setBrowseDropdownOpen(false);
    navigate(path);
  };

  return (
    <nav className="sticky top-0 z-30 border-b border-border/50 glass relative">
      {/* Drag region behind the whole navbar (interactive content is layered above) */}
      {isElectronMac && <div className="navbar-drag-region absolute inset-0" aria-hidden="true" />}

      {/* macOS traffic light spacer — pushes content below the window control buttons */}
      {isElectronMac && <div style={{ height: 28 }} className="navbar-drag-region" aria-hidden="true" />}

      <div className="navbar-no-drag max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 relative">
        {/* On macOS Electron, shift content right so it clears traffic lights */}
        <div className={`flex justify-between items-center h-13 ${isElectronMac ? 'pl-20' : ''}`}>

          {/* Logo */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => { setMobileMenuOpen(false); navigate(user ? '/dashboard' : '/'); }}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              data-testid="logo-home-btn"
            >
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <span className="text-lg font-bold tracking-tight">
                Ani<span className="text-primary">Atlas</span>
              </span>
            </button>

            {/* Desktop nav — Schedule + Browse only */}
            {user && (
              <div className="hidden md:flex items-center gap-1">
                <Button
                  variant={location.pathname === '/dashboard' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => navigate('/dashboard')}
                  data-testid="nav-dashboard"
                >
                  Schedule
                </Button>

                <div
                  ref={browseContainerRef}
                  className="relative"
                  onMouseEnter={handleBrowseContainerEnter}
                  onMouseLeave={handleBrowseContainerLeave}
                >
                  <Button
                    variant={isBrowseActive ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => navigateTo('/browse')}
                    data-testid="nav-browse"
                    className="gap-1"
                  >
                    Browse
                    <ChevronDown className={`h-3 w-3 opacity-50 transition-transform ${browseDropdownOpen ? 'rotate-180' : ''}`} />
                  </Button>

                  {browseDropdownOpen && (
                    <div
                      className="absolute top-full left-0 mt-1 w-44 rounded-md border bg-popover p-1 shadow-md z-50"
                      onMouseEnter={() => { if (closeTimeoutRef.current) { clearTimeout(closeTimeoutRef.current); closeTimeoutRef.current = null; } }}
                      onMouseLeave={handleBrowseContainerLeave}
                    >
                      <button onClick={() => navigateTo('/browse')} className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent cursor-pointer" data-testid="nav-browse-anime">
                        <Tv className="mr-2 h-4 w-4" />Browse Anime
                      </button>
                      <button onClick={() => navigateTo('/anisongs')} className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent cursor-pointer" data-testid="nav-browse-songs">
                        <Music className="mr-2 h-4 w-4" />AniSongs
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right side — notifications, theme toggle, avatar */}
          <div className="flex items-center gap-1">
            {user && <NotificationDropdown animeList={animeList} schedules={schedules} />}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" data-testid="theme-toggle">
                  {getThemeIcon()}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setTheme('light')}><Sun className="mr-2 h-4 w-4" />Light</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('dark')}><Moon className="mr-2 h-4 w-4" />Dark</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('system')}><Monitor className="mr-2 h-4 w-4" />System</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {user && (
              <Button variant="ghost" size="icon" className="md:hidden h-8 w-8" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} data-testid="mobile-menu-btn">
                {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </Button>
            )}

            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full hidden sm:flex" data-testid="user-menu">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.avatar} alt={user.username} />
                      <AvatarFallback className="text-xs">{user.username?.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <div className="flex items-center gap-3 p-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={user.avatar} alt={user.username} />
                      <AvatarFallback>{user.username?.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">{user.username}</span>
                      <span className="text-xs text-muted-foreground">{platformLabel}</span>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="cursor-pointer" data-testid="view-profile-link">
                      <ExternalLink className="mr-2 h-4 w-4" />View {platformLabel} Profile
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/settings')} className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive cursor-pointer" data-testid="logout-btn">
                    <LogOut className="mr-2 h-4 w-4" />Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {user && mobileMenuOpen && (
        <div className="navbar-no-drag md:hidden border-t border-border/50 py-3 space-y-1 px-4">
          {[
            { path: '/dashboard', label: 'Schedule' },
            { path: '/browse', label: 'Browse Anime' },
            { path: '/anisongs', label: 'AniSongs' },
            { path: '/settings', label: 'Settings' },
          ].map(({ path, label }) => (
            <button
              key={path}
              onClick={() => navigateTo(path)}
              className={`flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm ${location.pathname === path ? 'bg-secondary' : 'hover:bg-muted'}`}
            >
              {label}
            </button>
          ))}
          <div className="border-t border-border/50 pt-2 mt-2">
            <button onClick={() => { logout(); setMobileMenuOpen(false); }} className="flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm text-destructive hover:bg-destructive/10">
              <LogOut className="h-4 w-4" />Logout
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
