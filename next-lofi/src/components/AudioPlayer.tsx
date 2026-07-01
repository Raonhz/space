'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Music, SkipForward } from 'lucide-react';
import { getDictionary } from '@/i18n/dictionaries';

interface AudioPlayerProps {
  autoPlayTrigger: boolean;
  lang?: string;
}

const FALLBACK_PLAYLIST = [
  "2-am-debug-loop.mp3", "3-am-echoes.mp3", "3am-sink-light.mp3", "a-taste-of-spring.mp3",
  "after-school-rain.mp3", "almost-floating.mp3", "amber-sidewalks.mp3", "amber-windowpane.mp3",
  "antenna-after-midnight.mp3", "ashes-in-the-coffee-cup.mp3", "aurora-on-mute.mp3",
  "autumn-on-the-window-glass.mp3", "bamboo-shadow-waltz.mp3", "barefoot-in-the-kitchen.mp3",
  "basement-groove-86.mp3", "bells-before-sunrise.mp3", "blinds-and-headlights.mp3",
  "block-party-slow-jam.mp3", "bloom-between-showers.mp3", "blossoms-on-the-pavement.mp3",
  "blue-below-the-surface.mp3", "breezy-afternoon-terrace.mp3", "brushstrokes-and-rain.mp3",
  "burnt-sunset-groove.mp3", "butter-and-windowlight.mp3", "cafe-da-tarde.mp3",
  "candle-wax-heart.mp3", "candlelit-at-70-bpm.mp3", "cassette-basement-bounce.mp3",
  "cassette-pastel-nights.mp3", "cathedral-hiss.mp3", "chapter-by-lamplight.mp3",
  "coffee-ring-notebook.mp3", "continue-screen-dreams.mp3", "cursor-after-midnight.mp3",
  "deep-space-loop.mp3", "dog-eared-pages.mp3", "drifting-through-fog.mp3",
  "dusk-between-stoops.mp3", "dusk-on-red-earth.mp3", "dust-and-hardcovers.mp3",
  "dust-in-the-curtains.mp3", "dust-on-the-morning-keys.mp3", "dust-on-the-needle.mp3",
  "dusty-jukebox-heart.mp3", "electric-puddles.mp3", "elevator-to-the-moon.mp3",
  "embers-after-midnight.mp3", "empty-street-static.mp3", "end-scene-glow.mp3"
];

