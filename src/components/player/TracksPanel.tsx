/**
 * TracksPanel - Subtitle and Audio track selection panel
 */

import { useState } from 'react';
import { X, Check, Subtitles, Volume2, Clock, Type } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { SubtitleTrack, AudioTrack } from '@/player/types';
import { useTVMode } from '@/contexts/TVModeContext';
import { useVodStore } from '@/data/stores/vodStore';

interface TracksPanelProps {
  subtitles: SubtitleTrack[];
  audioTracks: AudioTrack[];
  currentSubtitleId?: string;
  currentAudioId?: string;
  onSelectSubtitle: (id?: string) => void;
  onSelectAudio: (id?: string) => void;
  onClose: () => void;
}

export function TracksPanel({
  subtitles,
  audioTracks,
  currentSubtitleId,
  currentAudioId,
  onSelectSubtitle,
  onSelectAudio,
  onClose,
}: TracksPanelProps) {
  const { isTVMode } = useTVMode();
  const { playerSettings, setPlayerSettings } = useVodStore();
  const [subtitleDelay, setSubtitleDelay] = useState(playerSettings.subtitleDelay || 0);
  
  const handleDelayChange = (value: number[]) => {
    const delay = value[0];
    setSubtitleDelay(delay);
    setPlayerSettings({ subtitleDelay: delay });
  };
  
  const handleFontSizeChange = (size: 'small' | 'medium' | 'large' | 'xlarge') => {
    setPlayerSettings({ subtitleFontSize: size });
  };
  
  const handleBackgroundChange = (bg: 'none' | 'semi' | 'solid') => {
    setPlayerSettings({ subtitleBackground: bg });
  };
  
  return (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className={cn(
        "bg-background rounded-xl shadow-2xl overflow-hidden",
        isTVMode ? "w-[600px] max-h-[80vh]" : "w-[400px] max-h-[70vh]"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className={cn(
            "font-semibold",
            isTVMode ? "text-xl" : "text-lg"
          )}>
            Ljud & Undertexter
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
        
        <Tabs defaultValue="subtitles" className="w-full">
          <TabsList className="w-full justify-start px-4 pt-2">
            <TabsTrigger value="subtitles" className="flex items-center gap-2">
              <Subtitles className="w-4 h-4" />
              Undertexter
            </TabsTrigger>
            <TabsTrigger value="audio" className="flex items-center gap-2">
              <Volume2 className="w-4 h-4" />
              Ljud
            </TabsTrigger>
            <TabsTrigger value="style" className="flex items-center gap-2">
              <Type className="w-4 h-4" />
              Stil
            </TabsTrigger>
          </TabsList>
          
          {/* Subtitles Tab */}
          <TabsContent value="subtitles" className="mt-0">
            <ScrollArea className="h-64">
              <div className="p-4 space-y-1">
                {/* Off option */}
                <button
                  onClick={() => onSelectSubtitle(undefined)}
                  className={cn(
                    "w-full flex items-center justify-between p-3 rounded-lg transition-colors",
                    "hover:bg-muted",
                    !currentSubtitleId && "bg-primary/10 text-primary"
                  )}
                >
                  <span className={isTVMode ? "text-lg" : ""}>Av</span>
                  {!currentSubtitleId && <Check className="w-5 h-5" />}
                </button>
                
                {/* Available subtitles */}
                {subtitles.length > 0 ? (
                  subtitles.map((track) => (
                    <button
                      key={track.id}
                      onClick={() => onSelectSubtitle(track.id)}
                      className={cn(
                        "w-full flex items-center justify-between p-3 rounded-lg transition-colors",
                        "hover:bg-muted",
                        currentSubtitleId === track.id && "bg-primary/10 text-primary"
                      )}
                    >
                    <div className="text-left">
                        <span className={cn("block", isTVMode && "text-lg")}>
                          {track.label || track.lang || 'Undertext'}
                        </span>
                        {track.kind === 'external' && (
                          <span className="text-xs text-muted-foreground">{track.format?.toUpperCase()}</span>
                        )}
                      </div>
                      {currentSubtitleId === track.id && <Check className="w-5 h-5" />}
                    </button>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground py-4">
                    Inga undertexter tillgängliga
                  </p>
                )}
              </div>
            </ScrollArea>
            
            {/* Subtitle delay */}
            <div className="p-4 border-t border-border">
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Fördröjning</span>
                <Slider
                  value={[subtitleDelay]}
                  min={-5000}
                  max={5000}
                  step={100}
                  onValueChange={handleDelayChange}
                  className="flex-1"
                />
                <span className="text-sm min-w-[60px] text-right">
                  {subtitleDelay > 0 ? '+' : ''}{(subtitleDelay / 1000).toFixed(1)}s
                </span>
              </div>
            </div>
          </TabsContent>
          
          {/* Audio Tab */}
          <TabsContent value="audio" className="mt-0">
            <ScrollArea className="h-80">
              <div className="p-4 space-y-1">
                {audioTracks.length > 0 ? (
                  audioTracks.map((track) => (
                    <button
                      key={track.id}
                      onClick={() => onSelectAudio(track.id)}
                      className={cn(
                        "w-full flex items-center justify-between p-3 rounded-lg transition-colors",
                        "hover:bg-muted",
                        currentAudioId === track.id && "bg-primary/10 text-primary"
                      )}
                    >
                      <div className="text-left">
                        <span className={cn("block", isTVMode && "text-lg")}>
                          {track.label || track.lang || 'Ljud'}
                        </span>
                      </div>
                      {currentAudioId === track.id && <Check className="w-5 h-5" />}
                    </button>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground py-4">
                    Inga ljudspår tillgängliga
                  </p>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
          
          {/* Style Tab */}
          <TabsContent value="style" className="mt-0">
            <div className="p-4 space-y-6">
              {/* Font size */}
              <div>
                <label className="text-sm font-medium mb-3 block">Textstorlek</label>
                <div className="flex gap-2">
                  {(['small', 'medium', 'large', 'xlarge'] as const).map((size) => (
                    <Button
                      key={size}
                      variant={playerSettings.subtitleFontSize === size ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleFontSizeChange(size)}
                      className="flex-1"
                    >
                      {size === 'small' && 'S'}
                      {size === 'medium' && 'M'}
                      {size === 'large' && 'L'}
                      {size === 'xlarge' && 'XL'}
                    </Button>
                  ))}
                </div>
              </div>
              
              {/* Background */}
              <div>
                <label className="text-sm font-medium mb-3 block">Bakgrund</label>
                <div className="flex gap-2">
                  {(['none', 'semi', 'solid'] as const).map((bg) => (
                    <Button
                      key={bg}
                      variant={playerSettings.subtitleBackground === bg ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleBackgroundChange(bg)}
                      className="flex-1"
                    >
                      {bg === 'none' && 'Ingen'}
                      {bg === 'semi' && 'Halvt'}
                      {bg === 'solid' && 'Solid'}
                    </Button>
                  ))}
                </div>
              </div>
              
              {/* Preview */}
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <span 
                  className={cn(
                    "inline-block px-2 py-1 rounded",
                    playerSettings.subtitleFontSize === 'small' && "text-sm",
                    playerSettings.subtitleFontSize === 'medium' && "text-base",
                    playerSettings.subtitleFontSize === 'large' && "text-lg",
                    playerSettings.subtitleFontSize === 'xlarge' && "text-xl",
                    playerSettings.subtitleBackground === 'none' && "",
                    playerSettings.subtitleBackground === 'semi' && "bg-black/50",
                    playerSettings.subtitleBackground === 'solid' && "bg-black",
                  )}
                  style={{ color: playerSettings.subtitleFontColor }}
                >
                  Exempel på undertext
                </span>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
