'use client';

import { useCallback, useState } from 'react';
import { usePomodoro } from '@/hooks/usePomodoro';
import { RadioGlobe } from '@/components/RadioGlobe';
import { Navbar } from '@/components/Navbar';
import type { RadioStation } from '@/types/radio';

export function PomodoroTimer() {
  const [flyToStationTrigger, setFlyToStationTrigger] = useState<RadioStation | null>(null);

  // Handle flying to a randomly selected station from pomodoro
  const handlePomodoroStationSelected = useCallback((station: RadioStation) => {
    setFlyToStationTrigger(station);
    
    // Clear the trigger after a short delay to allow for re-triggering the same station
    setTimeout(() => {
      setFlyToStationTrigger(null);
    }, 2000);
  }, []);

  const pomodoro = usePomodoro({ 
    onStationSelected: handlePomodoroStationSelected 
  });

  // Handle station selection from globe
  const handleStationSelect = useCallback(async (station: RadioStation) => {
    // Only allow manual station selection during breaks or when paused
    if (pomodoro.phase === 'work' && pomodoro.isRunning) {
      return; // Don't interrupt work sessions
    }

    try {
      await pomodoro.audio.playStation(station);
    } catch (error) {
      console.error('Failed to play selected station:', error);
    }
  }, [pomodoro.audio, pomodoro.phase, pomodoro.isRunning]);

  return (
    <div className="h-screen bg-black overflow-hidden grid grid-rows-[auto_1fr]">
      {/* Navbar */}
        <Navbar pomodoro={pomodoro} />
      
      {/* Main Content - Globe */}
      <div className="bg-gray-900 overflow-hidden">
        <RadioGlobe 
          onStationSelect={handleStationSelect}
          currentStation={pomodoro.audio.currentStation}
          flyToStationTrigger={flyToStationTrigger}
        />
      </div>
    </div>
  );
}
