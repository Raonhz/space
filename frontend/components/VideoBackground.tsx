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
  // 로컬 비디오 전용 상태 (유튜브 상태 관리 제거)
  const fallbackVideoRef = useRef<HTMLVideoElement>(null);
  const HLS_STREAM_URL = 'https://video.raondr.com/space/fallback.m3u8';

  // 비디오가 로딩되었는지 여부 (상위 컴포넌트에 전달용)
  useEffect(() => {
    if (onVideoStatusChange) {
      // 로컬 비디오는 항시 가동이므로 성공 상태를 반환
      onVideoStatusChange({ isLoaded: true, isTimeout: false });
    }
  }, [onVideoStatusChange]);

  // --- HLS 폴백 비디오 스트리밍 초기화 ---
  useEffect(() => {
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
  }, []);

  return (
    <div className="absolute inset-0 w-full h-full z-0 pointer-events-none bg-black overflow-hidden">
      {/* 로컬 대체 영상: HLS 폴백 비디오 스트리밍 전용 화면 */}
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

      {/* 텍스트 가독성 확보용 부드러운 상하단 그라데이션 필터 */}
      <div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-b from-black/20 to-transparent z-20 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-black/20 via-black/40 to-transparent z-20 pointer-events-none"></div>
    </div>
  );
};

export default VideoBackground;
