import React, { useState, useEffect, useCallback, useRef } from 'react';
import VideoBackground from './components/VideoBackground.tsx';
import Globe from './components/Globe.tsx';
import InfoOverlay from './components/InfoOverlay.tsx';
import AudioPlayer from './components/AudioPlayer.tsx';
import { fetchISSLocation, fetchLocationDetails, fetchWeather } from './services/api.ts';
import { AppState } from './types.ts';

// 서버 측 스트림 분석 상태 타입
type StreamAnalysisStatus = 'NORMAL' | 'LOS_BLUE' | 'LOS_STATIC' | 'BLACK' | 'ERROR' | 'OFFLINE';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    iss: null,
    location: null,
    weather: null,
    isLoading: true,
    error: null,
  });

  // 중앙 안내 문구 표시 여부 상태
  const [showStatusText, setShowStatusText] = useState(true);

  // 비디오 로딩 및 타임아웃 상태 관리
  const [videoStatus, setVideoStatus] = useState({ isLoaded: false, isTimeout: false });

  // 뷰 모드 상태: 'auto' (자동 감지 우회), 'archive' (강제 로컬 이미지), 'live' (강제 라이브 비디오 연결 시도)
  const [viewMode, setViewMode] = useState<'auto' | 'archive' | 'live'>('auto');

  // 서버 측 스트림 분석 결과 (WebSocket으로 수신)
  const [serverStreamStatus, setServerStreamStatus] = useState<StreamAnalysisStatus>('OFFLINE');
  const [serverStreamUrl, setServerStreamUrl] = useState<string | null>(null);
  const [serverStreamVideoId, setServerStreamVideoId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const wsReconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 첫 진입 안내 인트로 오버레이 상태
  const [showIntro, setShowIntro] = useState(true);

  // 콘솔 기동 활성화 상태 (브라우저 Autoplay Restriction 우회용)
  const [isConsoleActivated, setIsConsoleActivated] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowIntro(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  // --- WebSocket: 서버 측 스트림 분석 상태 수신 ---
  useEffect(() => {
    function connectWs() {
      try {
        const isDev = import.meta.env.DEV;
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = isDev
          ? `${protocol}//${window.location.hostname}:5001/ws/stream-status`
          : `${protocol}//${window.location.host}/ws/stream-status`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('[WS] Connected to stream analyzer');
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.status) {
              setServerStreamStatus(data.status as StreamAnalysisStatus);
            }
            if (data.streamUrl !== undefined) {
              setServerStreamUrl(data.streamUrl);
            }
            if (data.videoId !== undefined) {
              setServerStreamVideoId(data.videoId);
            }
          } catch (e) {
            console.error('[WS] Failed to parse message:', e);
          }
        };

        ws.onclose = () => {
          console.log('[WS] Disconnected, reconnecting in 5s...');
          wsRef.current = null;
          setServerStreamStatus('OFFLINE');
          setServerStreamUrl(null);
          setServerStreamVideoId(null);
          wsReconnectTimer.current = setTimeout(connectWs, 5000);
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch (e) {
        console.error('[WS] Connection error:', e);
        wsReconnectTimer.current = setTimeout(connectWs, 5000);
      }
    }

    connectWs();

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (wsReconnectTimer.current) clearTimeout(wsReconnectTimer.current);
    };
  }, []);

  const lastGeocodedPos = useRef<{ lat: number, lon: number } | null>(null);
  const lastCountry = useRef<string | null>(null);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const updateData = useCallback(async () => {
    try {
      const issData = await fetchISSLocation();
      setState(prev => ({ ...prev, iss: issData, isLoading: false }));

      let shouldUpdateLocation = false;
      if (!lastGeocodedPos.current) {
        shouldUpdateLocation = true;
      } else {
        const dist = calculateDistance(
          lastGeocodedPos.current.lat, lastGeocodedPos.current.lon,
          issData.latitude, issData.longitude
        );
        if (dist > 50) shouldUpdateLocation = true;
      }

      if (shouldUpdateLocation) {
        const locData = await fetchLocationDetails(issData.latitude, issData.longitude);
        lastGeocodedPos.current = { lat: issData.latitude, lon: issData.longitude };

        setState(prev => ({ ...prev, location: locData }));

        const weatherData = await fetchWeather(issData.latitude, issData.longitude);
        setState(prev => ({ ...prev, weather: weatherData }));

        if (locData.country !== lastCountry.current) {
          lastCountry.current = locData.country;
        }
      }
    } catch (error) {
      console.error("Update cycle failed:", error);
      setState(prev => ({ ...prev, error: "Connection lost. Retrying..." }));
    }
  }, []);

  useEffect(() => {
    updateData();
    const intervalId = setInterval(updateData, 10000);
    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isEclipsed = state.iss?.visibility === 'eclipsed';

  // 서버 측 스트림 분석이 활성화되었는지 여부
  const isServerAnalysisActive = serverStreamStatus !== 'OFFLINE';

  // 통신 신호 불안정(LOS) 판별: 서버 분석 우선, 미연결 시 위치 기반 추정 폴백
  const isSignalUnstable = (() => {
    // 1. 서버 측 분석 결과가 있으면 최우선 적용
    if (isServerAnalysisActive) {
      return serverStreamStatus === 'LOS_BLUE' || serverStreamStatus === 'LOS_STATIC' || serverStreamStatus === 'BLACK' || serverStreamStatus === 'ERROR';
    }

    // 2. 서버 미연결 시 기존 위치 기반 폴백 (정확도 낮음)
    if (!state.iss) return false;
    const lat = state.iss.latitude;
    const lon = state.iss.longitude;

    if (isEclipsed) return true;
    if (state.location?.isOcean && (lat < -40 || lat > 45)) return true;
    if (lat >= -60 && lat <= -30 && lon >= -170 && lon <= -90) return true;
    if (lat >= -50 && lat <= 0 && lon >= 30 && lon <= 95) return true;

    return false;
  })();

  // 최종 대체 이미지 우회 활성화 여부 계산
  const forceFallback = (() => {
    if (viewMode === 'archive') return true; // 이미지 고정 모드
    if (viewMode === 'live') return false;   // 강제 비디오 송출 시도 모드
    return isSignalUnstable;                 // 자동 감지 모드 (서버 분석 또는 위치 기반)
  })();

  // 주간/야간 또는 신호 불안정 상태가 바뀔 때마다 안내 문구를 띄우고 8초 뒤에 숨김
  useEffect(() => {
    setShowStatusText(true);
    const timer = setTimeout(() => {
      setShowStatusText(false);
    }, 8000);
    return () => clearTimeout(timer);
  }, [isEclipsed, isSignalUnstable, serverStreamStatus]);

  return (
    <main role="main" className="relative w-screen h-screen overflow-hidden bg-black font-sans selection:bg-white/30">

      <VideoBackground 
        isEclipsed={forceFallback} 
        isConsoleActivated={isConsoleActivated} 
        videoId={serverStreamVideoId}
        onVideoStatusChange={setVideoStatus} 
      />

      <header className="absolute top-0 left-0 w-full p-4 sm:p-6 z-30 flex justify-between items-start pointer-events-none">
        <div className="flex flex-col gap-4 pointer-events-auto">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-white font-bold tracking-widest uppercase text-sm drop-shadow-md">ORBITAL LOFI</h1>
                <span className="bg-red-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded animate-pulse">LIVE</span>
              </div>
              <p className="text-white/70 text-[10px] font-mono uppercase tracking-widest drop-shadow-md">ISS ORBITAL FEED</p>
            </div>
          </div>
          <AudioPlayer autoPlayTrigger={isConsoleActivated} />

          {/* 수동 대체 이미지 / 라이브 영상 전환 토글 버튼 */}
          <button
            onClick={() => {
              setViewMode(prev => {
                if (prev === 'auto') {
                  // 현재 자동 감지 상태에서 밤/ZOE/연결실패 상황이면 라이브 강제 기동 시도, 그 외엔 아카이브 이미지 고정
                  return (isSignalUnstable || videoStatus.isTimeout || !videoStatus.isLoaded) ? 'live' : 'archive';
                }
                if (prev === 'archive') return 'live';
                return 'archive'; // 강제 라이브 상태면 아카이브 고정으로 전환
              });
            }}
            className="flex items-center justify-center gap-1.5 bg-black/40 hover:bg-black/60 active:bg-black/80 text-white/85 hover:text-white transition-all border border-white/10 rounded-full px-3 py-1.5 text-[9px] font-mono uppercase tracking-wider max-w-max shadow-md pointer-events-auto"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${viewMode === 'archive'
              ? 'bg-amber-500 animate-pulse'
              : viewMode === 'live'
                ? 'bg-red-500 animate-pulse'
                : 'bg-green-500 animate-pulse'
              }`}></span>
            {viewMode === 'archive'
              ? "Return to Live Stream"
              : viewMode === 'live'
                ? "Switch to Orbital Views"
                : (isSignalUnstable || videoStatus.isTimeout || !videoStatus.isLoaded)
                  ? "Return to Live Stream"
                  : "Switch to Orbital Views"}
          </button>

          {(forceFallback || videoStatus.isTimeout || !videoStatus.isLoaded) && (
            <div className="bg-black/60 backdrop-blur-md border border-amber-500/30 px-4 py-2.5 rounded-2xl shadow-lg flex items-center gap-2.5 max-w-[280px] sm:max-w-sm transition-all duration-500 animate-fade-in">
              <div className={`w-2 h-2 rounded-full shrink-0 ${!videoStatus.isLoaded && !videoStatus.isTimeout && viewMode !== 'archive' ? 'bg-blue-400 animate-pulse' : 'bg-amber-500 animate-ping'
                }`}></div>
              <div className="flex flex-col">
                <span className="text-[8px] sm:text-[9px] text-amber-400 font-bold uppercase tracking-wider font-mono">
                  {viewMode === 'archive'
                    ? "Archival Simulation"
                    : serverStreamStatus === 'LOS_BLUE'
                      ? "LOS (Loss of Signal)"
                      : serverStreamStatus === 'LOS_STATIC'
                        ? "LOS (Static Screen)"
                        : serverStreamStatus === 'BLACK'
                          ? "Camera Transition"
                          : isEclipsed
                            ? "Night Orbit"
                            : videoStatus.isTimeout
                              ? "Uplink Lost"
                              : isSignalUnstable && viewMode === 'auto'
                                ? "Signal Estimated Weak"
                                : "Establishing Link"}
                </span>
                <span className="text-[10px] sm:text-[11px] text-white/90 font-sans leading-tight">
                  {viewMode === 'archive'
                    ? "Simulated archival mode active. Return to the live stream to attempt reconnection."
                    : serverStreamStatus === 'LOS_BLUE'
                      ? "NASA feed is displaying a Loss of Signal screen. Showing archived orbital views."
                      : serverStreamStatus === 'LOS_STATIC'
                        ? "NASA feed is showing a static announcement. Showing archived orbital views."
                        : serverStreamStatus === 'BLACK'
                          ? "Live camera feed is in a dark transition. Displaying archived orbital views."
                          : isEclipsed
                            ? "The spacecraft has entered Earth's shadow. Displaying high-fidelity archived orbital views."
                            : videoStatus.isTimeout
                              ? "Live telemetry uplink lost or temporarily offline. Switched to archival orbital loop."
                              : isSignalUnstable && viewMode === 'auto'
                                ? "Station position suggests possible signal degradation. Using archived views as precaution."
                                : "Establishing secure uplink connection to the live camera feed..."}
                </span>
              </div>
            </div>
          )}

          {/* 서버 분석기 연결 상태 인디케이터 */}
          <div className={`flex items-center gap-1.5 text-[8px] font-mono uppercase tracking-wider transition-opacity duration-500 ${isServerAnalysisActive ? 'text-green-400/70' : 'text-white/30'
            }`}>
            <span className={`w-1 h-1 rounded-full ${isServerAnalysisActive ? 'bg-green-400 animate-pulse' : 'bg-white/20'
              }`}></span>
            {isServerAnalysisActive ? 'Stream Analysis Active' : 'Analyzer Offline — Using Position Estimate'}
          </div>
        </div>

        <div className="pointer-events-auto bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-2 sm:p-4 shadow-2xl shrink-0">
          {state.iss ? (
            <Globe
              lat={state.iss.latitude}
              lng={state.iss.longitude}
              isEclipsed={isEclipsed}
            />
          ) : (
            <div className="w-[80px] h-[80px] sm:w-[120px] sm:h-[120px] flex items-center justify-center text-white/30 text-[8px] sm:text-xs font-mono text-center">
              Calibrating Telemetry...
            </div>
          )}
        </div>
      </header>

      {/* 중앙 안내 문구 (8초 후 자연스럽게 페이드아웃) */}
      <div className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 text-center pointer-events-none transition-opacity duration-1000 ${showStatusText ? 'opacity-100' : 'opacity-0'}`}>
        <div className="bg-black/40 backdrop-blur-md border border-white/10 px-8 py-6 rounded-2xl shadow-2xl">
          {isEclipsed ? (
            <>
              <div className="text-white font-mono text-lg tracking-[0.5em] uppercase mb-2">Night Orbit</div>
              <div className="text-white/70 text-sm max-w-md mx-auto">
                The spacecraft is traversing Earth's night side. Enjoy curated orbital views until sunrise.
              </div>
            </>
          ) : (
            <>
              <div className="text-white font-mono text-lg tracking-[0.5em] uppercase mb-2">Daylight Orbit</div>
              <div className="text-white/70 text-sm max-w-md mx-auto">
                The spacecraft is operating under direct sunlight. Displaying live external feed.
              </div>
            </>
          )}
        </div>
      </div>


      <InfoOverlay state={state} />


      {/* 첫 진입 환영 및 서비스 설명 인트로 배너 (5초 후 페이드아웃) */}
      <div className={`absolute bottom-24 left-1/2 transform -translate-x-1/2 z-40 transition-all duration-[1000ms] ${showIntro ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95 pointer-events-none'
        }`}>
        <div className="bg-black/80 backdrop-blur-xl border border-white/20 p-5 rounded-2xl shadow-2xl text-center max-w-[340px] sm:max-w-md mx-auto">
          <div className="flex items-center justify-center gap-2 mb-1.5 text-xs font-mono text-cyan-400 font-bold uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
            MISSION BRIEFING
          </div>
          <h2 className="text-white text-xs sm:text-sm font-bold tracking-wider mb-2 font-sans">
            ISS ORBITAL COMMAND & AMBIENT FEED
          </h2>
          <p className="text-white/80 text-[10px] sm:text-[11px] leading-relaxed font-sans text-left sm:text-center">
            Welcome to the Orbital Command Console. This platform tracks the **International Space Station (ISS)** in real time, overlaying live external NASA camera feeds. If the station enters Earth's shadow (orbital night) or encounters a Loss of Signal (LOS), the console seamlessly transitions to archived high-fidelity orbital imagery.
          </p>
        </div>
      </div>

      {state.isLoading && (
        <div className="absolute inset-0 z-50 bg-black flex items-center justify-center">
          <div className="text-white font-mono tracking-widest animate-pulse">CONNECTING TO ORBITAL GRID...</div>
        </div>
      )}

      {/* 콘솔 활성화 전 전체 화면 오버레이 (배경을 투명하게 하여 처음부터 대시보드와 영상이 보이도록 처리) */}
      {!isConsoleActivated && (
        <div className="absolute inset-0 z-50 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center transition-all duration-[1000ms]">
          <div className="z-10 text-center flex flex-col items-center gap-6 max-w-md px-6 bg-black/75 backdrop-blur-xl border border-cyan-500/20 p-8 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.8)] animate-fade-in pointer-events-auto">
            <div className="relative flex items-center justify-center w-20 h-20 mb-1">
              <div className="absolute inset-0 rounded-full border border-cyan-500/30 animate-ping"></div>
              <div className="absolute inset-2 rounded-full border border-cyan-500/50"></div>
              <div className="absolute inset-4 rounded-full border border-cyan-400 flex items-center justify-center">
                <span className="w-3 h-3 rounded-full bg-cyan-500 animate-pulse"></span>
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-white font-mono text-xs tracking-[0.4em] uppercase text-cyan-400 font-bold">
                SYSTEM READY
              </h1>
              <p className="text-white/60 text-[10px] font-mono uppercase tracking-[0.2em]">
                Orbital Ambient Command Console
              </p>
            </div>

            <button
              onClick={() => {
                setIsConsoleActivated(true);
              }}
              className="mt-4 px-8 py-3 bg-cyan-500/20 hover:bg-cyan-500/30 active:bg-cyan-500/40 text-cyan-400 hover:text-white border border-cyan-500 hover:border-cyan-400 rounded-full text-xs font-mono uppercase tracking-[0.22em] transition-all duration-300 shadow-[0_0_15px_rgba(6,182,212,0.25)] hover:shadow-[0_0_25px_rgba(6,182,212,0.4)] pointer-events-auto cursor-pointer"
            >
              ENTER CONSOLE
            </button>

            <span className="text-white/30 text-[8px] font-mono tracking-wider uppercase">
              Uplink initialization bypasses browser autoplay restrictions.
            </span>
          </div>
        </div>
      )}
    </main>
  );
};

export default App;
