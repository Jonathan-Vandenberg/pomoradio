'use client';

import { useState } from 'react';
import { usePomodoro } from '@/hooks/usePomodoro';
import { Play, Pause, RotateCcw, SkipForward, Volume2, Radio, Info, Square } from 'lucide-react';
import { getCountryFlag } from '@/utils/countryFlags';

interface NavbarProps {
  pomodoro: ReturnType<typeof usePomodoro>;
}

export function Navbar({ pomodoro }: NavbarProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const getPhaseDisplay = () => {
    switch (pomodoro.phase) {
      case 'work':
        return { title: 'Focus Time', color: 'bg-black/30', hoverColor: 'hover:bg-black/30' };
      case 'shortBreak':
        return { title: 'Short Break', color: 'bg-black/30', hoverColor: 'hover:bg-black/30' };
      case 'longBreak':
        return { title: 'Long Break', color: 'bg-black/30', hoverColor: 'hover:bg-black/30' };
      default:
        return { title: 'Paused', color: 'bg-black/30', hoverColor: 'hover:bg-black/50' };
    }
  };

  const phaseInfo = getPhaseDisplay();

  return (
    <nav className="relative z-50 bg-black/20 backdrop-blur-sm py-6 min-h-12 flex items-center px-4 sm:px-6 navbar">
        {/* Desktop Layout */}
        <div className="hidden lg:flex items-center justify-between gap-4 w-full">
          {/* Left Section: App Title & Phase */}
          <div className="flex items-center gap-4">
            <p className="text-lg font-bold text-white ">pomoradio</p>
            <div className={`px-3 py-1 rounded-full text-xs font-semibold text-white ${phaseInfo.color}`}>
              {phaseInfo.title}
            </div>
            <div className="text-xs text-gray-400">
              Session {pomodoro.currentCycle} • Completed: {pomodoro.completedSessions}
            </div>
          </div>

          {/* Center Section: Timer & Controls */}
          <div className="flex items-center gap-6">
            {/* Timer Display */}
            <div className="text-center">
              <div className="text-2xl font-mono font-bold text-white">
                {pomodoro.timeDisplay}
              </div>
            </div>
            
            {/* Timer Controls */}
            <div className="flex items-center gap-3 px-4 py-2">
              <button
                onClick={pomodoro.isRunning ? pomodoro.pause : pomodoro.start}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-white font-medium text-sm transition-colors ${phaseInfo.color} ${phaseInfo.hoverColor}`}
              >
                {pomodoro.isRunning ? <Pause size={16} /> : <Play size={16} />}
                {pomodoro.isRunning ? 'Pause' : 'Start'}
              </button>
              <button
                onClick={pomodoro.reset}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
              >
                <RotateCcw size={14} />
                Reset
              </button>
              <button
                onClick={pomodoro.skip}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
              >
                <SkipForward size={14} />
                Skip
              </button>
            </div>
          </div>

          {/* Right Section: Radio Status & Volume */}
          <div className="flex items-center gap-4">
            {/* Radio Status */}
            {pomodoro.audio.currentStation ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-4xl">
                    {getCountryFlag(pomodoro.audio.currentStation.countrycode)}
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-white">
                      {pomodoro.audio.currentStation.country}
                    </div>
                    <div className="text-xs text-gray-300 max-w-32">
                      {pomodoro.audio.currentStation.name}
                    </div>
                  </div>
                </div>
                
                
              </div>
            ) : (
              <div className="flex items-center gap-2 text-gray-400">
                <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
                  <Radio size={16} />
                </div>
                <span className="text-sm">No station</span>
              </div>
            )}
            
                {/* Audio Control */}
                {pomodoro.audio.currentStation && (
                  <button
                    onClick={() => pomodoro.audio.isPlaying ? pomodoro.audio.pause() : pomodoro.audio.resume()}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                    title={pomodoro.audio.isPlaying ? 'Pause radio' : 'Play radio'}
                  >
                    {pomodoro.audio.isPlaying ? <Square size={14} /> : <Play size={14} />}
                  </button>
                )}

                {/* Volume Control */}
                <div className="flex items-center gap-2">
                  <Volume2 size={16} className="text-gray-400" />
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={pomodoro.audio.volume}
                    onChange={(e) => pomodoro.audio.setVolume(parseFloat(e.target.value))}
                    className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                    style={{
                      background: `linear-gradient(to right, rgb(30 64 175) 0%, rgb(30 64 175) ${pomodoro.audio.volume * 100}%, rgb(15 23 42) ${pomodoro.audio.volume * 100}%, rgb(15 23 42) 100%)`
                    }}
                  />
                  <span className="text-xs text-gray-300 w-8 text-right">
                    {Math.round(pomodoro.audio.volume * 100)}%
                  </span>
                </div>

                {/* Info Icon with Tooltip */}
                <div className="relative">
                  <button
                    onMouseEnter={() => setShowTooltip(true)}
                    onMouseLeave={() => setShowTooltip(false)}
                    className="p-2 text-gray-300 hover:text-white transition-colors"
                  >
                    <Info size={16} />
                  </button>
                  {showTooltip && (
                    <div className="absolute top-full right-0 mt-2 bg-black/90 text-white p-3 rounded-lg backdrop-blur-sm shadow-lg z-50 w-56">
                      <div className="text-xs font-medium mb-2">Radio Station Quality</div>
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-400 rounded-full flex-shrink-0"></div>
                          <span>High Quality (256+ kbps)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-yellow-400 rounded-full flex-shrink-0"></div>
                          <span>Medium Quality (128+ kbps)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-orange-400 rounded-full flex-shrink-0"></div>
                          <span>Standard Quality (64+ kbps)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-red-400 rounded-full flex-shrink-0"></div>
                          <span>Basic Quality</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

        {/* Mobile & Tablet Layout */}
        <div className="lg:hidden space-y-3 w-full flex flex-col justify-center py-2 px-0">
          {/* Top Row: App Title, Phase, Timer */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-base sm:text-lg font-bold text-white">Pomoradio</h1>
              <div className={`px-2 py-1 rounded-full text-xs font-semibold text-white ${phaseInfo.color}`}>
                {phaseInfo.title}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xl sm:text-2xl font-mono font-bold text-white">
                {pomodoro.timeDisplay}
              </div>
            </div>
          </div>

          {/* Bottom Row: Controls, Radio Status, Volume */}
          <div className="flex items-center justify-between gap-2">
            {/* Controls */}
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={pomodoro.isRunning ? pomodoro.pause : pomodoro.start}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-white font-medium text-sm transition-colors ${phaseInfo.color} ${phaseInfo.hoverColor}`}
              >
                {pomodoro.isRunning ? <Pause size={14} /> : <Play size={14} />}
                <span className="hidden sm:inline">{pomodoro.isRunning ? 'Pause' : 'Start'}</span>
              </button>
              <button
                onClick={pomodoro.reset}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
              >
                <RotateCcw size={14} />
                <span className="hidden sm:inline">Reset</span>
              </button>
              <button
                onClick={pomodoro.skip}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
              >
                <SkipForward size={14} />
                <span className="hidden sm:inline">Skip</span>
              </button>
            </div>

            {/* Radio Status & Volume */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Radio Status */}
              {pomodoro.audio.currentStation ? (
                <div className="flex items-center gap-2">
                  <span className="text-2xl">
                    {getCountryFlag(pomodoro.audio.currentStation.countrycode)}
                  </span>
                  <div className="hidden sm:block">
                    <div className="text-xs font-semibold text-white">
                      {pomodoro.audio.currentStation.country}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-gray-400">
                  <Radio size={16} />
                </div>
              )}
              
              {/* Audio Control */}
              {pomodoro.audio.currentStation && (
                <button
                  onClick={() => pomodoro.audio.isPlaying ? pomodoro.audio.pause() : pomodoro.audio.resume()}
                  className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                  title={pomodoro.audio.isPlaying ? 'Pause radio' : 'Play radio'}
                >
                  {pomodoro.audio.isPlaying ? <Square size={14} /> : <Play size={14} />}
                </button>
              )}

              {/* Volume Control */}
              <div className="flex items-center gap-1">
                <Volume2 size={14} className="text-gray-400" />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={pomodoro.audio.volume}
                  onChange={(e) => pomodoro.audio.setVolume(parseFloat(e.target.value))}
                  className="w-16 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                    style={{
                      background: `linear-gradient(to right, rgb(30 64 175) 0%, rgb(30 64 175) ${pomodoro.audio.volume * 100}%, rgb(15 23 42) ${pomodoro.audio.volume * 100}%, rgb(15 23 42) 100%)`
                    }}
                />
                <span className="text-xs text-gray-300 w-6 text-right">
                  {Math.round(pomodoro.audio.volume * 100)}%
                </span>
              </div>

              {/* Info Icon with Tooltip for Mobile */}
              <div className="relative">
                <button
                  onTouchStart={() => setShowTooltip(true)}
                  onTouchEnd={() => setTimeout(() => setShowTooltip(false), 3000)}
                  onClick={() => setShowTooltip(!showTooltip)}
                  className="p-1.5 rounded-lg bg-gray-600 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
                >
                  <Info size={14} />
                </button>
                {showTooltip && (
                  <div className="absolute top-full right-0 mt-2 bg-black/90 text-white p-3 rounded-lg backdrop-blur-sm shadow-lg z-50 w-48">
                    <div className="text-xs font-medium mb-2">Station Quality</div>
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full flex-shrink-0"></div>
                        <span>High (256+ kbps)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-yellow-400 rounded-full flex-shrink-0"></div>
                        <span>Medium (128+ kbps)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-orange-400 rounded-full flex-shrink-0"></div>
                        <span>Standard (64+ kbps)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-red-400 rounded-full flex-shrink-0"></div>
                        <span>Basic Quality</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="w-1 h-full bg-black/40"></div>
          </div>
        </div>
    </nav>
  );
}
