import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, Plus, Minus, Volume2 } from 'lucide-react';
import { audioEngine } from '../audio/AudioEngine';

interface MetronomeProps {
  onClose: () => void;
}

export const Metronome: React.FC<MetronomeProps> = ({ onClose }) => {
  const [bpm, setBpm] = useState(100);
  const [isPlaying, setIsPlaying] = useState(false);
  const [beat, setBeat] = useState(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (isPlaying) {
      const intervalMs = (60 / bpm) * 1000;
      timerRef.current = window.setInterval(() => {
        setBeat((prev) => {
          const next = (prev + 1) % 4;
          // Play metronome click on beat 0 with accented hi-hat
          if (next === 0) {
            audioEngine.trigger('hihat_closed', 0.95);
          } else {
            audioEngine.trigger('hihat_closed', 0.5);
          }
          return next;
        });
      }, intervalMs);
    } else {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setBeat(0);
    }

    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
      }
    };
  }, [isPlaying, bpm]);

  return (
    <div className="metronome-card">
      <div className="metronome-header">
        <div className="metronome-title">
          <Volume2 size={16} className="text-vermilion" />
          <span>Metronome</span>
        </div>
        <button onClick={onClose} className="close-btn">
          &times;
        </button>
      </div>

      <div className="metronome-content">
        <div className="bpm-display">
          <span className="bpm-number">{bpm}</span>
          <span className="bpm-unit">BPM</span>
        </div>

        {/* Beat indicators */}
        <div className="beat-dots">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`beat-dot ${beat === i && isPlaying ? (i === 0 ? 'dot-accent' : 'dot-active') : ''}`}
            />
          ))}
        </div>

        {/* Controls */}
        <div className="metronome-controls">
          <button
            onClick={() => setBpm((b) => Math.max(40, b - 5))}
            className="tempo-btn"
            title="Decrease 5 BPM"
          >
            <Minus size={14} />
          </button>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`play-btn ${isPlaying ? 'playing' : ''}`}
          >
            {isPlaying ? <Square size={16} /> : <Play size={16} />}
            <span>{isPlaying ? 'Stop' : 'Start'}</span>
          </button>

          <button
            onClick={() => setBpm((b) => Math.min(240, b + 5))}
            className="tempo-btn"
            title="Increase 5 BPM"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
