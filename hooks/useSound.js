import { useCallback, useEffect, useRef, useState } from 'react';

const tonePlans = {
  click: [{ frequency: 520, duration: 0.1, type: 'square', volume: 0.45 }],
  correct: [
    { frequency: 660, duration: 0.18, type: 'triangle', volume: 0.5 },
    { frequency: 880, duration: 0.22, type: 'triangle', volume: 0.45, delay: 0.16 },
  ],
  wrong: [
    { frequency: 320, duration: 0.26, type: 'sawtooth', volume: 0.45 },
    { frequency: 220, duration: 0.32, type: 'square', volume: 0.35, delay: 0.08 },
  ],
};

const STORAGE_KEY = 'ai-quiz-sound-enabled';

const readStoredPreference = () => {
  if (typeof window === 'undefined') return null;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === null) return null;
  return stored === 'true';
};

export default function useSound(initialEnabled = true) {
  const [soundEnabled, setSoundEnabled] = useState(initialEnabled);
  const soundEnabledRef = useRef(soundEnabled);
  const audioContextRef = useRef(null);
  const masterGainRef = useRef(null);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, String(soundEnabled));
    }
  }, [soundEnabled]);

  useEffect(() => {
    const stored = readStoredPreference();
    if (stored !== null && stored !== soundEnabledRef.current) {
      soundEnabledRef.current = stored;
      setSoundEnabled(stored);
    }
  }, []);

  const ensureAudioContext = useCallback(() => {
    if (typeof window === 'undefined') return null;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!audioContextRef.current) {
      const context = new AudioContextClass();
      const masterGain = context.createGain();
      masterGain.gain.value = soundEnabledRef.current ? 0.3 : 0;
      masterGain.connect(context.destination);
      audioContextRef.current = context;
      masterGainRef.current = masterGain;
    }

    return audioContextRef.current;
  }, []);

  const playSound = useCallback(
    type => {
      if (!soundEnabledRef.current) return;

      const context = ensureAudioContext();
      const masterGain = masterGainRef.current;
      if (!context || !masterGain) return;

      if (context.state === 'suspended') {
        context.resume().catch(() => {});
      }

      const now = context.currentTime;
      const plan = tonePlans[type] ?? [];

      plan.forEach(({ frequency, duration, type: wave = 'sine', delay = 0, volume = 0.5 }) => {
        const oscillator = context.createOscillator();
        const envelope = context.createGain();

        oscillator.type = wave;
        oscillator.frequency.setValueAtTime(frequency, now + delay);

        envelope.gain.setValueAtTime(0.0001, now + delay);
        envelope.gain.linearRampToValueAtTime(volume, now + delay + 0.015);
        envelope.gain.exponentialRampToValueAtTime(0.0001, now + delay + duration);

        oscillator.connect(envelope);
        envelope.connect(masterGain);

        oscillator.start(now + delay);
        oscillator.stop(now + delay + duration + 0.05);
      });
    },
    [ensureAudioContext],
  );

  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => {
      const next = !prev;
      soundEnabledRef.current = next;
      const context = ensureAudioContext();

      if (masterGainRef.current && context) {
        const targetValue = next ? 0.3 : 0;
        masterGainRef.current.gain.setTargetAtTime(targetValue, context.currentTime, 0.02);
        if (next && context.state === 'suspended') {
          context.resume().catch(() => {});
        }
      }

      if (next) {
        setTimeout(() => playSound('click'), 0);
      }

      return next;
    });
  }, [ensureAudioContext, playSound]);

  return { ensureAudioContext, playSound, soundEnabled, toggleSound };
}
