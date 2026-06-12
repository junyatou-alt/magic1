// Time Utilities for Royal Magic Calendar (06:00 to 22:00)

export const START_HOUR = 6;
export const END_HOUR = 22;
export const TOTAL_HOURS = END_HOUR - START_HOUR; // 16
export const SLOTS_PER_HOUR = 12; // 5 mins blocks
export const TOTAL_SLOTS = TOTAL_HOURS * SLOTS_PER_HOUR; // 192

/**
 * Converts a time string "HH:MM" (e.g. "14:30") to zero-indexed slot index (with 06:00 being 0)
 */
export function timeToSlot(timeStr: string | null): number {
  if (!timeStr) return 0;
  const [hrsStr, minsStr] = timeStr.split(':');
  const hrs = parseInt(hrsStr, 10);
  const mins = parseInt(minsStr, 10);

  const totalMinsFromSixOffset = (hrs - START_HOUR) * 60 + mins;
  const slot = Math.floor(totalMinsFromSixOffset / 5);
  return Math.max(0, Math.min(TOTAL_SLOTS, slot));
}

/**
 * Converts a zero-indexed slot index (with 06:00 being 0) to "HH:MM" string format
 */
export function slotToTime(slot: number): string {
  const boundedSlot = Math.max(0, Math.min(TOTAL_SLOTS, slot));
  const totalMins = boundedSlot * 5;
  const offsetHrs = Math.floor(totalMins / 60);
  const remMins = totalMins % 60;

  const actualHrs = START_HOUR + offsetHrs;
  const hrsStr = actualHrs.toString().padStart(2, '0');
  const minsStr = remMins.toString().padStart(2, '0');

  return `${hrsStr}:${minsStr}`;
}

/**
 * Play a high-pitched magic sparkle arpeggio using purely offline Web Audio API synthesis
 */
export function playMagicSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const playNote = (freq: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.12, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = ctx.currentTime;
    // Fast high sparkling chime sequence
    playNote(523.25, now, 0.2);       // C5
    playNote(659.25, now + 0.08, 0.2);  // E5
    playNote(783.99, now + 0.16, 0.2);  // G5
    playNote(1046.50, now + 0.24, 0.4); // C6
    playNote(1318.51, now + 0.32, 0.5); // E6
  } catch (err) {
    console.warn('Web Audio Playback failed:', err);
  }
}

/**
 * Play a majestic royal trumpet fan-fare sound using purely offline Web Audio API synthesis
 */
export function playWishSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const playNote = (freq: number, startTime: number, duration: number, type: 'triangle' | 'sine' = 'triangle') => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.08, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = ctx.currentTime;
    // Harmonic beautiful fanfare chords
    playNote(392.00, now, 0.15); // G4
    playNote(523.25, now + 0.15, 0.15); // C5
    playNote(659.25, now + 0.3, 0.15); // E5
    playNote(783.99, now + 0.45, 0.3); // G5
    playNote(1046.50, now + 0.45, 0.4, 'sine'); // C6 chime overlays
  } catch (err) {
    console.warn('Web Audio Playback failed:', err);
  }
}

/**
 * Format slot count into hours & minutes for display (e.g. "6 slots" -> "30m", "12 slots" -> "1h")
 */
export function formatSlotsDuration(slots: number): string {
  const totalMins = slots * 5;
  if (totalMins < 60) {
    return `${totalMins}分钟`;
  }
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return mins > 0 ? `${hrs}小时${mins}分` : `${hrs}小时`;
}
