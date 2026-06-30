import React, { useState, useEffect, useRef } from 'react';
import Hls from 'hls.js';

interface VideoBackgroundProps {
  isEclipsed: boolean;
  isConsoleActivated?: boolean;
  videoId?: string | null;  // 백엔드가 동적 파싱해 준 YouTube Video ID
  onVideoStatusChange?: (status: { isLoaded: boolean; isTimeout: boolean }) => void;
}

// --- 100% 무중단 렌더링을 보장하는 우주 테마 SVG 벡터 컴포넌트 3종 정의 ---

// 1. 푸른 지구와 대기 글로우 (Earth in Orbit)
const SVGEarth: React.FC = () => (
  <svg className="w-full h-full bg-[#020617]" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="space-bg" cx="50%" cy="50%" r="75%">
        <stop offset="0%" stopColor="#0b1329" />
        <stop offset="100%" stopColor="#020617" />
      </radialGradient>
      <radialGradient id="earth-glow" cx="40%" cy="40%" r="60%">
        <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
        <stop offset="70%" stopColor="#0ea5e9" stopOpacity="0.08" />
        <stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="earth-body" cx="30%" cy="30%" r="70%">
        <stop offset="0%" stopColor="#0d9488" />
        <stop offset="40%" stopColor="#0284c7" />
        <stop offset="80%" stopColor="#0f172a" />
        <stop offset="100%" stopColor="#020617" />
      </radialGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#space-bg)" />

    {/* 반짝이는 별무리 */}
    <g fill="#ffffff" opacity="0.3">
      <circle cx="100" cy="150" r="1" className="animate-pulse" />
      <circle cx="250" cy="80" r="1.5" className="animate-pulse" />
      <circle cx="450" cy="220" r="0.8" />
      <circle cx="650" cy="120" r="1.2" className="animate-pulse" />
      <circle cx="700" cy="300" r="1" />
      <circle cx="200" cy="400" r="1.5" className="animate-pulse" />
      <circle cx="350" cy="500" r="0.7" />
      <circle cx="600" cy="450" r="1.2" className="animate-pulse" />
    </g>

    {/* 지구 대기 아우라 */}
    <circle cx="400" cy="300" r="220" fill="url(#earth-glow)" />
    {/* 지구 몸체 */}
    <circle cx="400" cy="300" r="200" fill="url(#earth-body)" />
    {/* 아시아/유럽 대륙 추상 기하 패스 */}
    <path d="M 330 220 Q 360 190 390 220 T 430 260 T 400 310 T 320 320 Z" fill="#047857" opacity="0.25" filter="blur(4px)" />
    <path d="M 450 230 Q 490 210 510 250 T 480 330 T 410 360 Z" fill="#065f46" opacity="0.2" filter="blur(6px)" />
  </svg>
);

// 2. 몽환적인 우주 성운 (Deep Space Nebula)
const SVGNebula: React.FC = () => (
  <svg className="w-full h-full bg-[#03000a]" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="nebula-grad-1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.25" />
        <stop offset="50%" stopColor="#4f46e5" stopOpacity="0.08" />
        <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
      </linearGradient>
      <radialGradient id="nebula-glow" cx="60%" cy="40%" r="70%">
        <stop offset="0%" stopColor="#db2777" stopOpacity="0.2" />
        <stop offset="60%" stopColor="#4f46e5" stopOpacity="0.05" />
        <stop offset="100%" stopColor="#03000a" stopOpacity="0" />
      </radialGradient>
    </defs>
    <rect width="100%" height="100%" fill="#03000a" />

    {/* 성운 영역 별자리 연결선 */}
    <path d="M 150 150 L 220 200 L 300 180 M 300 180 L 320 120" stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" fill="none" />
    <path d="M 550 400 L 590 450 L 680 430 L 660 350" stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" fill="none" />

    <g fill="#ffffff" opacity="0.5">
      <circle cx="150" cy="150" r="1.5" />
      <circle cx="220" cy="200" r="1.5" className="animate-pulse" />
      <circle cx="300" cy="180" r="2" />
      <circle cx="320" cy="120" r="1" />
      <circle cx="550" cy="400" r="1.5" className="animate-pulse" />
      <circle cx="590" cy="450" r="2.2" />
      <circle cx="680" cy="430" r="1.5" />
      <circle cx="660" cy="350" r="1" />
    </g>

    {/* 거대한 우주 성운 광원 */}
    <ellipse cx="320" cy="270" rx="380" ry="220" fill="url(#nebula-grad-1)" filter="blur(45px)" />
    <circle cx="490" cy="310" r="260" fill="url(#nebula-glow)" filter="blur(55px)" />
  </svg>
);

