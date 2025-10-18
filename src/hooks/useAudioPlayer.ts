'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { RadioStation } from '@/types/radio';
import { radioAPI } from '@/lib/radioApi';

interface AudioPlayerState {
  isPlaying: boolean;
  isLoading: boolean;
  volume: number;
  currentStation: RadioStation | null;
  error: string | null;
  isCrossfading: boolean;
}

export function useAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const crossfadeAudioRef = useRef<HTMLAudioElement | null>(null);
  const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const crossfadeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [state, setState] = useState<AudioPlayerState>({
    isPlaying: false,
    isLoading: false,
    volume: 0.7,
    currentStation: null,
    error: null,
    isCrossfading: false,
  });

  // Create audio event handlers
  const createAudioHandlers = useCallback(() => {
    const handleLoadStart = () => {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
    };

    const handleCanPlayThrough = () => {
      setState(prev => ({ ...prev, isLoading: false }));
    };

    const handleError = (e: Event) => {
      console.error('Audio error:', e);
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: 'Failed to load radio stream',
        isPlaying: false 
      }));
    };

    const handlePlay = () => {
      setState(prev => ({ ...prev, isPlaying: true }));
    };

    const handlePause = () => {
      setState(prev => ({ ...prev, isPlaying: false }));
    };

    return { handleLoadStart, handleCanPlayThrough, handleError, handlePlay, handlePause };
  }, []);

  // Initialize audio elements
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Main audio element
      audioRef.current = new Audio();
      audioRef.current.volume = 0;
      audioRef.current.preload = 'none';

      // Crossfade audio element
      crossfadeAudioRef.current = new Audio();
      crossfadeAudioRef.current.volume = 0;
      crossfadeAudioRef.current.preload = 'none';

      const handlers = createAudioHandlers();
      const audio = audioRef.current;

      audio.addEventListener('loadstart', handlers.handleLoadStart);
      audio.addEventListener('canplaythrough', handlers.handleCanPlayThrough);
      audio.addEventListener('error', handlers.handleError);
      audio.addEventListener('play', handlers.handlePlay);
      audio.addEventListener('pause', handlers.handlePause);

      return () => {
        audio.removeEventListener('loadstart', handlers.handleLoadStart);
        audio.removeEventListener('canplaythrough', handlers.handleCanPlayThrough);
        audio.removeEventListener('error', handlers.handleError);
        audio.removeEventListener('play', handlers.handlePlay);
        audio.removeEventListener('pause', handlers.handlePause);
      };
    }
  }, [createAudioHandlers]);

  // Clear intervals on unmount
  useEffect(() => {
    return () => {
      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
      }
      if (crossfadeIntervalRef.current) {
        clearInterval(crossfadeIntervalRef.current);
      }
    };
  }, []);

  const clearFadeInterval = () => {
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }
  };

  const fadeIn = useCallback((duration: number = 3) => {
    if (!audioRef.current) return;

    clearFadeInterval();
    
    const audio = audioRef.current;
    const targetVolume = state.volume;
    const steps = 50;
    const stepTime = (duration * 1000) / steps;
    const volumeStep = targetVolume / steps;
    
    audio.volume = 0;
    let currentStep = 0;

    fadeIntervalRef.current = setInterval(() => {
      if (currentStep >= steps) {
        clearFadeInterval();
        audio.volume = targetVolume;
        return;
      }
      
      audio.volume = Math.min(volumeStep * currentStep, targetVolume);
      currentStep++;
    }, stepTime);
  }, [state.volume]);

  const fadeOut = useCallback((duration: number = 3): Promise<void> => {
    return new Promise((resolve) => {
      if (!audioRef.current) {
        resolve();
        return;
      }

      clearFadeInterval();
      
      const audio = audioRef.current;
      const startVolume = audio.volume;
      const steps = 50;
      const stepTime = (duration * 1000) / steps;
      const volumeStep = startVolume / steps;
      
      let currentStep = 0;

      fadeIntervalRef.current = setInterval(() => {
        if (currentStep >= steps) {
          clearFadeInterval();
          audio.volume = 0;
          audio.pause();
          resolve();
          return;
        }
        
        audio.volume = Math.max(startVolume - (volumeStep * currentStep), 0);
        currentStep++;
      }, stepTime);
    });
  }, []);

  // Crossfade between two audio elements
  const crossfade = useCallback((fromAudio: HTMLAudioElement, toAudio: HTMLAudioElement, duration: number = 4): Promise<void> => {
    return new Promise((resolve) => {
      if (crossfadeIntervalRef.current) {
        clearInterval(crossfadeIntervalRef.current);
      }

      setState(prev => ({ ...prev, isCrossfading: true }));
      
      const steps = 50;
      const stepTime = (duration * 1000) / steps;
      const targetVolume = state.volume;
      
      const fromStartVolume = fromAudio.volume;
      const fromVolumeStep = fromStartVolume / steps;
      
      const toVolumeStep = targetVolume / steps;
      
      let currentStep = 0;


      crossfadeIntervalRef.current = setInterval(() => {
        if (currentStep >= steps) {
          // Crossfade complete
          clearInterval(crossfadeIntervalRef.current!);
          fromAudio.volume = 0;
          fromAudio.pause();
          toAudio.volume = targetVolume;
          
          setState(prev => ({ ...prev, isCrossfading: false }));
          resolve();
          return;
        }
        
        // Fade out the old station
        fromAudio.volume = Math.max(fromStartVolume - (fromVolumeStep * currentStep), 0);
        
        // Fade in the new station
        toAudio.volume = Math.min(toVolumeStep * currentStep, targetVolume);
        
        currentStep++;
      }, stepTime);
    });
  }, [state.volume]);

  const playStation = useCallback(async (station: RadioStation) => {
    if (!audioRef.current || !crossfadeAudioRef.current) return;

    try {
      const isCurrentlyPlaying = state.isPlaying && audioRef.current.volume > 0 && !audioRef.current.paused;
      
      if (isCurrentlyPlaying) {
        // Sequential transition: fade out current → fade in new
        
        // Register click with radio-browser API
        await radioAPI.registerClick(station.stationuuid);

        // Load new station in crossfade audio element while current continues
        crossfadeAudioRef.current.src = station.url_resolved || station.url;
        crossfadeAudioRef.current.volume = 0;
        
        setState(prev => ({ ...prev, currentStation: station, error: null, isLoading: true, isCrossfading: true }));

        // Load new station in background
        await new Promise<void>((resolve, reject) => {
          const handleCanPlay = () => {
            crossfadeAudioRef.current!.removeEventListener('canplay', handleCanPlay);
            crossfadeAudioRef.current!.removeEventListener('error', handleError);
            resolve();
          };
          
          const handleError = () => {
            crossfadeAudioRef.current!.removeEventListener('canplay', handleCanPlay);
            crossfadeAudioRef.current!.removeEventListener('error', handleError);
            reject(new Error('Failed to load new station'));
          };
          
          crossfadeAudioRef.current!.addEventListener('canplay', handleCanPlay);
          crossfadeAudioRef.current!.addEventListener('error', handleError);
          
          crossfadeAudioRef.current!.load();
        });

        setState(prev => ({ ...prev, isLoading: false }));
        
        // Step 1: Fade out current station completely
        await fadeOut(2); // 2 second fade out
        
        // Step 2: Switch to new station and fade in
        audioRef.current.src = crossfadeAudioRef.current.src;
        audioRef.current.volume = 0;
        
        await audioRef.current.play();
        fadeIn(2); // 2 second fade in
        
        // Clean up the crossfade element
        crossfadeAudioRef.current.pause();
        crossfadeAudioRef.current.volume = 0;
        crossfadeAudioRef.current.removeAttribute('src');
        crossfadeAudioRef.current.load();
        
        setState(prev => ({ ...prev, isCrossfading: false }));
        
      } else {
        // No current station playing, just start the new one normally
        
        // Stop any existing playback
        clearFadeInterval();
        audioRef.current.pause();
        audioRef.current.volume = 0;

        // Register click with radio-browser API
        await radioAPI.registerClick(station.stationuuid);

        // Load new station with proper error handling
        audioRef.current.src = station.url_resolved || station.url;
        audioRef.current.volume = 0;
        setState(prev => ({ ...prev, currentStation: station, error: null }));

        // Wait for station to load successfully before proceeding
        await new Promise<void>((resolve, reject) => {
          const handleCanPlay = () => {
            audioRef.current!.removeEventListener('canplay', handleCanPlay);
            audioRef.current!.removeEventListener('error', handleError);
            resolve();
          };
          
          const handleError = () => {
            audioRef.current!.removeEventListener('canplay', handleCanPlay);
            audioRef.current!.removeEventListener('error', handleError);
            reject(new Error('Failed to load station'));
          };
          
          audioRef.current!.addEventListener('canplay', handleCanPlay);
          audioRef.current!.addEventListener('error', handleError);
          
          audioRef.current!.load();
        });

        // Play and fade in
        await audioRef.current.play();
        fadeIn();
      }
    } catch (error) {
      console.error('Failed to play station:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to play radio station',
        isPlaying: false,
        isLoading: false,
        isCrossfading: false,
      }));
      throw error; // Re-throw to allow retry logic in usePomodoro
    }
  }, [fadeIn, crossfade, state.isPlaying, state.currentStation]);

  const stopWithFade = useCallback(async (fadeDuration: number = 3) => {
    if (!audioRef.current) {
      setState(prev => ({ ...prev, currentStation: null, isPlaying: false }));
      return;
    }

    try {
      await fadeOut(fadeDuration);
      
      // Ensure the audio is completely stopped and state is cleared
      clearFadeInterval();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.volume = 0;
      }
      
      setState(prev => ({ 
        ...prev, 
        currentStation: null, 
        isPlaying: false,
        error: null 
      }));
    } catch (error) {
      console.error('Error stopping audio:', error);
      setState(prev => ({ 
        ...prev, 
        currentStation: null, 
        isPlaying: false,
        error: 'Failed to stop audio'
      }));
    }
  }, [fadeOut, state.currentStation, state.isPlaying]);

  const pause = useCallback(() => {
    if (!audioRef.current) return;
    
    clearFadeInterval();
    audioRef.current.pause();
    setState(prev => ({ ...prev, isPlaying: false }));
  }, []);

  const resume = useCallback(() => {
    if (!audioRef.current || !state.currentStation) return;
    
    audioRef.current.volume = state.volume;
    audioRef.current.play().catch(error => {
      console.error('Failed to resume audio:', error);
      setState(prev => ({ ...prev, error: 'Failed to resume audio' }));
    });
  }, [state.currentStation, state.volume]);

  const stop = useCallback(() => {
    if (!audioRef.current) return;
    
    clearFadeInterval();
    audioRef.current.pause();
    audioRef.current.volume = 0;
    setState(prev => ({ ...prev, isPlaying: false, currentStation: null }));
  }, []);

  const setVolume = useCallback((volume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    setState(prev => ({ ...prev, volume: clampedVolume }));
    
    // Update volume for the currently active audio element
    if (audioRef.current && state.isPlaying && !state.isCrossfading) {
      audioRef.current.volume = clampedVolume;
    }
  }, [state.isPlaying, state.isCrossfading]);

  return {
    ...state,
    playStation,
    pause,
    resume,
    stop,
    stopWithFade,
    setVolume,
    fadeIn,
    fadeOut,
    crossfade,
  };
}
