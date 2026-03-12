import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Calendar, Clock, Download, Sun, Moon, Monitor, ExternalLink, Heart, Github, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';

export function LandingPage() {
  const { login, loginWithMAL } = useAuth();
  const { theme, setTheme } = useTheme();
  const [selectedPlatform, setSelectedPlatform] = useState('anilist');

  const getThemeIcon = () => {
    switch (theme) {
      case 'light':
        return <Sun className="h-4 w-4" />;
      case 'dark':
        return <Moon className="h-4 w-4" />;
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  const handleLogin = () => {
    if (selectedPlatform === 'anilist') {
      login();
    } else {
      loginWithMAL();
    }
  };

  const handlePlatformSelect = (platform) => {
    setSelectedPlatform(platform);
    if (platform === 'anilist') {
      login();
    } else {
      loginWithMAL();
    }
  };

  // Platform icons
  const AniListIcon = () => (
    <svg viewBox="0 0 172 172" className="h-5 w-5" fill="currentColor">
      <path d="M85.973 0C38.499 0 0 38.499 0 85.973c0 47.474 38.499 85.973 85.973 85.973 47.474 0 85.973-38.499 85.973-85.973C171.946 38.499 133.447 0 85.973 0zm0 13.758c39.856 0 72.215 32.359 72.215 72.215s-32.359 72.215-72.215 72.215S13.758 125.829 13.758 85.973 46.117 13.758 85.973 13.758zM57.29 43.073v85.8l71.366-42.9-71.366-42.9z" />
    </svg>
  );

  const MALIcon = () => (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M8.273 7.247v8.423l-2.103-.003v-5.216l-2.03 2.404-1.989-2.458-.02 5.285H.001L0 7.247h2.203l1.865 2.545 2.015-2.546 2.19.001zm8.628 2.069l.025 6.335h-2.157l-.026-8.455 2.171.016 2.86 4.667V7.203l2.222-.01.016 8.455-2.127.012-2.984-4.344zm-5.633-2.069h5.65v1.882H13.48v1.456h2.083v1.893h-2.083v1.353h2.438v1.867h-5.632l.002-8.451z"/>
    </svg>
  );

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background" />
      
      {/* Floating elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className="absolute bottom-20 right-10 w-96 h-96 bg-secondary/10 rounded-full blur-3xl"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </div>

      {/* Theme Toggle */}
      <div className="absolute top-6 right-6 z-50">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-lg" data-testid="landing-theme-toggle">
              {getThemeIcon()}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setTheme('light')}>
              <Sun className="mr-2 h-4 w-4" />
              Light
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('dark')}>
              <Moon className="mr-2 h-4 w-4" />
              Dark
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('system')}>
              <Monitor className="mr-2 h-4 w-4" />
              System
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-2xl mx-auto"
        >
          {/* Logo */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="inline-flex items-center gap-3 mb-8"
          >
            <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20">
              <Calendar className="h-10 w-10 text-primary" />
            </div>
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight mb-4"
          >
            Ani<span className="text-primary">Atlas</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="text-base sm:text-lg text-muted-foreground mb-12 max-w-md mx-auto"
          >
            Track your anime watching schedule and sync with your calendar. Never miss an episode again.
          </motion.p>

          {/* Features */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex flex-wrap justify-center gap-6 mb-12"
          >
            <FeatureItem icon={<Calendar className="h-5 w-5" />} text="Personal Schedule" />
            <FeatureItem icon={<Clock className="h-5 w-5" />} text="Episode Countdown" />
            <FeatureItem icon={<Download className="h-5 w-5" />} text="Calendar Export" />
          </motion.div>

          {/* Login Button with Dropdown */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <div className="inline-flex rounded-full shadow-xl hover:shadow-primary/25 transition-shadow">
              {/* Main Button */}
              <Button
                onClick={handleLogin}
                size="lg"
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-lg px-8 py-6 rounded-l-full rounded-r-none border-r border-primary-foreground/20"
                data-testid="login-btn"
              >
                {selectedPlatform === 'anilist' ? <AniListIcon /> : <MALIcon />}
                <span className="ml-3">Login with {selectedPlatform === 'anilist' ? 'AniList' : 'MAL'}</span>
                <ExternalLink className="h-4 w-4 ml-2" />
              </Button>
              
              {/* Dropdown Arrow */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="lg"
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-3 py-6 rounded-r-full rounded-l-none"
                    data-testid="login-platform-dropdown"
                  >
                    <ChevronDown className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem 
                    onClick={() => handlePlatformSelect('anilist')}
                    className="cursor-pointer"
                    data-testid="select-anilist"
                  >
                    <AniListIcon />
                    <span className="ml-2">Login with AniList</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => handlePlatformSelect('mal')}
                    className="cursor-pointer"
                    data-testid="select-mal"
                  >
                    <MALIcon />
                    <span className="ml-2">Login with MAL</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </motion.div>

          {/* Footer Note */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.7 }}
            className="mt-8 text-sm text-muted-foreground"
          >
            Connect your AniList or MyAnimeList account to get started
          </motion.p>
        </motion.div>
      </div>

      {/* Footer */}
      <footer className="absolute bottom-0 left-0 right-0 border-t border-border/50 bg-background/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>© 2026 Made with</span>
              <Heart className="w-4 h-4 text-secondary fill-secondary" />
              <span>by</span>
              <a
                href="https://anilist.co/user/topluci/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-medium"
                data-testid="footer-creator-link"
              >
                topluci
              </a>
            </div>
            
            <a
              href="https://github.com/topluci/anischedule-macOS"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              data-testid="footer-github-link"
            >
              <Github className="w-4 h-4" />
              <span>View on GitHub</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureItem({ icon, text }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50 border border-border/50">
      <span className="text-primary">{icon}</span>
      <span className="text-sm font-medium">{text}</span>
    </div>
  );
}
