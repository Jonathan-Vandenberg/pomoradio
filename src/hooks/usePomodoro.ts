'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { PomodoroSettings, PomodoroState, PomodoroPhase } from '@/types/pomodoro';
import type { RadioStation } from '@/types/radio';
import { useAudioPlayer } from './useAudioPlayer';

const DEFAULT_SETTINGS: PomodoroSettings = {
  workDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  sessionsUntilLongBreak: 4,
  fadeInDuration: 3,
  fadeOutDuration: 3,
};

interface PomodoroOptions {
  settings?: Partial<PomodoroSettings>;
  onStationSelected?: (station: RadioStation) => void;
}

export function usePomodoro(options: PomodoroOptions = {}) {
  const { settings = {}, onStationSelected } = options;
  const fullSettings = { ...DEFAULT_SETTINGS, ...settings };
  const audio = useAudioPlayer();
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const stationsRef = useRef<RadioStation[]>([]);

  const [state, setState] = useState<PomodoroState>({
    phase: 'work',
    timeRemaining: fullSettings.workDuration * 60,
    isRunning: false,
    completedSessions: 0,
    currentCycle: 1,
  });

  // Load random stations for breaks
  useEffect(() => {
    const loadStations = async () => {
      try {
        // Fetch all stations from the pre-generated JSON, then filter for playable ones
        const response = await fetch('/radio-stations.json');
        const data = await response.json();
        // All stations in the JSON are already filtered for lastcheckok === 1 during generation
        // Filter for stations that have both a working URL and valid coordinates (for globe positioning)
        stationsRef.current = data.stations.filter((s: any) => 
          s.url_resolved && 
          s.lat != null && 
          s.lng != null &&
          typeof s.lat === 'number' && 
          typeof s.lng === 'number' &&
          !isNaN(s.lat) &&
          !isNaN(s.lng)
        );
        console.log(`Loaded ${stationsRef.current.length} playable stations with coordinates for pomodoro breaks out of ${data.totalStations} total.`);
      } catch (error) {
        console.error('Failed to load radio stations for pomodoro:', error);
      }
    };
    loadStations();
  }, []);

  const getNextPhase = useCallback((currentPhase: PomodoroPhase, completedSessions: number): PomodoroPhase => {
    if (currentPhase === 'work') {
      const isLongBreak = (completedSessions + 1) % fullSettings.sessionsUntilLongBreak === 0;
      return isLongBreak ? 'longBreak' : 'shortBreak';
    }
    return 'work';
  }, [fullSettings.sessionsUntilLongBreak]);

  const getDurationForPhase = useCallback((phase: PomodoroPhase): number => {
    switch (phase) {
      case 'work':
        return fullSettings.workDuration * 60;
      case 'shortBreak':
        return fullSettings.shortBreakDuration * 60;
      case 'longBreak':
        return fullSettings.longBreakDuration * 60;
      default:
        return fullSettings.workDuration * 60;
    }
  }, [fullSettings]);

  const playRandomStation = useCallback(async () => {
    if (stationsRef.current.length === 0) {
      console.warn('No radio stations available for pomodoro breaks');
      return;
    }
    
    const maxRetries = 5; // Try up to 5 different stations
    let attempts = 0;
    const availableStations = [...stationsRef.current]; // Create a copy to avoid modifying original
    
    while (attempts < maxRetries && availableStations.length > 0) {
      const randomIndex = Math.floor(Math.random() * availableStations.length);
      const station = availableStations[randomIndex];
      
      try {
        await audio.playStation(station);
        
        // Only trigger flight AFTER successful playback
        if (onStationSelected) {
          onStationSelected(station);
        }
        
        return; // Success! Exit the retry loop
        
      } catch (error) {
        console.warn(`❌ Failed to play ${station.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        
        // Remove the failed station from this attempt's available list
        availableStations.splice(randomIndex, 1);
        attempts++;
        
        // If this wasn't the last attempt, wait a moment before trying the next station
        if (attempts < maxRetries && availableStations.length > 0) {
          console.log(`⏳ Trying another station in 1 second... (${availableStations.length} remaining)`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    // If we get here, all retry attempts failed
    console.error(`❌ Failed to play any radio station after ${maxRetries} attempts`);
  }, [audio, onStationSelected]);


  const tick = useCallback(() => {
    setState(prev => {
      const newTimeRemaining = prev.timeRemaining - 1;
      
      // Handle actions 3 seconds before phase ends
      if (newTimeRemaining === 3) {
        if (prev.phase === 'work') {
          // Start searching for radio station 3 seconds before work ends
          playRandomStation().catch(console.error);
        } else {
          // Start fadeout and stop music 3 seconds before break ends
          audio.stopWithFade(3).catch(console.error);
        }
      }
      
      // Handle phase transitions when timer reaches 0
      if (newTimeRemaining <= 0) {
        const nextPhase = getNextPhase(prev.phase, prev.completedSessions);
        const nextDuration = getDurationForPhase(nextPhase);
        
        if (prev.phase === 'work') {
          // Work completed → Break starts
          return {
            ...prev,
            phase: nextPhase,
            timeRemaining: nextDuration,
            completedSessions: prev.completedSessions + 1,
          };
        } else {
          // Break completed → Work starts
          // Failsafe: Force stop any audio that might still be playing
          if (audio.isPlaying || audio.currentStation) {
            audio.stop(); // Immediate stop without fade
          }
          
          return {
            ...prev,
            phase: nextPhase,
            timeRemaining: nextDuration,
            currentCycle: nextPhase === 'work' ? prev.currentCycle + 1 : prev.currentCycle,
          };
        }
      }
      
      return { ...prev, timeRemaining: newTimeRemaining };
    });
  }, [audio, playRandomStation, getNextPhase, getDurationForPhase]);

  const start = useCallback(() => {
    if (state.isRunning) return;
    
    // If starting a work session and radio is playing, fade it out
    if (state.phase === 'work' && (audio.isPlaying || audio.currentStation)) {
      console.log('🔇 Starting work session - fading out radio...');
      audio.stopWithFade(2); // 2-second fade out
    }
    
    setState(prev => ({ ...prev, isRunning: true }));
    
    // Start timer
    timerRef.current = setInterval(tick, 1000);
  }, [state.isRunning, state.phase, audio, tick]);

  const pause = useCallback(() => {
    if (!state.isRunning) return;
    
    setState(prev => ({ ...prev, isRunning: false }));
    
    // Clear timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [state.isRunning]);

  const reset = useCallback(async () => {
    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Stop audio completely
    if (audio.isPlaying || audio.currentStation) {
      audio.stop();
    }
    
    // Reset state
    setState({
      phase: 'work',
      timeRemaining: fullSettings.workDuration * 60,
      isRunning: false,
      completedSessions: 0,
      currentCycle: 1,
    });
  }, [audio, fullSettings.workDuration]);

  const skip = useCallback(() => {
    setState(prev => {
      const nextPhase = getNextPhase(prev.phase, prev.completedSessions);
      const nextDuration = getDurationForPhase(nextPhase);
      
      // Trigger radio search or fadeout immediately when skipping
      if (nextPhase !== 'work') {
        // Skipping to break - start radio immediately
        playRandomStation().catch(console.error);
      } else {
        // Skipping to work - stop radio immediately with quick fade
        audio.stopWithFade(1).catch(console.error);
      }
      
      if (prev.phase === 'work') {
        // Work skipped → Break starts
        return {
          ...prev,
          phase: nextPhase,
          timeRemaining: nextDuration,
          completedSessions: prev.completedSessions + 1,
        };
      } else {
        // Break skipped → Work starts
        return {
          ...prev,
          phase: nextPhase,
          timeRemaining: nextDuration,
          currentCycle: nextPhase === 'work' ? prev.currentCycle + 1 : prev.currentCycle,
        };
      }
    });
  }, [getNextPhase, getDurationForPhase, playRandomStation, audio]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Format time for display
  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return {
    ...state,
    settings: fullSettings,
    audio,
    start,
    pause,
    reset,
    skip,
    formatTime,
    timeDisplay: formatTime(state.timeRemaining),
  };
}
