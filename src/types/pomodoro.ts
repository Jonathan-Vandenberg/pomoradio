export interface PomodoroSettings {
  workDuration: number; // in minutes
  shortBreakDuration: number; // in minutes
  longBreakDuration: number; // in minutes
  sessionsUntilLongBreak: number;
  fadeInDuration: number; // in seconds
  fadeOutDuration: number; // in seconds
}

export type PomodoroPhase = 'work' | 'shortBreak' | 'longBreak' | 'paused';

export interface PomodoroState {
  phase: PomodoroPhase;
  timeRemaining: number; // in seconds
  isRunning: boolean;
  completedSessions: number;
  currentCycle: number;
}
