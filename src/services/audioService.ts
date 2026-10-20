/**
 * Audio Synthesis Service for FocusHUD
 * Uses Web Audio API to synthesize low-latency procedural sound effects
 * without requiring external sound asset files.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;

  if (!audioCtx || audioCtx.state === "closed") {
    try {
      audioCtx = new AudioCtx();
    } catch {
      return null;
    }
  }

  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }

  return audioCtx;
}

export function playTone(
  frequency: number,
  type: OscillatorType = "sine",
  durationMs: number = 150,
  volume: number = 0.15
): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);

    const now = ctx.currentTime;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + durationMs / 1000);
  } catch {
    // Graceful fallback for uninitialized audio devices
  }
}

/**
 * Cyberpunk HUD interaction beep
 */
export function playButtonBeep(volume: number = 0.08): void {
  playTone(880, "sine", 80, volume);
}

/**
 * Subtle Pomodoro clock tick
 */
export function playTimerTick(volume: number = 0.03): void {
  playTone(440, "triangle", 40, volume);
}

/**
 * Multi-harmonic session completion chime
 */
export function playSessionCompleteSound(volume: number = 0.2): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const pitches = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
  pitches.forEach((freq, idx) => {
    setTimeout(() => {
      playTone(freq, "sine", 350, volume);
    }, idx * 120);
  });
}
