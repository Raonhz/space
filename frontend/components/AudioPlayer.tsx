import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Music, SkipForward } from 'lucide-react';

interface AudioPlayerProps {
  autoPlayTrigger: boolean;
}

// 50곡 하드코딩된 폴백 리스트 (API 연결 지연 또는 실패 대비 100% 무중단 보장)
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

const AudioPlayer: React.FC<AudioPlayerProps> = ({ autoPlayTrigger }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [playlist, setPlaylist] = useState<string[]>(FALLBACK_PLAYLIST);
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [currentTrackName, setCurrentTrackName] = useState<string>('Initializing Lofi Feed...');
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // 셔플된 재생 순서 인덱스 대기열
  const [playQueue, setPlayQueue] = useState<number[]>([]);
  const [queueIndex, setQueueIndex] = useState<number>(0);

  // 배열을 셔플하는 헬퍼 함수 (피셔-예이츠 셔플)
  const shuffleArray = (array: number[]) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // 1. 컴포넌트 로드 시 백엔드로부터 최신 음악 파일 목록 fetch
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

  // 2. 플레이리스트 크기가 정해지면 초기 셔플 대기열 빌드
  useEffect(() => {
    if (playlist.length === 0) return;
    const indices = Array.from({ length: playlist.length }, (_, i) => i);
    const shuffled = shuffleArray(indices);
    setPlayQueue(shuffled);
    setQueueIndex(0);
    setCurrentIdx(shuffled[0]);
  }, [playlist]);

  // 3. 현재 재생 중인 트랙 변경 시 곡 타이틀 파싱 및 볼륨 설정
  useEffect(() => {
    if (playlist.length === 0 || playlist[currentIdx] === undefined) return;
    
    // 파일명을 보기 좋게 변환 (예: "2-am-debug-loop.mp3" -> "2 AM Debug Loop")
    const rawName = playlist[currentIdx].replace('.mp3', '');
    const cleanName = rawName
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
      
    setCurrentTrackName(cleanName);

    if (audioRef.current) {
      audioRef.current.volume = 0.5;
      audioRef.current.load(); // 소스 엘리먼트 변경 사항 로드
      
      if (isPlaying) {
        audioRef.current.play()
          .catch(e => console.error("Track transition play failed:", e));
      }
    }
  }, [currentIdx, playlist]);

  // 4. 최초 진입 시 자동재생 트리거 대응
  useEffect(() => {
    if (autoPlayTrigger && audioRef.current) {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(e => console.error("Auto-play failed:", e));
    }
  }, [autoPlayTrigger]);

  // 5. 다음 곡 재생 트리거 (셔플 루프 제어)
  const playNextTrack = () => {
    if (playQueue.length === 0) return;
    
    const nextQueueIdx = queueIndex + 1;
    if (nextQueueIdx >= playQueue.length) {
      // 대기열을 다 비웠으면(완료), 새로 셔플하여 루프(loop) 이어나감
      console.log('[AudioPlayer] Playlist completed. Reshuffling for loop...');
      const indices = Array.from({ length: playlist.length }, (_, i) => i);
      const reshuffled = shuffleArray(indices);
      setPlayQueue(reshuffled);
      setQueueIndex(0);
      setCurrentIdx(reshuffled[0]);
    } else {
      // 대기열의 다음 곡으로 이동
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

  // 개발 환경(Vite 개발 서버 사용 시)에서는 백엔드로 직접 요청 (Vite 프록시 바이패스 - Range 헤더 깨짐 방지)
  // 프로덕션 환경에서는 Nginx가 리버스 프록시(80/443)로 제공하므로 상대경로 /music/ 사용
  const isDev = import.meta.env.DEV;
  const audioSrc = playlist.length > 0 && playlist[currentIdx]
    ? (isDev 
        ? `${window.location.protocol}//${window.location.hostname}:5001/music/${playlist[currentIdx]}`
        : `/music/${playlist[currentIdx]}`)
    : '';

  return (
    <div className="flex items-center gap-2 sm:gap-4 bg-black/40 backdrop-blur-md border border-white/10 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 max-w-full">
      {/* HTML5 Audio 태그, 루프 속성을 끄고 onEnded에 다음 곡 스크립트 바인딩 */}
      {audioSrc && (
        <audio 
          ref={audioRef} 
          src={audioSrc}
          crossOrigin="anonymous" 
          preload="auto"
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
        title={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? <Pause size={16} /> : <Play size={16} />}
      </button>
 
      {/* 다음 곡 스킵 버튼 추가 */}
      <button 
        onClick={playNextTrack}
        className="text-white/70 hover:text-white transition-colors focus:outline-none cursor-pointer shrink-0"
        title="Next Track"
      >
        <SkipForward size={14} />
      </button>
 
      <button 
        onClick={toggleMute}
        className="text-white/70 hover:text-white transition-colors focus:outline-none cursor-pointer shrink-0"
        title={isMuted ? "Unmute" : "Mute"}
      >
        {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
      </button>
    </div>
  );
};

export default AudioPlayer;
