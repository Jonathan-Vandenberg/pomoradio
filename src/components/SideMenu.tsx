'use client';

import { useState, useEffect } from 'react';
import { Menu, Timer, Check, ChevronDown, ChevronRight, Globe, Radio, Play, Square, Volume2, Heart } from 'lucide-react';
import { usePomodoro } from '@/hooks/usePomodoro';
import { getCountryFlag } from '@/utils/countryFlags';
import type { RadioStation } from '@/types/radio';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"

interface SideMenuProps {
  pomodoroEnabled: boolean;
  onPomodoroToggle: (enabled: boolean) => void;
  pomodoro: ReturnType<typeof usePomodoro>;
  onStationSelect: (station: RadioStation) => void;
  onFlyToStation: (station: RadioStation) => void;
}

export function SideMenu({ pomodoroEnabled, onPomodoroToggle, pomodoro, onStationSelect, onFlyToStation }: SideMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [countries, setCountries] = useState<{[key: string]: RadioStation[]}>({});
  const [expandedCountries, setExpandedCountries] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [favoriteStations, setFavoriteStations] = useState<RadioStation[]>([]);

  // Load and group stations by country
  useEffect(() => {
    const loadStations = async () => {
      try {
        const response = await fetch('/radio-stations.json');
        const data = await response.json();
        const stations = data.stations as RadioStation[];
        
        // Group stations by country
        const grouped: {[key: string]: RadioStation[]} = {};
        stations.forEach(station => {
          if (!grouped[station.country]) {
            grouped[station.country] = [];
          }
          grouped[station.country].push(station);
        });
        
        // Sort countries alphabetically and sort stations within each country by name
        Object.keys(grouped).forEach(country => {
          grouped[country].sort((a, b) => a.name.localeCompare(b.name));
        });
        
        setCountries(grouped);
        setLoading(false);
      } catch (error) {
        console.error('Failed to load radio stations:', error);
        setLoading(false);
      }
    };
    loadStations();
  }, []);

  // Load favorites from localStorage
  useEffect(() => {
    const savedFavorites = localStorage.getItem('radio-favorites');
    if (savedFavorites) {
      try {
        const favoriteIds = JSON.parse(savedFavorites) as string[];
        setFavorites(new Set(favoriteIds));
      } catch (error) {
        console.error('Failed to load favorites:', error);
      }
    }
  }, []);

  // Update favorite stations when favorites or countries change
  useEffect(() => {
    const allStations = Object.values(countries).flat();
    const favStations = allStations.filter(station => favorites.has(station.stationuuid));
    setFavoriteStations(favStations);
  }, [favorites, countries]);

  const toggleFavorite = (station: RadioStation, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent any bubbling
    
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(station.stationuuid)) {
        newFavorites.delete(station.stationuuid);
      } else {
        newFavorites.add(station.stationuuid);
      }
      
      // Save to localStorage
      localStorage.setItem('radio-favorites', JSON.stringify(Array.from(newFavorites)));
      
      return newFavorites;
    });
  };

  const toggleCountry = (country: string) => {
    setExpandedCountries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(country)) {
        newSet.delete(country);
      } else {
        newSet.add(country);
      }
      return newSet;
    });
  };

  const handleStationClick = (station: RadioStation) => {
    onStationSelect(station);
    onFlyToStation(station);
    // Close menu after selection
    setTimeout(() => setIsOpen(false), 300);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon"
          className="fixed top-4 left-4 z-50 bg-black/20 backdrop-blur-sm hover:bg-black/40 text-white border border-white/20"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80 bg-gray-900/95 backdrop-blur-xl border-gray-700 !p-6">
        <SheetHeader className="space-y-4">
          <SheetTitle className="text-white text-xl font-bold">
            Options
          </SheetTitle>
          <SheetDescription className="text-gray-300">
            Configure your focus settings
          </SheetDescription>
        </SheetHeader>
        
        <div className="space-y-4 mt-8">
          <button
            onClick={() => {
              const newEnabled = !pomodoroEnabled;
              
              // If disabling Pomodoro, reset the timer and stop any audio
              if (!newEnabled && pomodoroEnabled) {
                pomodoro.reset();
              }
              
              onPomodoroToggle(newEnabled);
              // Close the menu after toggling
              setTimeout(() => setIsOpen(false), 300);
            }}
            className={`flex items-center gap-3 w-full p-3 rounded-lg transition-all duration-200 text-left ${
              pomodoroEnabled 
                ? 'bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50' 
                : 'bg-gray-800/50 hover:bg-gray-800/70 border border-transparent'
            }`}
          >
            <Timer className={`h-5 w-5 transition-colors ${pomodoroEnabled ? 'text-blue-400' : 'text-gray-400'}`} />
            <span className="text-white font-medium flex-1">Pomodoro Timer</span>
            <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all duration-200 ${
              pomodoroEnabled 
                ? 'bg-blue-500 border-blue-500 scale-100' 
                : 'border-gray-400 scale-95'
            }`}>
              {pomodoroEnabled && <Check className="h-4 w-4 text-white" />}
            </div>
          </button>
          
          {/* Status text */}
          <div className="text-sm px-3 space-y-2 !py-4">
            {pomodoroEnabled ? (
              <div className="space-y-1">
                <div className="text-blue-400 font-medium">✓ Pomodoro timer is active</div>
                <div className="text-gray-300">
                  <div className="flex justify-between">
                    <span>Phase:</span>
                    <span className={`capitalize ${
                      pomodoro.phase === 'work' ? 'text-red-400' :
                      pomodoro.phase === 'shortBreak' ? 'text-green-400' :
                      'text-blue-400'
                    }`}>
                      {pomodoro.phase === 'work' ? 'Focus Time' :
                       pomodoro.phase === 'shortBreak' ? 'Short Break' :
                       'Long Break'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Time:</span>
                    <span className="font-mono">{pomodoro.timeDisplay}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Session:</span>
                    <span>{pomodoro.currentCycle}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Completed:</span>
                    <span>{pomodoro.completedSessions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Status:</span>
                    <span className={pomodoro.isRunning ? 'text-green-400' : 'text-yellow-400'}>
                      {pomodoro.isRunning ? 'Running' : 'Paused'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-gray-400">
                <div>Pomodoro timer is disabled</div>
                <div className="text-xs mt-1 text-gray-500">
                  Click above to enable focus sessions with timed radio breaks
                </div>
              </div>
            )}
          </div>

          {/* Currently Playing Station */}
          <div className="border-t border-gray-700 !py-4">
            <div className="flex items-center gap-2 !mb-4">
              <Radio className="h-5 w-5 text-gray-400" />
              <h3 className="text-white font-semibold">Now Playing</h3>
            </div>
            
            {pomodoro.audio.currentStation ? (
              <div className="!space-y-4">
                {/* Station Info */}
                <div className="bg-gray-800/50 rounded-lg !p-4 !space-y-3">
                  <div className="flex items-center mb-3">
                    <span className="text-3xl">
                      {getCountryFlag(pomodoro.audio.currentStation.countrycode)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-medium truncate">
                        {pomodoro.audio.currentStation.country}
                      </div>
                      <div className="text-sm text-gray-300 truncate">
                        {pomodoro.audio.currentStation.name}
                      </div>
                      {pomodoro.audio.currentStation.codec && pomodoro.audio.currentStation.bitrate && (
                        <div className="text-xs text-gray-400 !mt-1">
                          {pomodoro.audio.currentStation.codec} • {pomodoro.audio.currentStation.bitrate}kbps
                        </div>
                      )}
                    </div>
                    
                    {/* Favorite Heart */}
                    <button
                      onClick={(e) => toggleFavorite(pomodoro.audio.currentStation!, e)}
                      className="p-2 rounded-lg hover:bg-gray-700/50 transition-colors"
                      title={favorites.has(pomodoro.audio.currentStation!.stationuuid) ? "Remove from favorites" : "Add to favorites"}
                    >
                      <Heart 
                        className={`h-5 w-5 transition-colors ${
                          favorites.has(pomodoro.audio.currentStation!.stationuuid)
                            ? 'text-red-500 fill-red-500' 
                            : 'text-gray-400 hover:text-red-400'
                        }`}
                      />
                    </button>
                  </div>
                  
                  {/* Controls */}
                  <div className="!space-y-3">
                    {/* Play/Pause Button */}
                    <button
                      onClick={() => pomodoro.audio.isPlaying ? pomodoro.audio.pause() : pomodoro.audio.resume()}
                      className="w-full flex items-center justify-center gap-2 !py-2 !px-4 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 rounded-lg text-white transition-colors"
                    >
                      {pomodoro.audio.isPlaying ? (
                        <>
                          <Square className="h-4 w-4" />
                          <span>Pause Radio</span>
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4" />
                          <span>Play Radio</span>
                        </>
                      )}
                    </button>
                    
                    {/* Volume Control */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-gray-300">
                        <Volume2 className="h-4 w-4" />
                        <span>Volume</span>
                        <span className="ml-auto text-xs">
                          {Math.round(pomodoro.audio.volume * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={pomodoro.audio.volume}
                        onChange={(e) => pomodoro.audio.setVolume(parseFloat(e.target.value))}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                        style={{
                          background: `linear-gradient(to right, rgb(59 130 246) 0%, rgb(59 130 246) ${pomodoro.audio.volume * 100}%, rgb(55 65 81) ${pomodoro.audio.volume * 100}%, rgb(55 65 81) 100%)`
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-gray-800/30 rounded-lg p-4 text-center">
                <div className="flex items-center justify-center gap-2 text-gray-400 mb-2">
                  <Radio className="h-5 w-5" />
                  <span className="text-sm">No station selected</span>
                </div>
                <p className="text-xs text-gray-500">
                  Select a radio station from the list below or click on the globe
                </p>
              </div>
            )}
          </div>

          {/* Favorites Section */}
          <div className="border-t border-gray-700 !py-4">
            <div className="flex items-center gap-2 !mb-4">
              <Heart className="h-5 w-5 text-gray-400" />
              <h3 className="text-white font-semibold">Favorites</h3>
              <span className="text-gray-400 text-xs ml-auto">
                ({favoriteStations.length})
              </span>
            </div>
            
            {favoriteStations.length > 0 ? (
              <div className="!space-y-2 max-h-48 overflow-y-auto">
                {favoriteStations.map((station) => (
                  <div
                    key={station.stationuuid}
                    className={`flex items-center gap-2 w-full !p-2 rounded-lg transition-colors cursor-pointer ${
                      pomodoro.audio.currentStation?.stationuuid === station.stationuuid
                        ? 'bg-blue-500/20 border border-blue-500/50'
                        : 'hover:bg-gray-800/50'
                    }`}
                  >
                    <div 
                      onClick={() => handleStationClick(station)}
                      className="flex items-center gap-2 flex-1 min-w-0"
                    >
                      <span className="text-lg flex-shrink-0">
                        {getCountryFlag(station.countrycode)}
                      </span>
                      <Radio className="h-3 w-3 text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-sm truncate">
                          {station.name}
                        </div>
                        <div className="text-xs text-gray-400">
                          {station.country}
                          {station.codec && station.bitrate && (
                            <span> • {station.codec} {station.bitrate}kbps</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => toggleFavorite(station, e)}
                      className="p-1 rounded hover:bg-gray-700/50 transition-colors flex-shrink-0"
                      title="Remove from favorites"
                    >
                      <Heart className="h-4 w-4 text-red-500 fill-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-gray-800/30 rounded-lg p-4 text-center">
                <Heart className="h-8 w-8 text-gray-600 mx-auto mb-2" />
                <div className="text-gray-400 text-sm mb-1">No favorites yet</div>
                <p className="text-xs text-gray-500">
                  Click the ♥ icon next to any station to add it to your favorites
                </p>
              </div>
            )}
          </div>

          {/* Radio Stations by Country */}
          <div className="border-t border-gray-700 !py-6">
            <div className="flex items-center gap-2 !mb-4">
              <Globe className="h-5 w-5 text-gray-400" />
              <h3 className="text-white font-semibold">Radio Stations</h3>
            </div>
            
            {loading ? (
              <div className="text-gray-400 text-sm px-3">Loading stations...</div>
            ) : (
              <div className="!space-y-2 max-h-96 overflow-y-auto">
                {Object.entries(countries)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([country, stations]) => {
                    const countryCode = stations[0]?.countrycode || '';
                    const isExpanded = expandedCountries.has(country);
                    
                    return (
                      <div key={country} className="!space-y-1">
                        {/* Country Header */}
                        <button
                          onClick={() => toggleCountry(country)}
                          className="flex items-center !gap-2 w-full p-2 rounded-lg hover:bg-gray-800/50 transition-colors text-left"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                          )}
                          <span className="text-xl flex-shrink-0">
                            {getCountryFlag(countryCode)}
                          </span>
                          <span className="text-white text-sm font-medium truncate">
                            {country}
                          </span>
                          <span className="text-gray-400 text-xs ml-auto flex-shrink-0">
                            ({stations.length})
                          </span>
                        </button>
                        
                        {/* Stations List */}
                        {isExpanded && (
                          <div className="!ml-6 !space-y-1">
                            {stations.map((station) => (
                              <div
                                key={station.stationuuid}
                                className={`flex items-center gap-2 w-full !p-2 rounded-lg transition-colors cursor-pointer ${
                                  pomodoro.audio.currentStation?.stationuuid === station.stationuuid
                                    ? 'bg-blue-500/20 border border-blue-500/50'
                                    : 'hover:bg-gray-800/50'
                                }`}
                              >
                                <div
                                  onClick={() => handleStationClick(station)}
                                  className="flex items-center gap-2 flex-1 min-w-0"
                                >
                                  <Radio className="h-3 w-3 text-gray-400 flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-white text-sm truncate">
                                      {station.name}
                                    </div>
                                    {station.codec && station.bitrate && (
                                      <div className="text-xs text-gray-400">
                                        {station.codec} • {station.bitrate}kbps
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <button
                                  onClick={(e) => toggleFavorite(station, e)}
                                  className="p-1 rounded hover:bg-gray-700/50 transition-colors flex-shrink-0"
                                  title={favorites.has(station.stationuuid) ? "Remove from favorites" : "Add to favorites"}
                                >
                                  <Heart 
                                    className={`h-4 w-4 transition-colors ${
                                      favorites.has(station.stationuuid)
                                        ? 'text-red-500 fill-red-500' 
                                        : 'text-gray-400 hover:text-red-400'
                                    }`}
                                  />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
