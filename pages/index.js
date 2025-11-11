'use client';

import { useState } from 'react';
import ModeSelection from '../components/ModeSelection';
import PracticeMode from '../components/PracticeMode';
import TestMode from '../components/TestMode';
import DocumentMode from '../components/DocumentMode';
import useSound from '../hooks/useSound';

const difficultyOptions = [
  { value: 'easy', label: 'かんたん' },
  { value: 'normal', label: 'ふつう' },
  { value: 'hard', label: 'むずかしい' },
];

const difficultyLabels = {
  easy: 'かんたん',
  normal: 'ふつう',
  hard: 'むずかしい',
};

export default function Home() {
  const [mode, setMode] = useState(null);
  const { playSound, soundEnabled, toggleSound } = useSound(true);
  const surveyUrl = process.env.NEXT_PUBLIC_SURVEY_FORM_URL ?? '';

  if (!mode) {
    return (
      <ModeSelection
        onSelect={selectedMode => {
          playSound('click');
          setMode(selectedMode);
        }}
        soundEnabled={soundEnabled}
        toggleSound={toggleSound}
        surveyUrl={surveyUrl}
      />
    );
  }

  if (mode === 'practice') {
    return (
      <PracticeMode
        difficultyOptions={difficultyOptions}
        difficultyLabels={difficultyLabels}
        playSound={playSound}
        soundEnabled={soundEnabled}
        toggleSound={toggleSound}
        onBack={() => {
          playSound('click');
          setMode(null);
        }}
      />
    );
  }

  if (mode === 'document') {
    return (
      <DocumentMode
        difficultyOptions={difficultyOptions}
        difficultyLabels={difficultyLabels}
        playSound={playSound}
        soundEnabled={soundEnabled}
        toggleSound={toggleSound}
        onBack={() => {
          playSound('click');
          setMode(null);
        }}
      />
    );
  }

  return (
    <TestMode
      difficultyOptions={difficultyOptions}
      difficultyLabels={difficultyLabels}
      playSound={playSound}
      soundEnabled={soundEnabled}
      toggleSound={toggleSound}
      onBack={() => {
        playSound('click');
        setMode(null);
      }}
    />
  );
}
