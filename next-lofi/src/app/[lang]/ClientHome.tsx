'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import VideoBackground from '@/components/VideoBackground';
import Globe from '@/components/Globe';
import InfoOverlay from '@/components/InfoOverlay';
import AudioPlayer from '@/components/AudioPlayer';
import { fetchISSLocation, fetchLocationDetails, fetchWeather } from '@/services/api';
import { AppState } from '@/types';
import { getDictionary } from '@/i18n/dictionaries';

type StreamAnalysisStatus = 'NORMAL' | 'LOS_BLUE' | 'LOS_STATIC' | 'BLACK' | 'ERROR' | 'OFFLINE';

export default function ClientHome({ lang }: { lang: string }) {
  const t = getDictionary(lang);

  const [state, setState] = useState<AppState>({
    iss: null,
    location: null,
    weather: null,
    isLoading: true,
    error: null,
  });

  const [showStatusText, setShowStatusText] = useState(true);
  const [videoStatus, setVideoStatus] = useState({ isLoaded: false, isTimeout: false });
  const [viewMode, setViewMode] = useState<'auto' | 'archive' | 'live'>('auto');
  const [serverStreamVideoId] = useState<string>('uwXgcTc8oY8');
  const [showIntro, setShowIntro] = useState(true);
  const [isConsoleActivated, setIsConsoleActivated] = useState(false);
  const [serverStreamStatus, setServerStreamStatus] = useState<StreamAnalysisStatus>('OFFLINE');

  const pollTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    async function fetchStreamStatus() {
      try {
        const res = await fetch('/api/stream-status');
        if (res.ok) {
          const data = await res.json();
          setServerStreamStatus(data.status as StreamAnalysisStatus);
        }
      } catch (e) {
        setServerStreamStatus('OFFLINE');
      }
    }
    
    fetchStreamStatus();
    pollTimer.current = setInterval(fetchStreamStatus, 5000);
    
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setShowIntro(false), 5000);
    return () => clearTimeout(timer);
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
        const locData = await fetchLocationDetails(issData.latitude, issData.longitude, lang);
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
  }, [lang]);

  useEffect(() => {
    updateData();
    const intervalId = setInterval(updateData, 10000);
    return () => clearInterval(intervalId);
  }, [updateData]);

  const isEclipsed = state.iss?.visibility === 'eclipsed';
  const isServerAnalysisActive = serverStreamStatus !== 'OFFLINE';

  const isSignalUnstable = (() => {
    if (isServerAnalysisActive && ['LOS_BLUE', 'LOS_STATIC', 'BLACK', 'ERROR'].includes(serverStreamStatus)) {
      return true;
    }

    if (!state.iss) return false;
    const lat = state.iss.latitude;
    const lon = state.iss.longitude;

    if (isEclipsed) return true;
    if (state.location?.isOcean && (lat < -40 || lat > 45)) return true;
    if (lat >= -60 && lat <= -30 && lon >= -170 && lon <= -90) return true;
    if (lat >= -50 && lat <= 0 && lon >= 30 && lon <= 95) return true;

    return false;
  })();

  const forceFallback = (() => {
    if (viewMode === 'archive') return true; 
    if (viewMode === 'live') return false;   
    return isSignalUnstable;                 
  })();

  useEffect(() => {
    setShowStatusText(true);
    const timer = setTimeout(() => setShowStatusText(false), 8000);
    return () => clearTimeout(timer);
  }, [isEclipsed, isSignalUnstable]);

  return (
    <main role="main" className="relative w-screen h-[100dvh] overflow-hidden bg-black font-sans selection:bg-white/30">
      <h1 className="sr-only">
        {lang === 'ko' ? 'Orbital Lofi Station - 국제우주정거장 실시간 위치 및 영상' : 'Orbital Lofi Station - Live ISS Tracker & Space Ambient'}
      </h1>
      <article className="sr-only">
        {lang === 'ko' ? '이 웹 애플리케이션은 NASA의 실시간 외부 카메라 피드를 통해 국제우주정거장(ISS)의 현재 위치를 추적하며, 우주의 평온함을 느낄 수 있는 로파이(Lofi) 음악을 제공합니다.' : 'This web application tracks the International Space Station (ISS) in real-time using NASA\'s live external camera feeds, while providing ambient lofi music.'}
      </article>
      <VideoBackground
        isEclipsed={forceFallback}
        isConsoleActivated={isConsoleActivated}
        videoId={serverStreamVideoId}
        onVideoStatusChange={setVideoStatus}
      />

      <header className="absolute top-0 left-0 w-full p-4 sm:p-6 z-30 flex justify-between items-start pointer-events-none">
        <div className="flex flex-col items-start gap-4 pointer-events-auto">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-white font-bold tracking-widest uppercase text-sm drop-shadow-md">ORBITAL LOFI</h1>
                  <span className="bg-red-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded animate-pulse">{t.LIVE}</span>
                </div>
                <p className="text-white/70 text-[10px] font-mono uppercase tracking-widest drop-shadow-md">{t.ORBIT_FEED}</p>
              </div>
            </div>
            <AudioPlayer autoPlayTrigger={isConsoleActivated} lang={lang} />

            <button
              onClick={() => {
                setViewMode(prev => {
                  if (prev === 'auto') {
                    return (isSignalUnstable || videoStatus.isTimeout || !videoStatus.isLoaded) ? 'live' : 'archive';
                  }
                  if (prev === 'archive') return 'live';
                  return 'archive';
                });
              }}
              className="flex items-center justify-center gap-2 bg-cyan-500/15 hover:bg-cyan-500/30 active:bg-cyan-500/40 text-cyan-50 hover:text-white transition-all duration-300 border border-cyan-500/40 hover:border-cyan-400 rounded-full px-5 py-2 sm:px-6 sm:py-2.5 text-[10px] sm:text-xs font-bold font-mono uppercase tracking-widest shadow-[0_0_15px_rgba(6,182,212,0.2)] hover:shadow-[0_0_25px_rgba(6,182,212,0.4)] backdrop-blur-md pointer-events-auto cursor-pointer max-w-max"
            >
              <span className={`w-2 h-2 rounded-full ${viewMode === 'archive'
                ? 'bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.6)]'
                : viewMode === 'live'
                  ? 'bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]'
                  : 'bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.6)]'
                }`}></span>
              {viewMode === 'archive'
                ? t.BTN_RETURN_LIVE
                : viewMode === 'live'
                  ? t.BTN_SWITCH_ARCHIVE
                  : (isSignalUnstable || videoStatus.isTimeout || !videoStatus.isLoaded)
                    ? t.BTN_RETURN_LIVE
                    : t.BTN_SWITCH_ARCHIVE}
            </button>

            {(forceFallback || videoStatus.isTimeout || !videoStatus.isLoaded) && (
              <div className="bg-black/60 backdrop-blur-md border border-amber-500/30 px-4 py-2.5 rounded-2xl shadow-lg flex items-center gap-2.5 max-w-[280px] sm:max-w-sm transition-all duration-500 animate-fade-in">
                <div className={`w-2 h-2 rounded-full shrink-0 ${!videoStatus.isLoaded && !videoStatus.isTimeout && viewMode !== 'archive' ? 'bg-blue-400 animate-pulse' : 'bg-amber-500 animate-ping'
                  }`}></div>
                <div className="flex flex-col">
                  <span className="text-[8px] sm:text-[9px] text-amber-400 font-bold uppercase tracking-wider font-mono">
                    {viewMode === 'archive'
                      ? t.STATUS_ARCHIVE
                      : isEclipsed
                        ? t.STATUS_NIGHT
                        : videoStatus.isTimeout
                          ? t.STATUS_LOS
                          : isSignalUnstable && viewMode === 'auto'
                            ? (isServerAnalysisActive && ['LOS_BLUE', 'LOS_STATIC', 'BLACK', 'ERROR'].includes(serverStreamStatus)
                              ? (serverStreamStatus === 'LOS_BLUE' ? t.STATUS_LOS_TEXT
                                : serverStreamStatus === 'LOS_STATIC' ? t.STATUS_STATIC_TEXT
                                : serverStreamStatus === 'BLACK' ? t.STATUS_BLACK_TEXT
                                : t.STATUS_ERROR)
                              : t.STATUS_SIGNAL_WEAK)
                            : t.STATUS_CONNECTING}
                  </span>
                  <span className="text-[10px] sm:text-[11px] text-white/90 font-sans leading-tight">
                    {viewMode === 'archive'
                      ? t.DESC_ARCHIVE
                      : isEclipsed
                        ? t.DESC_NIGHT
                        : videoStatus.isTimeout
                          ? t.DESC_TIMEOUT
                          : isSignalUnstable && viewMode === 'auto'
                            ? (isServerAnalysisActive && ['LOS_BLUE', 'LOS_STATIC', 'BLACK', 'ERROR'].includes(serverStreamStatus)
                              ? (serverStreamStatus === 'LOS_BLUE' ? t.DESC_LOS
                                : serverStreamStatus === 'LOS_STATIC' ? t.DESC_STATIC
                                : serverStreamStatus === 'BLACK' ? t.DESC_BLACK
                                : t.DESC_ERROR)
                              : t.DESC_SIGNAL)
                            : t.DESC_CONNECTING}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="pointer-events-auto bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-2 sm:p-4 shadow-2xl shrink-0">
            {state.iss ? (
              <Globe
                lat={state.iss.latitude}
                lng={state.iss.longitude}
                isEclipsed={isEclipsed}
                lang={lang}
              />
            ) : (
              <div className="w-[80px] h-[80px] sm:w-[120px] sm:h-[120px] flex items-center justify-center text-white/30 text-[8px] sm:text-xs font-mono text-center">
                {t.CALIBRATING_TELEMETRY}
              </div>
            )}
          </div>
      </header>

      <div className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 text-center pointer-events-none transition-opacity duration-1000 ${showStatusText ? 'opacity-100' : 'opacity-0'}`}>
        <div className="bg-black/40 backdrop-blur-md border border-white/10 px-8 py-6 rounded-2xl shadow-2xl">
          {isEclipsed ? (
            <>
              <div className="text-white font-mono text-lg tracking-[0.5em] uppercase mb-2">{t.MODAL_NIGHT_TITLE}</div>
              <div className="text-white/70 text-sm max-w-md mx-auto">
                {t.MODAL_NIGHT_DESC}
              </div>
            </>
          ) : (
            <>
              <div className="text-white font-mono text-lg tracking-[0.5em] uppercase mb-2">{t.MODAL_DAY_TITLE}</div>
              <div className="text-white/70 text-sm max-w-md mx-auto">
                {t.MODAL_DAY_DESC}
              </div>
            </>
          )}
        </div>
      </div>

      <InfoOverlay state={state} lang={lang} />

      <div className={`absolute bottom-24 left-1/2 transform -translate-x-1/2 z-40 transition-all duration-[1000ms] ${showIntro ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95 pointer-events-none'
        }`}>
        <div className="bg-black/80 backdrop-blur-xl border border-white/20 p-5 rounded-2xl shadow-2xl text-center max-w-[340px] sm:max-w-md mx-auto">
          <div className="flex items-center justify-center gap-2 mb-1.5 text-xs font-mono text-cyan-400 font-bold uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
            {t.MISSION_BRIEFING}
          </div>
          <h2 className="text-white text-xs sm:text-sm font-bold tracking-wider mb-2 font-sans uppercase">
            {t.INTRO_TITLE}
          </h2>
          <p className="text-white/80 text-[10px] sm:text-[11px] leading-relaxed font-sans text-left sm:text-center">
            {t.INTRO_DESC}
          </p>
        </div>
      </div>

      {state.isLoading && (
        <div className="absolute inset-0 z-50 pointer-events-none flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity duration-1000">
          <div className="text-white font-mono text-xs sm:text-sm tracking-widest animate-pulse border border-white/20 bg-black/60 px-6 py-3 rounded-full shadow-2xl">
            {t.CONNECTING_NETWORK}
          </div>
        </div>
      )}

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
                {t.SYSTEM_READY}
              </h1>
              <p className="text-white/60 text-[10px] font-mono uppercase tracking-[0.2em]">
                {t.CONSOLE_SUBTITLE}
              </p>
            </div>

            <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-4 my-2 max-w-[280px] sm:max-w-xs mx-auto shadow-lg backdrop-blur-md">
              <p className="text-white/90 text-[10px] sm:text-[11px] font-sans leading-relaxed">
                <span className="flex items-center justify-center gap-1.5 text-cyan-400 font-bold tracking-wider mb-2 text-[10px] sm:text-xs uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
                  {t.AUTHENTIC_FEED_TITLE}
                </span>
                {t.AUTHENTIC_FEED_DESC}
              </p>
            </div>

            <button
              onClick={() => setIsConsoleActivated(true)}
              className="mt-4 px-8 py-3 bg-cyan-500/20 hover:bg-cyan-500/30 active:bg-cyan-500/40 text-cyan-400 hover:text-white border border-cyan-500 hover:border-cyan-400 rounded-full text-xs font-mono uppercase tracking-[0.22em] transition-all duration-300 shadow-[0_0_15px_rgba(6,182,212,0.25)] hover:shadow-[0_0_25px_rgba(6,182,212,0.4)] pointer-events-auto cursor-pointer"
            >
              {t.ENTER_CONSOLE}
            </button>

            <span className="text-white/30 text-[8px] font-mono tracking-wider uppercase">
              {t.AUTOPLAY_NOTICE}
            </span>
          </div>
        </div>
      )}
    </main>
  );
}