// 3. 은하 띠와 밤하늘 성단 (Galactic Horizon)
const SVGGalaxy: React.FC = () => (
  <svg className="w-full h-full bg-[#020208]" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="core-glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.75" />
        <stop offset="25%" stopColor="#fef08a" stopOpacity="0.3" />
        <stop offset="65%" stopColor="#ec4899" stopOpacity="0.08" />
        <stop offset="100%" stopColor="#020208" stopOpacity="0" />
      </radialGradient>
    </defs>
    <rect width="100%" height="100%" fill="#020208" />

    {/* 은하수 띠 */}
    <ellipse cx="400" cy="300" rx="460" ry="110" fill="url(#core-glow)" transform="rotate(-12, 400, 300)" filter="blur(25px)" />

    {/* 은하 중심부 초미세 별무리 */}
    <g fill="#ffffff" opacity="0.4">
      <circle cx="380" cy="290" r="1" />
      <circle cx="420" cy="310" r="1.2" className="animate-pulse" />
      <circle cx="460" cy="280" r="0.8" />
      <circle cx="340" cy="320" r="1.5" />
      <circle cx="500" cy="260" r="0.7" />
      <circle cx="300" cy="340" r="1.2" className="animate-pulse" />
      <circle cx="280" cy="350" r="0.9" />
      <circle cx="520" cy="250" r="1.1" />
    </g>
  </svg>
);

