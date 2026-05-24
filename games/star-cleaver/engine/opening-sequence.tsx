'use client';

import { useEffect, useState } from 'react';
import { OPENING_NARRATIVE } from './narrative';

interface OpeningSequenceProps {
  onComplete: () => void;
}

export function OpeningSequence({ onComplete }: OpeningSequenceProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  // Typewriter effect for narrative
  useEffect(() => {
    if (displayedText.length < OPENING_NARRATIVE.length) {
      const timer = setTimeout(() => {
        setDisplayedText(OPENING_NARRATIVE.slice(0, displayedText.length + 1));
      }, 20); // Speed of text reveal
      return () => clearTimeout(timer);
    } else {
      setIsComplete(true);
    }
  }, [displayedText]);

  const handleSkip = () => {
    setDisplayedText(OPENING_NARRATIVE);
    setIsComplete(true);
  };

  const handleContinue = () => {
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center pointer-events-auto overflow-hidden">
      {/* Starfield background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,182,242,0.05)_0%,transparent_70%)] pointer-events-none" />

      {/* Narrative text container */}
      <div className="relative z-10 max-w-3xl px-8 md:px-12 h-full flex flex-col items-center justify-center">
        <div className="space-y-6">
          {/* Main narrative - typewriter effect */}
          <div className="font-mono text-sm md:text-base leading-relaxed text-foreground/90 whitespace-pre-wrap min-h-[400px]">
            {displayedText}
            {!isComplete && <span className="animate-pulse">█</span>}
          </div>

          {/* Controls */}
          <div className="flex flex-col gap-3 items-center pt-8">
            {!isComplete && (
              <button
                onClick={handleSkip}
                className="px-4 py-2 text-xs font-mono tracking-widest uppercase text-foreground/50 hover:text-foreground/75 transition-colors"
              >
                Press SPACE to skip
              </button>
            )}

            {isComplete && (
              <button
                onClick={handleContinue}
                className="px-6 py-2 border border-cyan-400/50 bg-cyan-400/10 text-cyan-400 font-mono text-xs tracking-widest uppercase hover:bg-cyan-400/20 transition-colors animate-pulse"
              >
                Press SPACE to continue
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bottom status line */}
      <div className="fixed bottom-6 left-6 text-foreground/40 font-mono text-[9px] tracking-widest">
        STAR CLEAVER · INITIALIZATION
      </div>

      {/* Skip on spacebar */}
      {typeof window !== 'undefined' && (
        <div
          onKeyDown={(e) => {
            if (e.code === 'Space') {
              e.preventDefault();
              if (isComplete) handleContinue();
              else handleSkip();
            }
          }}
          tabIndex={0}
          className="sr-only"
        />
      )}
    </div>
  );
}
