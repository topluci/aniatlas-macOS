import { useState, useEffect, useMemo } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Bell, Play, Clock, Trash2, Check } from 'lucide-react';
import { EditAnimeModal } from './EditAnimeModal';

// Format time ago
const formatTimeAgo = (timestamp) => {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;
  
  if (diff < 0) return 'upcoming';
  
  if (diff < 3600) {
    const mins = Math.floor(diff / 60);
    return `${mins}m ago`;
  }
  if (diff < 86400) {
    const hrs = Math.floor(diff / 3600);
    return `${hrs}hr${hrs > 1 ? 's' : ''} ago`;
  }
  if (diff < 604800) {
    const days = Math.floor(diff / 86400);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
  const weeks = Math.floor(diff / 604800);
  return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
};

// Storage keys
const READ_NOTIFICATIONS_KEY = 'anischedule_read_notifications';
const DELETED_NOTIFICATIONS_KEY = 'anischedule_deleted_notifications';

export function NotificationDropdown({ animeList = [], schedules = [] }) {
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedAnime, setSelectedAnime] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [readNotifications, setReadNotifications] = useState([]);
  const [deletedNotifications, setDeletedNotifications] = useState([]);



  // Memoize notifications calculation
  const notifications = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    const oneWeekAgo = now - (7 * 24 * 60 * 60);

    // Create notifications from anime list - episodes that are behind
    const recentlyAired = animeList
      .filter(anime => {
        // Only show for currently watching anime
        if (anime.status !== 'CURRENT') return false;
        
        // Check if there's a next episode that indicates we're behind
        if (anime.nextAiringEpisode) {
          const currentEp = anime.nextAiringEpisode.episode - 1;
          return anime.progress < currentEp;
        }
        return false;
      })
      .map(anime => {
        const currentEp = anime.nextAiringEpisode.episode - 1;
        // Estimate when the last episode aired (24 mins before next)
        const lastAiredAt = anime.nextAiringEpisode.airingAt - (7 * 24 * 60 * 60);
        
        return {
          ...anime,
          airedEpisode: currentEp,
          airedAt: lastAiredAt,
          behindBy: currentEp - anime.progress
        };
      })
      .filter(anime => anime.airedAt >= oneWeekAgo)
      .sort((a, b) => b.airedAt - a.airedAt);

    // Also include episodes that just aired from schedules
    const justAired = schedules
      .filter(schedule => {
        const airedAt = schedule.airingAt;
        return airedAt <= now && airedAt >= oneWeekAgo;
      })
      .map(schedule => {
        // Find matching anime from list
        const anime = animeList.find(a => a.mediaId === schedule.mediaId);
        return {
          ...schedule,
          anime,
          airedAt: schedule.airingAt,
          airedEpisode: schedule.episode
        };
      })
      .filter(item => item.anime && item.anime.progress < item.airedEpisode)
      .sort((a, b) => b.airedAt - a.airedAt);

    // Combine and dedupe notifications
    const notificationsMap = new Map();
    
    justAired.forEach(item => {
      const key = `${item.mediaId}-${item.airedEpisode}`;
      if (!notificationsMap.has(key)) {
        notificationsMap.set(key, {
          id: key,
          mediaId: item.mediaId,
          anime: item.anime,
          episode: item.airedEpisode,
          airedAt: item.airedAt,
          title: item.title_english || item.title_romaji,
          coverImage: item.coverImage
        });
      }
    });

    recentlyAired.forEach(item => {
      const key = `${item.mediaId}-${item.airedEpisode}`;
      if (!notificationsMap.has(key)) {
        notificationsMap.set(key, {
          id: key,
          mediaId: item.mediaId,
          anime: item,
          episode: item.airedEpisode,
          airedAt: item.airedAt,
          title: item.title_english || item.title_romaji,
          coverImage: item.coverImage
        });
      }
    });

    return Array.from(notificationsMap.values())
      .filter(n => !deletedNotifications.includes(n.id)) // Filter out deleted notifications
      .sort((a, b) => b.airedAt - a.airedAt)
      .slice(0, 20);
  }, [animeList, schedules, deletedNotifications]);

  // Filter out read notifications for unread count
  const unreadNotifications = notifications.filter(n => !readNotifications.includes(n.id));
  const unreadCount = unreadNotifications.length;

  // Mark all as read when dropdown opens
  const handleOpenChange = (open) => {
    setIsOpen(open);
    if (open && unreadCount > 0) {
      // Auto-mark as read when opened
      const allIds = notifications.map(n => n.id);
      setReadNotifications(prev => [...new Set([...prev, ...allIds])]);
    }
  };

  // Clear all notifications (permanently delete)
  const handleClearAll = (e) => {
    e.stopPropagation();
    const allIds = notifications.map(n => n.id);
    setDeletedNotifications(prev => [...new Set([...prev, ...allIds])]);
  };

  // Clear a single notification (permanently delete)
  const handleClearOne = (e, notificationId) => {
    e.stopPropagation();
    setDeletedNotifications(prev => [...new Set([...prev, notificationId])]);
  };

  const handleNotificationClick = (notification) => {
    if (notification.anime) {
      setSelectedAnime(notification.anime);
      setEditModalOpen(true);
    }
  };

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative rounded-lg"
            data-testid="notification-btn"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80 p-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-sm">Recent Episodes</h3>
            <div className="flex items-center gap-2">
              {notifications.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={handleClearAll}
                  data-testid="clear-all-notifications"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Clear all
                </Button>
              )}
              {unreadCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {unreadCount} new
                </Badge>
              )}
            </div>
          </div>
          
          <ScrollArea className="h-[320px]">
            {notifications.length > 0 ? (
              <div className="divide-y divide-border">
                {notifications.map((notification, idx) => {
                  const isRead = readNotifications.includes(notification.id);
                  return (
                    <div
                      key={`${notification.mediaId}-${notification.episode}-${idx}`}
                      className={`relative group ${isRead ? 'opacity-60' : ''}`}
                    >
                      <button
                        className="w-full flex items-start gap-3 p-3 hover:bg-muted/50 transition-colors text-left"
                        onClick={() => handleNotificationClick(notification)}
                        data-testid={`notification-item-${idx}`}
                      >
                        <img
                          src={notification.coverImage}
                          alt={notification.title}
                          className="w-10 h-14 object-cover rounded flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium line-clamp-1">
                            Episode {notification.episode}
                          </p>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {notification.title}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            <span>aired {formatTimeAgo(notification.airedAt)}</span>
                          </div>
                        </div>
                        {isRead ? (
                          <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-1" />
                        ) : (
                          <Play className="w-4 h-4 text-primary flex-shrink-0 mt-1" />
                        )}
                      </button>
                      
                      {/* Clear single notification button */}
                      <button
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
                        onClick={(e) => handleClearOne(e, notification.id)}
                        title="Mark as read"
                      >
                        <Check className="w-3 h-3 text-muted-foreground" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <Bell className="w-10 h-10 text-muted-foreground mb-3" />
                <p className="text-sm font-medium">All caught up!</p>
                <p className="text-xs text-muted-foreground mt-1">
                  No new episodes in the past week
                </p>
              </div>
            )}
          </ScrollArea>
        </DropdownMenuContent>
      </DropdownMenu>

      {selectedAnime && (
        <EditAnimeModal
          anime={selectedAnime}
          open={editModalOpen}
          onOpenChange={setEditModalOpen}
          onSave={() => {
            setSelectedAnime(null);
          }}
        />
      )}
    </>
  );
}