const VideoBackground: React.FC<VideoBackgroundProps> = ({
  isEclipsed,
  isConsoleActivated = false,
  videoId = null,
  onVideoStatusChange
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isVideoTimeout, setIsVideoTimeout] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const playerRef = useRef<any>(null);

  // HLS 비디오 상태 관리
  const fallbackVideoRef = useRef<HTMLVideoElement>(null);
  const HLS_STREAM_URL = 'https://video.raondr.com/space/fallback.m3u8';

  // 라이브 비디오가 정상 송출 가능한 상태인지 판별 (로딩 완료, 에러 없음, 그리고 밤/우회 상태가 아님)
  const showLiveVideo = isVideoLoaded && !isVideoTimeout && !isEclipsed;

  // --- HLS 폴백 비디오 스트리밍 초기화 ---
  useEffect(() => {
    if (showLiveVideo) return; // 유튜브 라이브 모드일 땐 HLS 로드 안 함

    const video = fallbackVideoRef.current;
    if (!video) return;

    let hls: Hls | null = null;

    if (Hls.isSupported()) {
      hls = new Hls({
        autoStartLoad: true,
        capLevelToPlayerSize: true,
      });
      hls.loadSource(HLS_STREAM_URL);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(e => console.log('HLS Auto-play prevented', e));
      });

    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = HLS_STREAM_URL;
      video.addEventListener('loadedmetadata', () => {
        video.play().catch(e => console.log('Native HLS Auto-play prevented', e));
      });
    }

    return () => {
      if (hls) {
        hls.destroy();
      }
    };
  }, [showLiveVideo]);

  // 영상 로딩 실패(Timeout) 상태인 경우 45초 후에 자동으로 접속을 재시도
  useEffect(() => {
    if (!isVideoTimeout) return;

    console.log("Scheduling stream play retry in 45 seconds...");
    const retryTimer = setTimeout(() => {
      console.log("Attempting retry play on YouTube stream...");
      setIsVideoLoaded(false);
      setIsVideoTimeout(false);
      setRetryKey(prev => prev + 1);
    }, 45000);

    return () => clearTimeout(retryTimer);
  }, [isVideoTimeout]);

  // isEclipsed 상태가 true에서 false(낮 진입)로 바뀔 때 비디오 에러/인덱스 상태 완전 초기화하여 신규 접속 시도
  useEffect(() => {
    if (!isEclipsed) {
      setIsVideoLoaded(false);
      setIsVideoTimeout(false);
    }
  }, [isEclipsed]);

  // 유튜브 Iframe 플레이어 초기화 및 갱신
  useEffect(() => {
    if (isEclipsed || !videoId) {
      setIsVideoLoaded(false);
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          console.warn("Error destroying player:", e);
        }
        playerRef.current = null;
      }
      return;
    }

    console.log(`[VideoBackground] Initializing YouTube live stream play: ${videoId}`);

    if (playerRef.current) {
      try {
        playerRef.current.destroy();
      } catch (e) {
        // ignore
      }
      playerRef.current = null;
    }

    // YouTube Iframe API가 로드되지 않았다면 로드
    if (!(window as any).YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    let player: any;

    const initPlayer = () => {
      if (isEclipsed || !videoId) return;

      player = new (window as any).YT.Player('youtube-player', {
        height: '100%',
        width: '100%',
        videoId: videoId,
        playerVars: {
          autoplay: 1,
          mute: 1,
          controls: 0,
          rel: 0,
          showinfo: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          disablekb: 1,
          fs: 0,
          playsinline: 1,
          playlist: videoId,
          loop: 1
        },
        events: {
          onReady: (event: any) => {
            event.target.playVideo();
            event.target.mute();
          },
          onStateChange: (event: any) => {
            if (event.data === (window as any).YT.PlayerState.PLAYING) {
              setIsVideoLoaded(true);
              setIsVideoTimeout(false);
            }
          },
          onError: (event: any) => {
            console.error("[VideoBackground] YouTube Player error event:", event.data);
            handleVideoFail();
          }
        }
      });
      playerRef.current = player;
    };

    if ((window as any).YT && (window as any).YT.Player) {
      initPlayer();
    } else {
      const previousCallback = (window as any).onYouTubeIframeAPIReady;
      (window as any).onYouTubeIframeAPIReady = () => {
        if (previousCallback) {
          try { previousCallback(); } catch (e) { }
        }
        initPlayer();
      };
    }

    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          // ignore
        }
        playerRef.current = null;
      }
      setIsVideoLoaded(false);
    };
  }, [videoId, isEclipsed, retryKey]);

  // 비디오 재생 실패 처리
  const handleVideoFail = () => {
    console.warn("YouTube stream failed to play. Displaying fallback slideshow.");
    setIsVideoTimeout(true);
  };

  // 비디오 상태 변경 시 부모 컴포넌트에 알림
  useEffect(() => {
    if (onVideoStatusChange) {
      onVideoStatusChange({ isLoaded: isVideoLoaded, isTimeout: isVideoTimeout });
    }
  }, [isVideoLoaded, isVideoTimeout, onVideoStatusChange]);

  // 비디오 연결이 25초 이상 지연되면 대체 슬라이드쇼 전환
  useEffect(() => {
    if (!isConsoleActivated || !videoId) return;

    const timer = setTimeout(() => {
      if (!isVideoLoaded) {
        console.warn(`Timeout loading stream from YouTube URL`);
        handleVideoFail();
      }
    }, 25000);
    return () => clearTimeout(timer);
  }, [isVideoLoaded, videoId, isConsoleActivated]);

  return (
    <div className="absolute inset-0 w-full h-full z-0 pointer-events-none bg-black overflow-hidden">
      {/* 시네마틱 우주 항해 켄 번즈(Ken Burns) 애니메이션 효과 스타일 주입 */}
      <style>{`
        @keyframes cinematicSpaceTravel {
          0% {
            transform: scale(1.02) rotate(0deg) translate(0px, 0px);
          }
          100% {
            transform: scale(1.15) rotate(0.8deg) translate(-2%, -1%);
          }
        }
        .cinematic-space-active {
          animation: cinematicSpaceTravel 9000ms cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
        }
      `}</style>

      {/* ISS 라이브 비디오 피드 (실시간 HLS 재생이 가능하고 밤/우회 상태가 아닐 때 노출) */}
      <div
        className={`absolute inset-0 w-full h-full transition-opacity duration-[1500ms] ease-in-out overflow-hidden ${showLiveVideo ? 'z-10 opacity-100 visible' : 'z-0 opacity-0 invisible pointer-events-none'
          }`}
      >
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '100vw',
            height: '56.25vw', // 16:9 비율 유지
            minHeight: '100vh',
            minWidth: '177.77vh', // 16:9 비율 유지
          }}
          className="pointer-events-none"
        >
          <div
            id="youtube-player"
            className="w-full h-full object-cover pointer-events-none"
          />
        </div>
      </div>

      {/* 로컬 대체 영상: HLS 폴백 비디오 스트리밍 전용 화면 */}
      {!showLiveVideo && (
        <div className="absolute inset-0 w-full h-full z-10 overflow-hidden bg-black transition-opacity duration-1000">
          <video
            ref={fallbackVideoRef}
            className="w-full h-full object-cover opacity-100"
            autoPlay
            muted
            loop
            playsInline
          />
        </div>
      )}

      {/* 텍스트 가독성 확보용 부드러운 상하단 그라데이션 필터 */}
      <div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-b from-black/20 to-transparent z-20 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-black/20 via-black/40 to-transparent z-20 pointer-events-none"></div>
    </div>
  );
};

export default VideoBackground;
