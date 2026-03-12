import { getBackendUrl } from '../lib/apiUrl';
import { useState } from 'react';
import axios from 'axios';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Slider } from './ui/slider';
import { Calendar } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Badge } from './ui/badge';
import { CalendarIcon, Loader2, Save, Plus, Minus } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const API = `${getBackendUrl()}/api`;

export function EditAnimeModal({ anime, open, onOpenChange, onSave }) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(anime?.progress || 0);
  const [score, setScore] = useState(anime?.score || 0);
  const [notes, setNotes] = useState(anime?.notes || '');
  const [startDate, setStartDate] = useState(
    anime?.startedAt?.year 
      ? new Date(anime.startedAt.year, (anime.startedAt.month || 1) - 1, anime.startedAt.day || 1)
      : null
  );
  const [endDate, setEndDate] = useState(
    anime?.completedAt?.year
      ? new Date(anime.completedAt.year, (anime.completedAt.month || 1) - 1, anime.completedAt.day || 1)
      : null
  );

  const title = anime?.title_english || anime?.title_romaji || 'Unknown';
  const maxEpisodes = anime?.episodes || 999;

  const handleSave = async () => {
    setLoading(true);
    try {
      const updateData = {
        progress,
        score: score > 0 ? score : null,
        notes: notes || null,
        startedAt: startDate ? {
          year: startDate.getFullYear(),
          month: startDate.getMonth() + 1,
          day: startDate.getDate()
        } : null,
        completedAt: endDate ? {
          year: endDate.getFullYear(),
          month: endDate.getMonth() + 1,
          day: endDate.getDate()
        } : null
      };

      await axios.put(
        `${API}/anime/entry/${anime.id}`,
        updateData,
        { withCredentials: true }
      );

      toast.success('Entry updated!', {
        description: `${title} has been updated.`
      });

      onSave?.({ ...anime, ...updateData });
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to update entry:', error);
      toast.error('Failed to update', {
        description: 'Please try again later.'
      });
    } finally {
      setLoading(false);
    }
  };

  const incrementProgress = () => {
    if (progress < maxEpisodes) {
      setProgress(progress + 1);
    }
  };

  const decrementProgress = () => {
    if (progress > 0) {
      setProgress(progress - 1);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <img
              src={anime?.coverImage}
              alt={title}
              className="w-12 h-16 object-cover rounded"
            />
            <div className="flex-1 min-w-0">
              <span className="line-clamp-2">{title}</span>
              <Badge variant="outline" className="mt-1 text-xs">
                {anime?.status}
              </Badge>
            </div>
          </DialogTitle>
          <DialogDescription>
            Edit your list entry for this anime
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Episode Progress */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Episode Progress</Label>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10"
                onClick={decrementProgress}
                disabled={progress <= 0}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <div className="flex-1 flex items-center justify-center gap-2">
                <Input
                  type="number"
                  value={progress}
                  onChange={(e) => setProgress(Math.min(maxEpisodes, Math.max(0, parseInt(e.target.value) || 0)))}
                  className="w-20 text-center text-lg font-bold"
                  min={0}
                  max={maxEpisodes}
                />
                <span className="text-muted-foreground">/ {maxEpisodes === 999 ? '?' : maxEpisodes}</span>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10"
                onClick={incrementProgress}
                disabled={progress >= maxEpisodes}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Score */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Score</Label>
              <span className="text-lg font-bold text-primary">
                {score > 0 ? score.toFixed(1) : '—'}
              </span>
            </div>
            <Slider
              value={[score]}
              onValueChange={([val]) => setScore(val)}
              max={10}
              step={0.5}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0</span>
              <span>5</span>
              <span>10</span>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            {/* Start Date */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, 'MMM d, yyyy') : 'Pick date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* End Date */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, 'MMM d, yyyy') : 'Pick date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Notes</Label>
            <Textarea
              placeholder="Add your notes here..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[80px] resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
