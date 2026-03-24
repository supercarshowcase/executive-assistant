'use client';

import { useVoiceInput } from '@/lib/hooks';
import { Mic, MicOff } from 'lucide-react';

interface VoiceInputProps {
  onTranscript?: (text: string) => void;
  placeholder?: string;
  className?: string;
}

export function VoiceInput({
  onTranscript,
  placeholder = 'Tap to speak...',
  className = '',
}: VoiceInputProps) {
  const { isListening, transcript, start, stop, reset } = useVoiceInput();

  const toggleListening = () => {
    if (isListening) {
      stop();
      if (transcript && onTranscript) {
        onTranscript(transcript);
      }
    } else {
      reset();
      start();
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        onClick={toggleListening}
        className={`p-2.5 rounded-full transition-all duration-200 ${
          isListening
            ? 'bg-red-500 text-white animate-pulse'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
        aria-label={isListening ? 'Stop listening' : 'Start listening'}
      >
        {isListening ? (
          <MicOff className="w-5 h-5" />
        ) : (
          <Mic className="w-5 h-5" />
        )}
      </button>
      {transcript && (
        <span className="text-sm text-gray-600 flex-1 truncate">
          {transcript}
        </span>
      )}
      {!transcript && !isListening && (
        <span className="text-sm text-gray-400">{placeholder}</span>
      )}
    </div>
  );
}
