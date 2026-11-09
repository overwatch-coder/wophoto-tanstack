let audioContext: AudioContext | null = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  if (audioContext) return audioContext;

  const AudioContextConstructor = window.AudioContext
    ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) return null;

  try {
    audioContext = new AudioContextConstructor();
    return audioContext;
  } catch {
    return null;
  }
}

/** Call from a trusted user gesture so browser autoplay rules allow future alerts. */
export async function prepareNotificationAudio() {
  const context = getAudioContext();
  if (!context) return false;

  try {
    if (context.state !== "running") await context.resume();
    return context.state === "running";
  } catch {
    return false;
  }
}

export async function playNotificationChime() {
  const context = getAudioContext();
  if (!context) return;

  try {
    if (context.state !== "running") await context.resume();
    if (context.state !== "running") return;

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(740, context.currentTime);
    oscillator.frequency.setValueAtTime(988, context.currentTime + 0.08);
    gain.gain.setValueAtTime(0.07, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.24);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.24);
  } catch {
    // Audio is optional and may be blocked by the browser.
  }
}
