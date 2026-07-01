'use client';

import React, { useState, useEffect, useRef } from 'react';
import Hls from 'hls.js';

interface VideoBackgroundProps {
  isEclipsed: boolean;
  isConsoleActivated?: boolean;
  videoId?: string | null;
  onVideoStatusChange?: (status: { isLoaded: boolean; isTimeout: boolean }) => void;
}

const VideoBackground: React.FC<VideoBackgroundProps> = ({
  isEclipsed,
  isConsoleActivated = false,
  videoId = null,
  onVideoStatusChange
}) => {
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isVideoTimeout, setIsVideoTimeout] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const playerRef = useRef<any>(null);
  const fallbackVideoRef = useRef<HTMLVideoElement>(null);
  const HLS_STREAM_URL = 'https://video.raondr.com/space/fallback.m3u8';

  const showLiveVideo = isVideoLoaded && !isVideoTimeout && !isEclipsed;

  // Cloudflare HLS Fallback Initialization
  useEffect(() => {
    if (showLiveVideo || !fallbackVideoRef.current) return;

    const video = fallbackVideoRef.current;
    let hls: Hls | null = null;

    if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true, lowLatencyMode: true });
      hls.loadSource(HLS_STREAM_URL);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(e => console.warn("HLS autoplay prevented", e));
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = HLS_STREAM_URL;
      video.addEventListener('loadedmetadata', () => {
        video.play().catch(e => console.warn("Native HLS autoplay prevented", e));
      });
    }

    return () => {
      if (hls) {
        hls.destroy();
      }
    };
  }, [showLiveVideo]);

  useEffect(() => {
    if (!isVideoTimeout) return;
    const retryTimer = setTimeout(() => {
      setIsVideoLoaded(false);
      setIsVideoTimeout(false);
      setRetryKey(prev => prev + 1);
    }, 45000);
    return () => clearTimeout(retryTimer);
  }, [isVideoTimeout]);

  useEffect(() => {
    if (!isEclipsed) {
      setIsVideoLoaded(false);
      setIsVideoTimeout(false);
    }
  }, [isEclipsed]);

  useEffect(() => {
    if (isEclipsed || !videoId) {
      setIsVideoLoaded(false);
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch (e) { }
        playerRef.current = null;
      }
      return;
    }

    if (playerRef.current) {
      try { playerRef.current.destroy(); } catch (e) { }
      playerRef.current = null;
    }

    if (!(window as any).YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
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
            setIsVideoTimeout(true);
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
        try { playerRef.current.destroy(); } catch (e) { }
        playerRef.current = null;
      }
      setIsVideoLoaded(false);
    };
  }, [videoId, isEclipsed, retryKey]);

  useEffect(() => {
    if (onVideoStatusChange) {
      onVideoStatusChange({ isLoaded: isVideoLoaded, isTimeout: isVideoTimeout });
    }
  }, [isVideoLoaded, isVideoTimeout, onVideoStatusChange]);

  useEffect(() => {
    if (!isConsoleActivated || !videoId) return;
    const timer = setTimeout(() => {
      if (!isVideoLoaded) {
        setIsVideoTimeout(true);
      }
    }, 25000);
    return () => clearTimeout(timer);
  }, [isVideoLoaded, videoId, isConsoleActivated]);

  return (
    <div className="absolute inset-0 w-full h-full z-0 pointer-events-none bg-black overflow-hidden">
      <style>{`
        @keyframes cinematicSpaceTravel {
          0% { transform: scale(1.02) rotate(0deg) translate(0px, 0px); }
          100% { transform: scale(1.15) rotate(0.8deg) translate(-2%, -1%); }
        }
        .cinematic-space-active { animation: cinematicSpaceTravel 9000ms cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards; }
      `}</style>

      <div className={`absolute inset-0 w-full h-full transition-opacity duration-[1500ms] ease-in-out overflow-hidden ${showLiveVideo ? 'z-10 opacity-100 visible' : 'z-0 opacity-0 invisible pointer-events-none'}`}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '100vw', height: '56.25vw', minHeight: '100vh', minWidth: '177.77vh' }} className="pointer-events-none">
          <div id="youtube-player" className="w-full h-full object-cover pointer-events-none" />
        </div>
      </div>

      {!showLiveVideo && (
        <div className="absolute inset-0 w-full h-full z-10 overflow-hidden bg-black transition-opacity duration-1000 cinematic-space-active">
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

      <div className="absolute top-0 left-0 w-full h-48 bg-gradient-to-b from-black/60 via-black/20 to-transparent z-20 pointer-events-none"></div>
      
      {/* Subtle color grading overlay */}
      <div className="absolute inset-0 w-full h-full bg-[#0a192f]/10 mix-blend-overlay z-20 pointer-events-none"></div>
      
      {/* Vignette effect */}
      <div className="absolute inset-0 w-full h-full bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.4)_100%)] z-20 pointer-events-none"></div>

      <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-black/80 via-black/30 to-transparent z-20 pointer-events-none"></div>
    </div>
  );
};

export default VideoBackground;
