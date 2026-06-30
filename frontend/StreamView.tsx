/**
 * StreamView — 유튜브 라이브 캡처 전용 페이지 (/stream)
 * 
 * 메인 사이트(App.tsx)와 동일한 디자인 언어를 사용하되,
 * 유튜브 스트리밍 캡처에 최적화된 읽기 전용 비전이다.
 * 
 * 차이점:
 * - "ENTER CONSOLE" 인트로 없음 (자동 활성화)
 * - 오디오 플레이어 UI 없음 (유튜브가 오디오 관장)
 * - 인터랙티브 요소 없음 (버튼, 호버 이펙트 제거)
 * - backdrop-blur 최소화 (CPU 절약)
 * - 720p (1280x720) 기준 레이아웃
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { fetchISSLocation, fetchLocationDetails, fetchWeather } from './services/api.ts';
import { AppState } from './types.ts';
import { MapPin, Navigation, Cloud, Sun, Moon, Radio } from 'lucide-react';
import { getSpaceFacts, categoryLabels, type SpaceFact } from './services/spaceFacts.ts';
import AudioPlayer from './components/AudioPlayer.tsx';
import Hls from 'hls.js';

type StreamAnalysisStatus = 'NORMAL' | 'LOS_BLUE' | 'LOS_STATIC' | 'BLACK' | 'ERROR' | 'OFFLINE';

const StreamView: React.FC = () => {
  const [state, setState] = useState<AppState>({
    iss: null,
    location: null,
    weather: null,
    isLoading: true,
    error: null,
  });

  const [serverStreamStatus, setServerStreamStatus] = useState<StreamAnalysisStatus>('OFFLINE');
  const wsRef = useRef<WebSocket | null>(null);
  const wsReconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // HLS 비디오 상태
  const videoRef = useRef<HTMLVideoElement>(null);

  // 우주 상식 팩트
  const [activeFacts, setActiveFacts] = useState<SpaceFact[]>([]);
  const [activeFactIndex, setActiveFactIndex] = useState(0);
  const lastFactRefresh = useRef<number>(0);

  // 현재 곡 정보 (서버로부터 수신)
  const [currentSong, setCurrentSong] = useState<string | null>(null);

  // --- WebSocket 연결 ---
  useEffect(() => {
    function connectWs() {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/stream-status`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.status) setServerStreamStatus(data.status as StreamAnalysisStatus);
          } catch (e) { /* ignore */ }
        };

        ws.onclose = () => {
          wsRef.current = null;
          setServerStreamStatus('OFFLINE');
          wsReconnectTimer.current = setTimeout(connectWs, 5000);
        };

        ws.onerror = () => { ws.close(); };
      } catch (e) {
        wsReconnectTimer.current = setTimeout(connectWs, 5000);
      }
    }

    connectWs();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (wsReconnectTimer.current) clearTimeout(wsReconnectTimer.current);
    };
  }, []);

  // --- 데이터 수집 ---
  const lastGeocodedPos = useRef<{ lat: number, lon: number } | null>(null);

  const updateData = useCallback(async () => {
    try {
      const issData = await fetchISSLocation();
      setState(prev => ({ ...prev, iss: issData, isLoading: false }));

      let shouldUpdateLocation = false;
      if (!lastGeocodedPos.current) {
        shouldUpdateLocation = true;
      } else {
        const R = 6371;
        const dLat = (issData.latitude - lastGeocodedPos.current.lat) * Math.PI / 180;
        const dLon = (issData.longitude - lastGeocodedPos.current.lon) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(lastGeocodedPos.current.lat * Math.PI / 180) * Math.cos(issData.latitude * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
        const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        if (dist > 50) shouldUpdateLocation = true;
      }

      if (shouldUpdateLocation) {
        lastGeocodedPos.current = { lat: issData.latitude, lon: issData.longitude };
        const locData = await fetchLocationDetails(issData.latitude, issData.longitude);
        setState(prev => ({ ...prev, location: locData }));
        const weatherData = await fetchWeather(issData.latitude, issData.longitude);
        setState(prev => ({ ...prev, weather: weatherData }));
      }
    } catch (error) {
      console.error("Update failed:", error);
    }
  }, []);

  useEffect(() => {
    updateData();
    const id = setInterval(updateData, 10000);
    return () => clearInterval(id);
  }, []);

  // --- HLS 비디오 연동 ---
  // 임시 테스트용 무료 HLS 링크 (개발자님이 나중에 GCS 링크로 교체하시면 됩니다)
  // 예: https://storage.googleapis.com/your-bucket/video/fallback.m3u8
  const HLS_STREAM_URL = 'https://space.raondr.com/space/fallback.m3u8';

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (Hls.isSupported()) {
      const hls = new Hls({
        autoStartLoad: true, // 초기에 백그라운드에서 로드
        capLevelToPlayerSize: true, // 플레이어 크기에 맞춰 화질 조절 (트래픽 절약)
      });
      hls.loadSource(HLS_STREAM_URL);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(e => console.log('HLS Auto-play prevented', e));
      });

      return () => {
        hls.destroy();
      };
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari 등 HLS 네이티브 지원 브라우저 대응
      video.src = HLS_STREAM_URL;
      video.addEventListener('loadedmetadata', () => {
        video.play().catch(e => console.log('Native HLS Auto-play prevented', e));
      });
    }
  }, []);

  // --- 우주 상식 팩트 ---
  useEffect(() => {
    const now = Date.now();
    if (now - lastFactRefresh.current < 30000 && activeFacts.length > 0) return;
    lastFactRefresh.current = now;
    const facts = getSpaceFacts(3, {
      isEclipsed: state.iss?.visibility === 'eclipsed',
      isOcean: state.location?.isOcean,
      latitude: state.iss?.latitude,
      longitude: state.iss?.longitude,
      country: state.location?.country || undefined,
    });
    setActiveFacts(facts);
    setActiveFactIndex(0);
  }, [state.iss?.latitude, state.iss?.longitude]);

  useEffect(() => {
    if (activeFacts.length <= 1) return;
    const id = setInterval(() => setActiveFactIndex(p => (p + 1) % activeFacts.length), 8000);
    return () => clearInterval(id);
  }, [activeFacts.length]);

  // --- 음악 파일에서 현재 곡 추정 ---
  useEffect(() => {
    fetch('/api/music-list')
      .then(r => r.json())
      .then((tracks: string[]) => {
        if (tracks?.length > 0) {
          const idx = Math.floor(Date.now() / (3 * 60 * 1000)) % tracks.length;
          setCurrentSong(tracks[idx].replace('.mp3', '').replace(/_/g, ' '));
        }
      })
      .catch(() => { });

    const id = setInterval(() => {
      fetch('/api/music-list')
        .then(r => r.json())
        .then((tracks: string[]) => {
          if (tracks?.length > 0) {
            const idx = Math.floor(Date.now() / (3 * 60 * 1000)) % tracks.length;
            setCurrentSong(tracks[idx].replace('.mp3', '').replace(/_/g, ' '));
          }
        })
        .catch(() => { });
    }, 30000);
    return () => clearInterval(id);
  }, []);

  const { iss, location, weather } = state;
  const isEclipsed = iss?.visibility === 'eclipsed';
  const isServerAnalysisActive = serverStreamStatus !== 'OFFLINE';
  const isSignalUnstable = isServerAnalysisActive
    ? ['LOS_BLUE', 'LOS_STATIC', 'BLACK', 'ERROR'].includes(serverStreamStatus)
    : isEclipsed;

  const currentFact = activeFacts[activeFactIndex];
  const formatCoord = (val: number, isLat: boolean) => {
    const dir = isLat ? (val >= 0 ? 'N' : 'S') : (val >= 0 ? 'E' : 'W');
    return `${Math.abs(val).toFixed(4)}° ${dir}`;
  };

  if (state.isLoading) {
    return (
      <main className="relative w-screen h-[100dvh] overflow-hidden bg-black flex items-center justify-center">
        <div className="text-white font-mono tracking-widest animate-pulse text-sm">
          CONNECTING TO ORBITAL GRID...
        </div>
      </main>
    );
  }

  return (
    <main className="relative w-screen h-[100dvh] overflow-hidden bg-black font-sans selection:bg-white/30">

      {/* ─── 배경: HLS 비디오 플레이어 ─── */}
      <div className="absolute inset-0 w-full h-full z-0 bg-black">
        <video
          ref={videoRef}
          className="w-full h-full object-cover opacity-85"
          autoPlay
          muted
          loop
          playsInline
        />
      </div>

      {/* 상하 그라데이션 (텍스트 가독성) */}
      <div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-b from-black/40 to-transparent z-20 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-black/60 via-black/40 to-transparent z-20 pointer-events-none"></div>

      {/* ─── 상단 좌측: ORBITAL LOFI 헤더 ─── */}
      <header className="absolute top-0 left-0 w-full p-5 z-30 flex justify-between items-start">
        <div className="flex flex-col gap-3">
          {/* 로고 */}
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-white font-bold tracking-widest uppercase text-xs drop-shadow-md">ORBITAL LOFI</h1>
                <span className="bg-red-500 text-white text-[7px] font-bold px-1.5 py-0.5 rounded animate-pulse">LIVE</span>
              </div>
              <p className="text-white/60 text-[9px] font-mono uppercase tracking-widest drop-shadow-md">ISS ORBITAL FEED</p>
            </div>
          </div>

          {/* 오디오 플레이어 (자동 재생) */}
          <AudioPlayer autoPlayTrigger={true} />

          {/* 현재 재생 중인 곡 */}
          {currentSong && (
            <div className="bg-black/50 border border-white/10 px-3 py-2 rounded-xl max-w-[320px]">
              <div className="text-[8px] text-white/40 font-mono uppercase tracking-wider mb-0.5">♫ NOW PLAYING</div>
              <div className="text-[11px] text-white/85 truncate">{currentSong}</div>
            </div>
          )}

          {/* LOS/상태 배너 */}
          {isSignalUnstable && (
            <div className="bg-black/60 border border-amber-500/30 px-3 py-2 rounded-xl max-w-[300px] flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-ping shrink-0"></div>
              <div className="flex flex-col">
                <span className="text-[8px] text-amber-400 font-bold uppercase tracking-wider font-mono">
                  {serverStreamStatus === 'LOS_BLUE' ? 'LOS (Loss of Signal)'
                    : serverStreamStatus === 'LOS_STATIC' ? 'LOS (Static Screen)'
                      : serverStreamStatus === 'BLACK' ? 'Camera Transition'
                        : isEclipsed ? 'Night Orbit'
                          : 'Signal Estimated Weak'}
                </span>
                <span className="text-[9px] text-white/75 leading-tight">
                  {serverStreamStatus === 'LOS_BLUE' ? 'NASA feed is displaying a Loss of Signal screen.'
                    : serverStreamStatus === 'LOS_STATIC' ? 'NASA feed is showing a static announcement.'
                      : serverStreamStatus === 'BLACK' ? 'Live camera feed is in a dark transition.'
                        : isEclipsed ? 'ISS has entered Earth\'s shadow.'
                          : 'Showing archived orbital views.'}
                </span>
              </div>
            </div>
          )}

          {/* 분석기 상태 인디케이터 */}
          <div className={`flex items-center gap-1.5 text-[7px] font-mono uppercase tracking-wider ${isServerAnalysisActive ? 'text-green-400/60' : 'text-white/25'}`}>
            <span className={`w-1 h-1 rounded-full ${isServerAnalysisActive ? 'bg-green-400 animate-pulse' : 'bg-white/20'}`}></span>
            {isServerAnalysisActive ? 'Stream Analysis Active' : 'Analyzer Offline'}
          </div>
        </div>

        {/* 상단 우측: UTC 시계 */}
        <div className="text-white/35 text-[9px] font-mono tracking-wider">
          {new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC
        </div>
      </header>

      {/* ─── 하단: 텔레메트리 + 팩트 ─── */}
      <div className="absolute bottom-0 left-0 w-full p-4 pb-8 sm:pb-4 z-30 flex flex-col gap-2">
        {/* ISS 라이브 카메라 피드 라벨 */}
        <div className="text-[9px] font-mono text-white/40 tracking-[0.2em] uppercase pl-1 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
          ISS LIVE EXTERNAL CAMERA FEED
        </div>

        <div className="flex gap-3 items-end justify-between">
          <div className="flex-1 min-w-0 max-w-xl bg-black/55 border border-white/10 rounded-2xl p-4 shadow-2xl">
            <div className="flex items-start justify-between mb-3 gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-white/50 text-[9px] font-mono uppercase tracking-widest mb-1">
                  <Radio size={10} className="text-red-500 animate-pulse shrink-0" />
                  <span className="truncate">ORBITAL TARGET</span>
                </div>
                <h2 className="text-xl font-light text-white tracking-wide flex items-start gap-2">
                  <MapPin className="text-blue-400 shrink-0 mt-1" size={16} />
                  <span className="break-words whitespace-normal leading-tight">{location?.name || 'CALIBRATING COORDINATES...'}</span>
                </h2>
                <p className="text-white/50 text-xs mt-1 ml-6 break-words whitespace-normal leading-snug">
                  {location?.country} {location?.region ? `• ${location.region}` : ''}
                </p>
              </div>
              {weather && (
                <div className="text-right shrink-0 ml-2">
                  <div className="flex items-center gap-1.5 text-lg font-light text-white">
                    {weather.temperature}°C
                    {weather.isDay ? <Sun className="text-yellow-400" size={16} /> : <Moon className="text-blue-200" size={16} />}
                  </div>
                  <div className="text-white/50 text-xs flex items-center gap-1 mt-0.5">
                    <Cloud size={10} />
                    {weather.condition}
                  </div>
                </div>
              )}
            </div>

            {/* 텔레메트리 그리드 */}
            {iss && (
              <div className="grid grid-cols-3 gap-3 pt-3 border-t border-white/10">
                <div>
                  <div className="text-white/35 text-[8px] font-mono uppercase tracking-wider mb-0.5">LATITUDE</div>
                  <div className="text-white font-mono text-xs">{formatCoord(iss.latitude, true)}</div>
                </div>
                <div>
                  <div className="text-white/35 text-[8px] font-mono uppercase tracking-wider mb-0.5">LONGITUDE</div>
                  <div className="text-white font-mono text-xs">{formatCoord(iss.longitude, false)}</div>
                </div>
                <div>
                  <div className="text-white/35 text-[8px] font-mono uppercase tracking-wider mb-0.5">ALTITUDE / VELOCITY</div>
                  <div className="text-white font-mono text-xs flex items-center gap-1">
                    <Navigation size={9} className="text-green-400 shrink-0" />
                    {Math.round(iss.altitude)}km / {Math.round(iss.velocity)}km/h
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 우주 상식 팩트 카드 */}
          <div className="bg-black/55 border border-white/10 rounded-2xl p-3 w-[360px] h-[130px] flex flex-col shadow-2xl overflow-hidden relative">
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-white/35 text-[9px] font-mono uppercase tracking-wider flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse"></div>
                SPACE INTELLIGENCE
              </div>
              {currentFact && (
                <div className="text-[7px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400/70 border border-cyan-500/20">
                  {categoryLabels[currentFact.category] || currentFact.category}
                </div>
              )}
            </div>
            <div className="flex-1 flex flex-col justify-center pr-1">
              {currentFact ? (
                <div key={`${currentFact.id}-${activeFactIndex}`}>
                  <div className="text-white/90 text-[10px] leading-relaxed border-l-2 border-cyan-500/50 pl-3 py-0.5">
                    <span className="mr-1">{currentFact.icon}</span>
                    <span className="text-cyan-400 font-semibold">{currentFact.title_en}</span>
                    <span className="text-white/35 mx-1">—</span>
                    <span>{currentFact.text_en}</span>
                  </div>
                  <div className="text-white/20 text-[7px] font-mono mt-1 pl-4 tracking-wider">
                    SOURCE: {currentFact.source}
                  </div>
                </div>
              ) : (
                <div className="text-white/25 text-xs italic animate-pulse font-mono">
                  Synchronizing space intelligence feed...
                </div>
              )}
            </div>
            {activeFacts.length > 1 && (
              <div className="absolute bottom-2 right-3 flex gap-1">
                {activeFacts.map((_, idx) => (
                  <div
                    key={idx}
                    className={`w-1 h-1 rounded-full transition-all duration-300 ${idx === activeFactIndex ? 'bg-cyan-400 w-2' : 'bg-white/15'}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
};

export default StreamView;
