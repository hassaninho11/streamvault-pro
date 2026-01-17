import { useNavigate } from 'react-router-dom';
import { 
  Tv, 
  Calendar, 
  Star, 
  Clock, 
  Settings, 
  Plus,
  Play,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { TVCard } from './TVCard';
import { useTVMode } from '@/contexts/TVModeContext';
import { useFocusManager } from '@/hooks/useFocusManager';
import { Channel } from '@/types/iptv';
import { ChannelLogo } from '@/components/ui/custom';

interface TVHomeCardsProps {
  recentChannels?: Channel[];
  favoriteChannels?: Channel[];
  onContinueWatching?: (channel: Channel) => void;
}

const mainCards = [
  { 
    to: '/live', 
    icon: Tv, 
    label: 'Live TV', 
    description: 'Watch live channels',
    color: 'from-primary to-primary/60'
  },
  { 
    to: '/epg', 
    icon: Calendar, 
    label: 'TV Guide', 
    description: 'Browse program schedule',
    color: 'from-accent to-accent/60'
  },
  { 
    to: '/favorites', 
    icon: Star, 
    label: 'Favorites', 
    description: 'Your saved channels',
    color: 'from-warning to-warning/60'
  },
  { 
    to: '/recent', 
    icon: Clock, 
    label: 'Recent', 
    description: 'Recently watched',
    color: 'from-secondary to-secondary/60'
  },
  { 
    to: '/providers', 
    icon: Plus, 
    label: 'Providers', 
    description: 'Manage sources',
    color: 'from-success to-success/60'
  },
  { 
    to: '/settings', 
    icon: Settings, 
    label: 'Settings', 
    description: 'App preferences',
    color: 'from-muted-foreground to-muted-foreground/60'
  },
];

export function TVHomeCards({ 
  recentChannels = [], 
  favoriteChannels = [],
  onContinueWatching 
}: TVHomeCardsProps) {
  const { isTVMode } = useTVMode();
  const navigate = useNavigate();
  const { registerFocusable, unregisterFocusable } = useFocusManager('home', {
    rememberLastFocus: true,
  });

  return (
    <div className={cn(
      "p-6 space-y-8",
      isTVMode && "p-10 space-y-12"
    )}>
      {/* Continue Watching */}
      {recentChannels.length > 0 && (
        <section>
          <h2 className={cn(
            "font-bold text-foreground mb-4 flex items-center gap-3",
            isTVMode ? "text-3xl mb-6" : "text-xl"
          )}>
            <Play className={cn(isTVMode ? "w-8 h-8" : "w-6 h-6")} />
            Continue Watching
          </h2>
          <div className={cn(
            "grid gap-4",
            isTVMode 
              ? "grid-cols-3 gap-6" 
              : "grid-cols-2 md:grid-cols-4 gap-4"
          )}>
            {recentChannels.slice(0, isTVMode ? 3 : 4).map((channel, index) => (
              <TVCard
                key={channel.id}
                size={isTVMode ? "lg" : "md"}
                variant={index === 0 ? "highlight" : "default"}
                onClick={() => onContinueWatching?.(channel)}
                ref={(el) => {
                  if (el) registerFocusable(`recent-${channel.id}`, el, 0, index);
                  else unregisterFocusable(`recent-${channel.id}`);
                }}
              >
                <div className="flex items-center gap-4">
                  <ChannelLogo
                    src={channel.logoUrl}
                    name={channel.name}
                    size={isTVMode ? "xl" : "lg"}
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className={cn(
                      "font-semibold truncate",
                      isTVMode ? "text-xl" : "text-base"
                    )}>
                      {channel.name}
                    </h3>
                    <p className={cn(
                      "text-muted-foreground truncate",
                      isTVMode ? "text-lg" : "text-sm"
                    )}>
                      {channel.group}
                    </p>
                  </div>
                  <Play className={cn(
                    "text-primary",
                    isTVMode ? "w-10 h-10" : "w-6 h-6"
                  )} />
                </div>
              </TVCard>
            ))}
          </div>
        </section>
      )}

      {/* Main Navigation Cards */}
      <section>
        <h2 className={cn(
          "font-bold text-foreground mb-4 flex items-center gap-3",
          isTVMode ? "text-3xl mb-6" : "text-xl"
        )}>
          <Zap className={cn(isTVMode ? "w-8 h-8 text-primary" : "w-6 h-6 text-primary")} />
          Quick Access
        </h2>
        <div className={cn(
          "grid gap-4",
          isTVMode 
            ? "grid-cols-3 gap-6" 
            : "grid-cols-2 md:grid-cols-3 gap-4"
        )}>
          {mainCards.map((card, index) => (
            <TVCard
              key={card.to}
              size={isTVMode ? "xl" : "lg"}
              onClick={() => navigate(card.to)}
              ref={(el) => {
                if (el) registerFocusable(`nav-${card.to}`, el, 1, index);
                else unregisterFocusable(`nav-${card.to}`);
              }}
            >
              <div className="flex flex-col h-full">
                <div className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center mb-4",
                  `bg-gradient-to-br ${card.color}`,
                  isTVMode && "w-20 h-20 rounded-3xl mb-6"
                )}>
                  <card.icon className={cn(
                    "text-primary-foreground",
                    isTVMode ? "w-10 h-10" : "w-7 h-7"
                  )} />
                </div>
                <h3 className={cn(
                  "font-bold text-foreground",
                  isTVMode ? "text-2xl" : "text-lg"
                )}>
                  {card.label}
                </h3>
                <p className={cn(
                  "text-muted-foreground mt-1",
                  isTVMode ? "text-lg" : "text-sm"
                )}>
                  {card.description}
                </p>
              </div>
            </TVCard>
          ))}
        </div>
      </section>

      {/* Favorites Quick Access */}
      {favoriteChannels.length > 0 && (
        <section>
          <h2 className={cn(
            "font-bold text-foreground mb-4 flex items-center gap-3",
            isTVMode ? "text-3xl mb-6" : "text-xl"
          )}>
            <Star className={cn(
              "text-warning",
              isTVMode ? "w-8 h-8" : "w-6 h-6"
            )} />
            Favorites
          </h2>
          <div className={cn(
            "flex gap-4 overflow-x-auto pb-4 scrollbar-hide",
            isTVMode && "gap-6 pb-6"
          )}>
            {favoriteChannels.slice(0, 7).map((channel, index) => (
              <TVCard
                key={channel.id}
                size="md"
                className={cn(
                  "flex-shrink-0",
                  isTVMode ? "w-48" : "w-36"
                )}
                onClick={() => onContinueWatching?.(channel)}
                ref={(el) => {
                  if (el) registerFocusable(`fav-${channel.id}`, el, 2, index);
                  else unregisterFocusable(`fav-${channel.id}`);
                }}
              >
                <div className="flex flex-col items-center text-center">
                  <ChannelLogo
                    src={channel.logoUrl}
                    name={channel.name}
                    size={isTVMode ? "xl" : "lg"}
                  />
                  <h3 className={cn(
                    "font-semibold truncate w-full mt-3",
                    isTVMode ? "text-lg" : "text-sm"
                  )}>
                    {channel.name}
                  </h3>
                </div>
              </TVCard>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
