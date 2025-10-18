'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type { RadioStation } from '@/types/radio';
import { radioAPI } from '@/lib/radioApi';

// Dynamically import Globe to avoid SSR issues
const Globe = dynamic(() => import('react-globe.gl'), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-900">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <div className="text-white text-lg">Loading Globe...</div>
      </div>
    </div>
  )
}) as any;

interface StationMarker extends RadioStation {
  lat: number;
  lng: number;
  color: string;
}

interface RadioGlobeProps {
  onStationSelect?: (station: RadioStation) => void;
  currentStation?: RadioStation | null;
  flyToStationTrigger?: RadioStation | null;
}

export function RadioGlobe({ onStationSelect, currentStation, flyToStationTrigger }: RadioGlobeProps) {
  const globeEl = useRef<any>(null);
  const [stations, setStations] = useState<StationMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [globeReady, setGlobeReady] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [userHasInteracted, setUserHasInteracted] = useState(false);
  const [isFlying, setIsFlying] = useState(false);
  const [isCurrentStationBright, setIsCurrentStationBright] = useState(true);
  const [currentAltitude, setCurrentAltitude] = useState(2.5);
  const [visibleStations, setVisibleStations] = useState<StationMarker[]>([]);
  const flyingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const blinkTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inactivityTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load radio stations from cached JSON file
  useEffect(() => {
    const loadStations = async () => {
      try {
        setLoading(true);
        console.log('Loading radio stations from cached data...');
        
        // Fetch the pre-generated stations data
        const response = await fetch('/radio-stations.json');
        if (!response.ok) {
          throw new Error(`Failed to load stations data: ${response.status}`);
        }
        
        const radioData = await response.json();
        console.log(`Loaded ${radioData.totalStations} stations from ${radioData.totalCountries} countries (generated: ${new Date(radioData.generated).toLocaleString()})`);
        
        // Convert to StationMarker format
        const stationMarkers: StationMarker[] = radioData.stations.map((station: any) => ({
          ...station,
          color: getStationColor(station),
        }));

        console.log(`Globe will render ${stationMarkers.length} station markers:`);
        console.log('Sample markers:', stationMarkers.slice(0, 5).map(s => ({
          name: s.name,
          lat: s.lat,
          lng: s.lng,
          color: s.color,
          country: s.country
        })));

        setStations(stationMarkers);
      } catch (error) {
        console.error('Failed to load cached stations data:', error);
        
        // Fallback to API if cached data fails
        console.log('Falling back to live API...');
        try {
          const popularStations = await radioAPI.getPopularStations(50);
          const stationMarkers: StationMarker[] = popularStations
            .filter(station => station.geo_lat && station.geo_long && station.lastcheckok === 1)
            .map(station => ({
              ...station,
              lat: station.geo_lat,
              lng: station.geo_long,
              color: getStationColor(station),
            }));
          setStations(stationMarkers);
          console.log(`Fallback loaded ${stationMarkers.length} stations`);
        } catch (fallbackError) {
          console.error('Fallback API request also failed:', fallbackError);
        }
      } finally {
        setLoading(false);
      }
    };

    loadStations();
  }, []);

  // Get color for station marker based on properties
  const getStationColor = useCallback((station: RadioStation): string => {
    // Color by bitrate quality
    if (station.bitrate >= 256) return '#00ff00'; // High quality - green
    if (station.bitrate >= 128) return '#ffff00'; // Medium quality - yellow
    if (station.bitrate >= 64) return '#ff8800';  // Low quality - orange
    return '#ff4444'; // Very low quality - red
  }, []);

  // Calculate distance between two coordinates in degrees
  const calculateDistance = useCallback((lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const dLat = Math.abs(lat1 - lat2);
    const dLng = Math.abs(lng1 - lng2);
    return Math.sqrt(dLat * dLat + dLng * dLng);
  }, []);

  // Filter stations based on zoom level to reduce overlap
  const filterStationsByZoom = useCallback((allStations: StationMarker[], altitude: number): StationMarker[] => {
    if (allStations.length === 0) return [];

    // Always show the current playing station
    const currentStationMarker = currentStation 
      ? allStations.find(s => s.stationuuid === currentStation.stationuuid)
      : null;

    // Define zoom thresholds and minimum distances
    const getZoomConfig = (alt: number) => {
      if (alt > 3) return { minDistance: 8, maxStations: 50, priorityThreshold: 50000 }; // Very zoomed out
      if (alt > 2) return { minDistance: 4, maxStations: 150, priorityThreshold: 20000 }; // Zoomed out
      if (alt > 1.5) return { minDistance: 2, maxStations: 300, priorityThreshold: 5000 }; // Medium zoom
      if (alt > 1) return { minDistance: 1, maxStations: 500, priorityThreshold: 1000 }; // Zoomed in
      if (alt > 0.5) return { minDistance: 0.3, maxStations: 800, priorityThreshold: 0 }; // Close zoom
      return { minDistance: 0, maxStations: Infinity, priorityThreshold: 0 }; // Very close - show ALL stations
    };

    const config = getZoomConfig(altitude);
    
    // Sort stations by votes (popularity) for better selection
    const sortedStations = [...allStations].sort((a, b) => b.votes - a.votes);
    
    const filtered: StationMarker[] = [];
    
    // Always include current station first
    if (currentStationMarker) {
      filtered.push(currentStationMarker);
    }

    for (const station of sortedStations) {
      // Skip if already included (current station)
      if (currentStationMarker && station.stationuuid === currentStationMarker.stationuuid) {
        continue;
      }

      // Check if we've reached the maximum stations for this zoom level
      if (filtered.length >= config.maxStations) {
        break;
      }

      // Check if station is too close to any already filtered station
      const tooClose = filtered.some(existing => 
        calculateDistance(station.lat, station.lng, existing.lat, existing.lng) < config.minDistance
      );

      if (!tooClose) {
        filtered.push(station);
      }
    }

    console.log(`🔍 Zoom filter: altitude ${altitude.toFixed(2)} → showing ${filtered.length} of ${allStations.length} stations`);
    return filtered;
  }, [calculateDistance, currentStation]);

  // Return to starting position and resume auto-rotation after inactivity
  const returnToStartingPosition = useCallback(() => {
    if (!globeEl.current || !globeReady) return;

    const globe = globeEl.current;
    console.log('🔄 Returning to starting position after 15 seconds of inactivity');

    // Smoothly return to starting position
    globe.pointOfView({
      lat: 20,
      lng: 0,
      altitude: 2.5
    }, 3000); // 3 second smooth transition

    // Reset interaction state and resume auto-rotation
    setUserHasInteracted(false);
    setAutoRotate(true);
  }, [globeReady]);

  // Start inactivity timeout
  const startInactivityTimeout = useCallback(() => {
    // Clear any existing timeout
    if (inactivityTimeoutRef.current) {
      clearTimeout(inactivityTimeoutRef.current);
    }

    // Only start timeout if user has interacted (no need to auto-return if already at start)
    if (userHasInteracted) {
      inactivityTimeoutRef.current = setTimeout(() => {
        returnToStartingPosition();
      }, 15000); // 15 seconds
    }
  }, [userHasInteracted, returnToStartingPosition]);

  // Reset inactivity timeout on any interaction
  const resetInactivityTimeout = useCallback(() => {
    startInactivityTimeout();
  }, [startInactivityTimeout]);

  // Update visible stations when altitude or stations change
  useEffect(() => {
    if (stations.length > 0) {
      const filtered = filterStationsByZoom(stations, currentAltitude);
      setVisibleStations(filtered);
    }
  }, [stations, currentAltitude, filterStationsByZoom]);

  // Track altitude changes for zoom-based filtering
  useEffect(() => {
    if (!globeEl.current || !globeReady) return;

    const globe = globeEl.current;
    const controls = globe.controls();

    const updateAltitude = () => {
      const pov = globe.pointOfView();
      if (pov && pov.altitude) {
        setCurrentAltitude(prev => {
          // Only update if altitude has changed significantly to avoid excessive re-renders
          const newAltitude = pov.altitude;
          if (Math.abs(newAltitude - prev) > 0.01) {
            return newAltitude;
          }
          return prev;
        });
      }
    };

    // Listen for camera movements
    controls.addEventListener('change', updateAltitude);

    // Initial altitude update
    updateAltitude();

    return () => {
      controls.removeEventListener('change', updateAltitude);
    };
  }, [globeReady]); // Removed currentAltitude from dependency array to prevent infinite loop

  // Stop auto-rotation on user interaction and start inactivity timeout
  const handleUserInteraction = useCallback(() => {
    if (!userHasInteracted) {
      console.log('🔄 User interaction detected - stopping auto-rotation and starting inactivity timer');
      setUserHasInteracted(true);
      setAutoRotate(false);
      startInactivityTimeout(); // Start the 15-second timeout
    } else {
      // Reset the timeout on subsequent interactions
      resetInactivityTimeout();
    }
  }, [userHasInteracted, startInactivityTimeout, resetInactivityTimeout]);

  // Smooth arc-like fly-to animation for station clicks
  const flyToStation = useCallback((station: StationMarker) => {
    if (!globeEl.current) return;

    const globe = globeEl.current;
    
    // Clear any existing flying animation
    if (flyingTimeoutRef.current) {
      clearTimeout(flyingTimeoutRef.current);
    }
    
    // Set flying state
    setIsFlying(true);
    
    // Get current point of view
    const currentPov = globe.pointOfView();
    const startLat = currentPov.lat;
    const startLng = currentPov.lng;
    const startAltitude = currentPov.altitude;
    
    const targetLat = station.lat;
    const targetLng = station.lng;
    const finalAltitude = 1.2;
    
    // Calculate great circle distance for duration scaling
    const distance = Math.acos(
      Math.sin(startLat * Math.PI / 180) * Math.sin(targetLat * Math.PI / 180) +
      Math.cos(startLat * Math.PI / 180) * Math.cos(targetLat * Math.PI / 180) * 
      Math.cos((targetLng - startLng) * Math.PI / 180)
    );
    
    // Duration based on distance (longer for far destinations)
    const baseDuration = 2500;
    const duration = Math.max(2000, Math.min(4000, baseDuration + distance * 800));
    
    console.log(`🛫 Flying to ${station.name} (${station.country}) - Distance: ${(distance * 180/Math.PI).toFixed(1)}°, Duration: ${duration}ms`);
    
    // Super simple: just fly directly to the target
    // Let globe.gl handle ALL the smooth interpolation
    globe.pointOfView({
      lat: targetLat,
      lng: targetLng,
      altitude: finalAltitude
    }, duration);
    
    // Clear flying state when animation completes
    flyingTimeoutRef.current = setTimeout(() => {
      setIsFlying(false);
      console.log(`🛬 Arrived at ${station.name}`);
    }, duration + 200);
  }, []);

  // Handle station click
  const handleStationClick = useCallback((point: any) => {
    const station = point as StationMarker;
    
    // Don't stop auto-rotation for station clicks - only for manual dragging/rotating
    // The globe should keep spinning slowly in the background even when stations are selected
    
    if (onStationSelect) {
      onStationSelect(station);
    }
    
    // Smooth cinematic flight to station
    flyToStation(station);
  }, [onStationSelect, flyToStation]);

  // Auto-rotate the globe (only when user hasn't interacted)
  useEffect(() => {
    if (!globeEl.current || !globeReady) {
      return;
    }

    const globe = globeEl.current;
    const controls = globe.controls();
    
    // Configure controls
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.autoRotateSpeed = -0.2; // Slower, more gentle rotation in opposite direction
    
    // Only auto-rotate if user hasn't interacted yet
    controls.autoRotate = autoRotate && !userHasInteracted;
    
    console.log(`🌍 Auto-rotation ${controls.autoRotate ? 'ENABLED' : 'DISABLED'} (user interacted: ${userHasInteracted})`);
    
    // Set initial view once when globe is ready
    if (autoRotate && !userHasInteracted && !globe.pointOfView().lat) {
      console.log('🎯 Setting initial globe view');
      globe.pointOfView({ lat: 20, lng: 0, altitude: 2.5 });
    }
  }, [globeReady, autoRotate, userHasInteracted]);

  // Add interaction event listeners to stop auto-rotation and track inactivity
  useEffect(() => {
    if (!globeEl.current || !globeReady) return;

    const globe = globeEl.current;
    const controls = globe.controls();

    // Listen for actual user-initiated interactions
    controls.addEventListener('start', handleUserInteraction); // Mouse/touch down to start dragging

    // If user has already interacted, also listen for ongoing interactions to reset timeout
    if (userHasInteracted) {
      controls.addEventListener('change', resetInactivityTimeout); // Any camera movement resets timeout
    }

    return () => {
      controls.removeEventListener('start', handleUserInteraction);
      if (userHasInteracted) {
        controls.removeEventListener('change', resetInactivityTimeout);
      }
    };
  }, [globeReady, userHasInteracted, handleUserInteraction, resetInactivityTimeout]);

  // Blinking effect for current station
  useEffect(() => {
    if (currentStation && globeReady) {
      // Start blinking animation
      const startBlinking = () => {
        blinkTimeoutRef.current = setTimeout(() => {
          setIsCurrentStationBright(prev => !prev);
          startBlinking(); // Continue the cycle
        }, 800); // Blink every 800ms
      };
      
      startBlinking();
      console.log(`✨ Started cyan blinking animation for ${currentStation.name}`);
    } else {
      // Stop blinking when no station is playing
      if (blinkTimeoutRef.current) {
        clearTimeout(blinkTimeoutRef.current);
        blinkTimeoutRef.current = null;
      }
      setIsCurrentStationBright(true); // Reset to bright
    }

    return () => {
      if (blinkTimeoutRef.current) {
        clearTimeout(blinkTimeoutRef.current);
      }
    };
  }, [currentStation, globeReady]);

  // Handle external flight triggers (e.g., from pomodoro random station selection)
  useEffect(() => {
    if (flyToStationTrigger && stations.length > 0 && globeReady) {
      
      const stationMarker = stations.find(s => s.stationuuid === flyToStationTrigger.stationuuid);
      if (stationMarker) {
        flyToStation(stationMarker);
      }
    }
  }, [flyToStationTrigger, stations, globeReady, flyToStation]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (flyingTimeoutRef.current) {
        clearTimeout(flyingTimeoutRef.current);
      }
      if (blinkTimeoutRef.current) {
        clearTimeout(blinkTimeoutRef.current);
      }
      if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current);
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-16 h-16 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
          <div className="text-white text-2xl mb-3">Loading Global Radio Stations</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative bg-gray-900">
      <div className="absolute inset-0 flex items-center justify-center">
        <Globe
          ref={globeEl}
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
          backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
        
        // Points data (radio stations) - filtered by zoom level
        pointsData={visibleStations}
        pointLat="lat"
        pointLng="lng"
        pointColor={(d: any) => {
          // Make current station blink cyan when playing
          if (currentStation && d.stationuuid === currentStation.stationuuid) {
            return isCurrentStationBright ? '#00ffff' : '#008888'; // Bright cyan <-> dimmed cyan
          }
          return d.color; // Default color based on quality
        }}
        pointAltitude={() => {
          // All heights reduced to 1/4 of original values
          let heightScale;
          if (currentAltitude > 3) {
            // Very far out - good height (1/4 of 0.012)
            heightScale = 0.003;
          } else if (currentAltitude > 2) {
            // Far - getting taller (1/4 of 0.012 to 0.015)
            heightScale = 0.003 + (3 - currentAltitude) * 0.00075; // 0.003 to 0.00375
          } else if (currentAltitude > 1) {
            // Medium distance - CLIMAX (1/4 of 0.015 to 0.017)
            heightScale = 0.00375 + (2 - currentAltitude) * 0.0005; // 0.00375 to 0.00425
          } else if (currentAltitude > 0.6) {
            // Getting close - still reasonable height (1/4 of 0.010 to 0.015)
            heightScale = 0.0025 + (currentAltitude - 0.6) * 0.003125; // 0.0025 to 0.00375
          } else if (currentAltitude > 0.5) {
            // Close - start getting flatter (1/4 of 0.002 to 0.01)
            heightScale = 0.0005 + (currentAltitude - 0.5) * 0.004; // 0.0005 to 0.0025
          } else {
            // VERY close - ALMOST NO HEIGHT (1/4 of 0.0001 to 0.002)
            heightScale = 0.000025 + currentAltitude * 0.00095; // 0.000025 to 0.0005
          }
          
          return heightScale;
        }}
        pointRadius={(d: any) => {
          // Keep good size longer, only shrink when very close
          let scaleFactor;
          if (currentAltitude > 3) {
            // Very far out - good visibility
            scaleFactor = 0.9;
          } else if (currentAltitude > 2) {
            // Far - getting bigger
            scaleFactor = 0.9 + (3 - currentAltitude) * 0.3; // 0.9 to 1.2
          } else if (currentAltitude > 1) {
            // Medium distance - CLIMAX (biggest points)
            scaleFactor = 1.2 + (2 - currentAltitude) * 0.3; // 1.2 to 1.5
          } else if (currentAltitude > 0.4) {
            // Still good size - maintain larger size longer
            scaleFactor = 1.0 + (currentAltitude - 0.4) * 0.83; // 1.0 to 1.5
          } else if (currentAltitude > 0.2) {
            // Start shrinking - but not too aggressively
            scaleFactor = 0.4 + (currentAltitude - 0.2) * 3.0; // 0.4 to 1.0
          } else {
            // VERY close - tiny dots only here
            scaleFactor = 0.01 + currentAltitude * 1.95; // 0.01 to 0.4
          }
          
          // Original base radius for good visibility
          const baseRadius = currentStation && d.stationuuid === currentStation.stationuuid 
            ? 0.22  // Slightly larger for currently playing station
            : 0.18; // Same size for all other stations
          
          // Apply scale factor
          const finalRadius = baseRadius * scaleFactor;
          
          // Debug logging for first few points
          if (Math.random() < 0.001) {
            console.log(`Point radius: ${finalRadius.toFixed(3)}, altitude: ${currentAltitude.toFixed(2)}, scaleFactor: ${scaleFactor.toFixed(2)}`);
          }
          
          return finalRadius;
        }}
        pointResolution={8}
        
        // Point materials for better visibility
        pointsMaterial={() => {
          try {
            const THREE = (window as any).THREE;
            if (!THREE) {
              console.warn('THREE.js not available, using default material');
              return undefined;
            }
            const material = new THREE.MeshLambertMaterial();
            material.transparent = false;
            material.opacity = 1.0;
            return material;
          } catch (error) {
            console.warn('Error creating point material:', error);
            return undefined;
          }
        }}
        
        // Interactivity
        onPointClick={handleStationClick}
        onPointHover={(point: any) => {
          // Change cursor on hover
          document.body.style.cursor = point ? 'pointer' : 'auto';
        }}
        pointLabel={(d: any) => `
          <div style="background: rgba(0,0,0,0.85); padding: 10px; border-radius: 6px; color: white; max-width: 220px; font-family: system-ui, sans-serif; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
            <div style="font-weight: bold; margin-bottom: 6px; font-size: 14px;">${d.name}</div>
            <div style="font-size: 11px; color: #ccc; line-height: 1.4;">
              📍 ${d.country}<br/>
              🎵 ${d.codec} • ${d.bitrate}kbps<br/>
              👍 ${d.votes.toLocaleString()} votes
            </div>
          </div>
        `}
        
        // Animation
        animateIn={true}
        waitForGlobeReady={true}
        onGlobeReady={() => {
          console.log(`🌍 Globe ready! Loaded ${stations.length} stations total`);
          setGlobeReady(true);
          
          // Give globe a moment to fully initialize, then start auto-rotation
          setTimeout(() => {
            console.log('🌍 Starting initial auto-rotation...');
            setAutoRotate(true);
          }, 500);
        }}
        
        // Controls
        enablePointerInteraction={true}
        
        // Lighting for better point visibility
        showGlobe={true}
        showAtmosphere={true}
        atmosphereColor="#4fc3f7"
        atmosphereAltitude={0.15}
        />
      </div>
      

      {/* Now playing indicator */}
      {currentStation && !isFlying && (
        <div 
          className="absolute top-4 left-4 bg-black/70 text-white px-3 py-2 rounded-lg backdrop-blur-sm text-xs flex items-center gap-2 cursor-pointer hover:bg-black/85 transition-colors"
          onClick={() => {
            const currentMarker = stations.find(s => s.stationuuid === currentStation.stationuuid);
            if (currentMarker) {
              console.log(`🎯 Flying to currently playing station: ${currentStation.name}`);
              flyToStation(currentMarker);
            }
          }}
          title="Click to fly to this station"
        >
          <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
          Streaming: {currentStation.name}
        </div>
      )}

      {/* Flying indicator */}
      {isFlying && (
        <div className="absolute top-4 left-4 bg-black/70 text-white px-3 py-2 rounded-lg backdrop-blur-sm text-xs flex items-center gap-2">
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
          Flying to station...
        </div>
      )}
    </div>
  );
}