const AudioPlayer: React.FC<AudioPlayerProps> = ({ autoPlayTrigger, lang }) => {
  const t = getDictionary(lang);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [playlist, setPlaylist] = useState<string[]>(FALLBACK_PLAYLIST);
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [currentTrackName, setCurrentTrackName] = useState<string>(t.INIT_LOFI);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const [playQueue, setPlayQueue] = useState<number[]>([]);
  const [queueIndex, setQueueIndex] = useState<number>(0);

  const shuffleArray = (array: number[]) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  useEffect(() => {
    fetch('/api/music-list')
      .then(res => {
        if (!res.ok) throw new Error('API Response Error');
        return res.json();
      })
      .then((data: string[]) => {
        if (data && data.length > 0) {
          console.log(`[AudioPlayer] Loaded ${data.length} tracks from backend.`);
          setPlaylist(data);
        }
      })
      .catch(err => {
        console.warn('[AudioPlayer] Failed to load list from API, using fallback playlist:', err.message);
      });
  }, []);

  useEffect(() => {
    if (playlist.length === 0) return;
    const indices = Array.from({ length: playlist.length }, (_, i) => i);
    const shuffled = shuffleArray(indices);
    setPlayQueue(shuffled);
    setQueueIndex(0);
    setCurrentIdx(shuffled[0]);
  }, [playlist]);

  useEffect(() => {
    if (playlist.length === 0 || playlist[currentIdx] === undefined) return;
    
    const rawName = playlist[currentIdx].replace('.mp3', '');
    const cleanName = rawName
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
      
    setCurrentTrackName(cleanName);

    if (audioRef.current) {
      audioRef.current.volume = 0.5;
      audioRef.current.load();
      
      if (isPlaying) {
        audioRef.current.play()
          .catch(e => console.error("Track transition play failed:", e));
      }
    }
  }, [currentIdx, playlist]);

  const isDev = process.env.NODE_ENV === 'development';
  // Next.js에서는 프록시나 직접 접근이 가능하도록 public 폴더를 사용
  const audioSrc = playlist.length > 0 && playlist[currentIdx]
    ? `/music/${playlist[currentIdx]}`
    : '';

  useEffect(() => {
    let mounted = true;
    const attemptPlay = () => {
      if (audioRef.current && audioSrc) {
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              if (mounted) setIsPlaying(true);
              window.removeEventListener('click', attemptPlay);
              window.removeEventListener('keydown', attemptPlay);
              window.removeEventListener('touchstart', attemptPlay);
            })
            .catch(e => {
              console.warn("Auto-play blocked by browser, waiting for interaction:", e);
              if (mounted) setIsPlaying(false);
            });
        }
      }
    };

    if (autoPlayTrigger) {
      attemptPlay();
      window.addEventListener('click', attemptPlay);
      window.addEventListener('keydown', attemptPlay);
      window.addEventListener('touchstart', attemptPlay);
    }
    
    return () => { 
      mounted = false; 
      window.removeEventListener('click', attemptPlay);
      window.removeEventListener('keydown', attemptPlay);
      window.removeEventListener('touchstart', attemptPlay);
    };
  }, [autoPlayTrigger, audioSrc]);

  const playNextTrack = () => {
    if (playQueue.length === 0) return;
    
    const nextQueueIdx = queueIndex + 1;
    if (nextQueueIdx >= playQueue.length) {
      console.log('[AudioPlayer] Playlist completed. Reshuffling for loop...');
      const indices = Array.from({ length: playlist.length }, (_, i) => i);
      const reshuffled = shuffleArray(indices);
      setPlayQueue(reshuffled);
      setQueueIndex(0);
      setCurrentIdx(reshuffled[0]);
    } else {
      setQueueIndex(nextQueueIdx);
      setCurrentIdx(playQueue[nextQueueIdx]);
    }
  };

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(e => console.error("Audio play failed:", e));
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  return (
    <div className="flex items-center gap-2 sm:gap-4 bg-black/40 backdrop-blur-md border border-white/10 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 max-w-full">
      {audioSrc && (
        <audio 
          ref={audioRef} 
          src={audioSrc}
          crossOrigin="anonymous" 
          preload="auto"
          autoPlay={autoPlayTrigger}
          onCanPlay={() => {
            if (autoPlayTrigger && audioRef.current) {
              audioRef.current.play().catch(() => {});
            }
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={playNextTrack}
        />
      )}
      
      <div className="flex items-center gap-1.5 sm:gap-2 text-white/80 max-w-[85px] xs:max-w-[125px] sm:max-w-[200px] shrink">
        <Music size={14} className={`shrink-0 ${isPlaying ? 'text-green-400 animate-pulse' : 'text-white/50'}`} />
        <span className="text-[9px] sm:text-[10px] font-mono uppercase tracking-wider truncate block" title={currentTrackName}>
          {currentTrackName}
        </span>
      </div>
 
      <div className="h-3 w-px bg-white/20 mx-0.5 sm:mx-1 shrink-0"></div>
 
      <button 
        onClick={togglePlay}
        className="text-white hover:text-green-400 transition-colors focus:outline-none cursor-pointer shrink-0"
        title={isPlaying ? t.PAUSE : t.PLAY}
      >
        {isPlaying ? <Pause size={16} /> : <Play size={16} />}
      </button>
 
      <button 
        onClick={playNextTrack}
        className="text-white/70 hover:text-white transition-colors focus:outline-none cursor-pointer shrink-0"
        title={t.NEXT_TRACK}
      >
        <SkipForward size={14} />
      </button>
 
      <button 
        onClick={toggleMute}
        className="text-white/70 hover:text-white transition-colors focus:outline-none cursor-pointer shrink-0"
        title={isMuted ? t.UNMUTE : t.MUTE}
      >
        {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
      </button>
    </div>
  );
};

export default AudioPlayer;
