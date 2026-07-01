'use client';

import React from 'react';
import Link from 'next/link';
import { MapPin, Navigation, Cloud, Sun, Moon, Radio } from 'lucide-react';
import { AppState } from '../types';
import { getSpaceFacts, categoryLabels, type SpaceFact } from '../services/spaceFacts';
import { getDictionary } from '@/i18n/dictionaries';

interface InfoOverlayProps {
  state: AppState;
  lang?: string;
}

const InfoOverlay: React.FC<InfoOverlayProps> = ({ state, lang }) => {
  const { iss, location, weather } = state;
  const t = getDictionary(lang);

  const [activeFacts, setActiveFacts] = React.useState<SpaceFact[]>([]);
  const [activeFactIndex, setActiveFactIndex] = React.useState(0);

  const lastFactRefresh = React.useRef<number>(0);
  React.useEffect(() => {
    const now = Date.now();
    if (now - lastFactRefresh.current < 30000 && activeFacts.length > 0) return;
    lastFactRefresh.current = now;

    const facts = getSpaceFacts(3, {
      isEclipsed: iss?.visibility === 'eclipsed',
      isOcean: location?.isOcean,
      latitude: iss?.latitude,
      longitude: iss?.longitude,
      country: location?.country || undefined,
    });
    setActiveFacts(facts);
    setActiveFactIndex(0);
  }, [iss?.latitude, iss?.longitude, iss?.visibility, location?.isOcean]);

  React.useEffect(() => {
    if (activeFacts.length <= 1) return;
    const interval = setInterval(() => {
      setActiveFactIndex((prev) => (prev + 1) % activeFacts.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [activeFacts.length]);

  if (!iss) return null;

  const currentFact = activeFacts[activeFactIndex];

  const formatCoord = (val: number, isLat: boolean) => {
    const dir = isLat ? (val >= 0 ? 'N' : 'S') : (val >= 0 ? 'E' : 'W');
    return `${Math.abs(val).toFixed(4)}° ${dir}`;
  };

  return (
    <div className="absolute bottom-0 left-0 w-full p-3 sm:p-6 z-30 flex flex-col gap-2 sm:gap-4">
      <div className="flex flex-col md:flex-row gap-4 items-end justify-between">
        <div className="flex-1 max-w-2xl flex flex-col gap-1 sm:gap-2">
          <div className="text-[9px] sm:text-[11px] font-mono text-white/50 tracking-[0.2em] uppercase pl-1 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
            {t.LIVE_CAMERA_FEED}
          </div>
 
          <div className="bg-black/50 backdrop-blur-xl border border-white/10 rounded-2xl p-3.5 sm:p-5 shadow-2xl">
            <div className="flex items-start justify-between mb-2 sm:mb-4 gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-white/60 text-[10px] sm:text-xs font-mono uppercase tracking-widest mb-1">
                  <Radio size={12} className="text-red-500 animate-pulse shrink-0" />
                  <span className="truncate">ORBITAL TARGET</span>
                </div>
                <h2 className="text-xl sm:text-3xl font-light text-white tracking-wide flex items-start sm:items-center gap-2 sm:gap-3">
                  <MapPin className="text-blue-400 shrink-0 mt-1 sm:mt-0" size={18} />
                  <span className="break-words whitespace-normal leading-tight">
                    {location?.name === 'Oceania / Uncharted' ? (t as any).LOC_UNCHARTED : 
                     (location?.name === 'Unknown Location' || location?.name === 'Unknown' ? (t as any).LOC_UNKNOWN : 
                     (location?.name || t.CALIBRATING))}
                  </span>
                </h2>
                <p className="text-white/60 text-[10px] sm:text-sm mt-1.5 sm:mt-1 ml-7 sm:ml-9 break-words whitespace-normal leading-relaxed">
                  {location?.country === 'International Waters' ? (t as any).LOC_INTL_WATERS : 
                   (location?.country === 'Unknown Country' || location?.country === 'Unknown' ? (t as any).LOC_UNKNOWN : location?.country)} 
                  {location?.region ? ` • ${location.region === 'Ocean' ? (t as any).LOC_OCEAN : location.region}` : ''}
                </p>
              </div>
 
              {weather && (
                <div className="text-right flex flex-col items-end shrink-0 ml-2">
                  <div className="flex items-center gap-1.5 sm:gap-2 text-lg sm:text-2xl font-light text-white">
                    {weather.temperature}°C
                    {weather.isDay ? <Sun className="text-yellow-400 shrink-0" size={18} /> : <Moon className="text-blue-200 shrink-0" size={18} />}
                  </div>
                  <div className="text-white/60 text-xs sm:text-sm flex items-center gap-1 mt-0.5">
                    <Cloud size={12} />
                    {(t as any)[`WEATHER_${weather.condition.toUpperCase()}`] || weather.condition}
                  </div>
                </div>
              )}
            </div>
 
            <div className="grid grid-cols-3 gap-2 sm:gap-4 pt-2.5 sm:pt-4 border-t border-white/10">
              <div>
                <div className="text-white/40 text-[8px] sm:text-[10px] font-mono uppercase tracking-wider mb-0.5">{t.LATITUDE}</div>
                <div className="text-white font-mono text-xs sm:text-sm truncate">{formatCoord(iss.latitude, true)}</div>
              </div>
              <div>
                <div className="text-white/40 text-[8px] sm:text-[10px] font-mono uppercase tracking-wider mb-0.5">{t.LONGITUDE}</div>
                <div className="text-white font-mono text-xs sm:text-sm truncate">{formatCoord(iss.longitude, false)}</div>
              </div>
              <div>
                <div className="text-white/40 text-[8px] sm:text-[10px] font-mono uppercase tracking-wider mb-0.5">{t.ALT_VELOCITY}</div>
                <div className="text-white font-mono text-xs sm:text-sm flex items-center gap-1 truncate">
                  <Navigation size={10} className="text-green-400 shrink-0" />
                  <span>{Math.round(iss.altitude)}km / {Math.round(iss.velocity)}km/h</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="hidden sm:flex bg-black/50 backdrop-blur-xl border border-white/10 rounded-2xl p-4 w-full md:w-[540px] h-36 flex-col shadow-2xl overflow-hidden relative">
          <style>{`
             @keyframes fact-fade-cycle {
               0% { opacity: 0; transform: translateY(8px); filter: blur(2px); }
               8% { opacity: 1; transform: translateY(0); filter: blur(0); }
               92% { opacity: 1; transform: translateY(0); filter: blur(0); }
               100% { opacity: 0; transform: translateY(-8px); filter: blur(2px); }
             }
             .animate-fact-cycle { animation: fact-fade-cycle 8s cubic-bezier(0.25, 1, 0.5, 1) forwards; }
           `}</style>

          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="text-white/40 text-[10px] sm:text-xs font-mono uppercase tracking-wider flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse"></div>
              SPACE INTELLIGENCE
            </div>
            {currentFact && (
              <div className="text-[8px] sm:text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400/80 border border-cyan-500/20">
                {({
                  iss: t.CAT_ISS,
                  solar_system: t.CAT_SOLAR_SYSTEM,
                  earth_observation: t.CAT_EARTH,
                  space_history: t.CAT_HISTORY,
                  astronomy: t.CAT_DEEP_SPACE,
                  astronaut_life: t.CAT_CREW_LIFE,
                  space_tech: t.CAT_TECH
                }[currentFact.category] || categoryLabels[currentFact.category] || currentFact.category)}
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col justify-center pr-2">
            {currentFact ? (
              <div key={`${currentFact.id}-${activeFactIndex}`} className="animate-fact-cycle">
                <div className="text-white/95 text-xs sm:text-sm leading-relaxed border-l-2 border-cyan-500/50 pl-3.5 py-0.5">
                  <span className="mr-1.5">{currentFact.icon}</span>
                  <span className="text-cyan-400 font-semibold">{lang === 'ko' && currentFact.title ? currentFact.title : currentFact.title_en}</span>
                  <span className="text-white/40 mx-1.5">—</span>
                  <span>{lang === 'ko' && currentFact.text ? currentFact.text : currentFact.text_en}</span>
                </div>
                <div className="text-white/25 text-[9px] sm:text-[10px] font-mono mt-2 pl-5 tracking-wider">
                  {t.SOURCE} {currentFact.source}
                </div>
              </div>
            ) : (
              <div className="text-white/30 text-xs sm:text-sm italic animate-pulse font-mono">
                {t.SYNCING_FEED}
              </div>
            )}
          </div>

          {activeFacts.length > 1 && (
            <div className="absolute bottom-3 right-4 flex gap-1.5">
              {activeFacts.map((_, idx) => (
                <div
                  key={idx}
                  className={`w-1 h-1 rounded-full transition-all duration-300 ${idx === activeFactIndex ? 'bg-cyan-400 w-2.5' : 'bg-white/20'}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      
      <div className="w-full flex justify-end mt-1 sm:mt-2 px-1">
        <Link href={`/${lang || 'en'}/privacy`} className="text-white/30 hover:text-white/60 text-[8px] sm:text-[9px] font-mono uppercase tracking-widest transition-colors drop-shadow-md">
          {t.PRIVACY_POLICY}
        </Link>
      </div>
    </div>
  );
};

export default InfoOverlay;
