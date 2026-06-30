/**
 * Lofi Space Station — 유튜브 라이브 스트리밍 송출기 (Canvas Overlay + 배경 자동 전환)
 * 
 * 최적화 대상: GCP e2-small (2 vCPU, 2GB RAM)
 * 
 * 동작 원리:
 *   1. stream-analyzer.js의 상태에 따라 배경 소스를 자동 전환 (NASA 정상 → mp4 / LOS → 이미지 슬라이드쇼)
 *   2. Node.js Canvas로 ISS 좌표, 곡 정보, 상태 표시 등을 세련되게 렌더링한 오버레이 PNG를 주기적 생성
 *   3. FFmpeg가 배경 위에 오버레이 PNG를 합성하여 유튜브 RTMP로 24시간 실시간 송출
 *   4. 크롬 브라우저 없이 구동되므로 CPU/RAM 부담이 극히 적음
 */
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });
import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createCanvas, registerFont } from 'canvas';
import https from 'https';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── 설정 ──────────────────────────────────────────
const STREAM_KEY = process.env.YOUTUBE_STREAM_KEY;
const RTMP_URL = `rtmp://a.rtmp.youtube.com/live2/${STREAM_KEY}`;
const VIDEO_PATH = process.env.STREAM_VIDEO_PATH || path.join(__dirname, 'media/SpaceStation.mp4');
const NASA_IMG_DIR = path.resolve(__dirname, '../frontend/public/assets/nasa');
const OVERLAY_PATH = path.join(__dirname, 'media/overlay.png');
const OVERLAY_WIDTH = 1280;
const OVERLAY_HEIGHT = 720;
const FPS = 12;
const BITRATE = '2000k';

// ─── 상태 변수 ──────────────────────────────────────
let currentStreamStatus = 'OFFLINE'; // NORMAL, LOS_BLUE, LOS_STATIC, BLACK, ERROR, OFFLINE
let issData = null;      // { latitude, longitude, altitude, velocity, visibility }
let locationData = null;  // { name, country, region, isOcean }
let weatherData = null;   // { temperature, condition, isDay }
let currentSong = null;   // { title, filename }
let ffmpegProcess = null;
let isStopping = false;
let currentBgMode = 'video'; // 'video' or 'slideshow'
let slideShowIndex = 0;
let nasaImages = [];

// ─── NASA 이미지 로드 ──────────────────────────────
function loadNasaImages() {
  if (!fs.existsSync(NASA_IMG_DIR)) return;
  nasaImages = fs.readdirSync(NASA_IMG_DIR)
    .filter(f => f.endsWith('.webp') || f.endsWith('.jpg'))
    .sort(() => Math.random() - 0.5); // 랜덤 셔플
  console.log(`[Overlay] Loaded ${nasaImages.length} NASA background images`);
}

// ─── ISS 데이터 수집 (서버 API에서 직접 fetch) ──────
async function fetchTelemetry() {
  try {
    // ISS 위치 (Open Notify API 직접 호출)
    const issResponse = await fetchJSON('http://api.open-notify.org/iss-now.json');
    if (issResponse && issResponse.iss_position) {
      const lat = parseFloat(issResponse.iss_position.latitude);
      const lon = parseFloat(issResponse.iss_position.longitude);
      issData = {
        latitude: lat,
        longitude: lon,
        altitude: 408, // ISS 평균 고도
        velocity: 27580, // ISS 평균 속도
      };
    }
  } catch (err) {
    console.error('[Telemetry] ISS fetch error:', err.message);
  }

  // 곡 정보 (로컬 음악 파일 목록에서 현재 곡 추정)
  try {
    const musicDir = path.join(__dirname, 'media/music');
    if (fs.existsSync(musicDir)) {
      const tracks = fs.readdirSync(musicDir).filter(f => f.endsWith('.mp3'));
      if (tracks.length > 0) {
        const idx = Math.floor(Date.now() / (3 * 60 * 1000)) % tracks.length; // 3분마다 순환
        const filename = tracks[idx];
        currentSong = {
          title: filename.replace('.mp3', '').replace(/_/g, ' '),
          filename,
        };
      }
    }
  } catch (err) {
    // 무시
  }
}

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, { timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

// ─── 스트림 분석 상태 수신 (로컬 WebSocket) ─────────
function connectToAnalyzer() {
  try {
    const WebSocket = (await import('ws')).default;
    const host = process.env.API_BACKEND_HOST || '127.0.0.1';
    const port = process.env.API_BACKEND_PORT || 5001;
    const ws = new WebSocket(`ws://${host}:${port}/ws/stream-status`);
    
    ws.on('open', () => {
      console.log('[Overlay] Connected to stream analyzer via WebSocket');
    });
    
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.status) {
          const prevStatus = currentStreamStatus;
          currentStreamStatus = msg.status;
          
          if (prevStatus !== msg.status) {
            console.log(`[Overlay] Stream status changed: ${prevStatus} → ${msg.status}`);
            handleStatusChange(msg.status);
          }
        }
      } catch (e) { /* ignore */ }
    });
    
    ws.on('close', () => {
      console.log('[Overlay] WebSocket disconnected, reconnecting in 5s...');
      setTimeout(connectToAnalyzer, 5000);
    });
    
    ws.on('error', () => {
      ws.close();
    });
  } catch (err) {
    console.error('[Overlay] WebSocket connection error:', err.message);
    setTimeout(connectToAnalyzer, 5000);
  }
}

// Dynamic import를 위한 async wrapper
async function startAnalyzerConnection() {
  const { default: WebSocket } = await import('ws');
  
  function connect() {
    const host = process.env.API_BACKEND_HOST || '127.0.0.1';
    const port = process.env.API_BACKEND_PORT || 5001;
    const ws = new WebSocket(`ws://${host}:${port}/ws/stream-status`);
    
    ws.on('open', () => {
      console.log('[Overlay] Connected to stream analyzer via WebSocket');
    });
    
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.status) {
          const prevStatus = currentStreamStatus;
          currentStreamStatus = msg.status;
          
          if (prevStatus !== msg.status) {
            console.log(`[Overlay] Stream status: ${prevStatus} → ${msg.status}`);
            handleStatusChange(msg.status);
          }
        }
      } catch (e) { /* ignore */ }
    });
    
    ws.on('close', () => {
      console.log('[Overlay] Analyzer disconnected, reconnecting in 5s...');
      setTimeout(connect, 5000);
    });
    
    ws.on('error', () => { ws.close(); });
  }
  
  connect();
}

// ─── 상태 변경 시 배경 소스 전환 ─────────────────────
function handleStatusChange(status) {
  const wasVideo = currentBgMode;
  
  if (status === 'NORMAL') {
    currentBgMode = 'video'; // NASA 정상 → 우주 영상 배경
  } else {
    currentBgMode = 'slideshow'; // LOS/BLACK/ERROR → NASA 이미지 슬라이드쇼
  }
  
  if (wasVideo !== currentBgMode) {
    console.log(`[Overlay] Background mode: ${wasVideo} → ${currentBgMode}`);
    // FFmpeg 재시작하여 입력 소스 전환
    restartFFmpeg();
  }
}

// ─── Canvas 오버레이 렌더링 ──────────────────────────
function renderOverlay() {
  const canvas = createCanvas(OVERLAY_WIDTH, OVERLAY_HEIGHT);
  const ctx = canvas.getContext('2d');
  
  // 투명 배경
  ctx.clearRect(0, 0, OVERLAY_WIDTH, OVERLAY_HEIGHT);
  
  // ─── 상단 좌측: ORBITAL LOFI 로고 + LIVE 뱃지 ───
  const headerY = 32;
  const headerX = 32;
  
  // LIVE 도트 (빨간 원)
  ctx.beginPath();
  ctx.arc(headerX + 16, headerY + 14, 6, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
  ctx.fill();
  // 도트 주위 글로우
  ctx.beginPath();
  ctx.arc(headerX + 16, headerY + 14, 12, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
  ctx.fill();
  
  // ORBITAL LOFI 타이틀
  ctx.font = 'bold 14px "Arial", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.letterSpacing = '3px';
  ctx.fillText('ORBITAL LOFI', headerX + 36, headerY + 12);
  
  // LIVE 뱃지
  ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
  roundRect(ctx, headerX + 155, headerY + 2, 34, 16, 3);
  ctx.fill();
  ctx.font = 'bold 8px "Arial", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('LIVE', headerX + 161, headerY + 13);
  
  // ISS ORBITAL FEED 서브타이틀
  ctx.font = '9px "Courier New", monospace';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillText('ISS ORBITAL FEED', headerX + 36, headerY + 28);
  
  // ─── 상단: 상태 표시 배너 ───
  if (currentStreamStatus !== 'NORMAL' && currentStreamStatus !== 'OFFLINE') {
    const statusLabels = {
      'LOS_BLUE': '📡 LOS (Loss of Signal)',
      'LOS_STATIC': '📡 LOS (Static Screen)',
      'BLACK': '🌙 Camera Transition',
      'ERROR': '⚠️ Uplink Lost',
    };
    const statusDescs = {
      'LOS_BLUE': 'NASA feed is displaying a Loss of Signal screen. Showing archived orbital views.',
      'LOS_STATIC': 'NASA feed is showing a static announcement. Showing archived orbital views.',
      'BLACK': 'Live camera feed is in a dark transition. Displaying archived orbital views.',
      'ERROR': 'Live telemetry uplink lost. Switched to archival orbital loop.',
    };
    
    const label = statusLabels[currentStreamStatus] || currentStreamStatus;
    const desc = statusDescs[currentStreamStatus] || '';
    
    // 배너 배경
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    roundRect(ctx, headerX, headerY + 50, 340, 52, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.3)';
    ctx.lineWidth = 1;
    roundRect(ctx, headerX, headerY + 50, 340, 52, 12);
    ctx.stroke();
    
    // 상태 도트
    ctx.beginPath();
    ctx.arc(headerX + 14, headerY + 67, 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(245, 158, 11, 0.9)';
    ctx.fill();
    
    // 상태 레이블
    ctx.font = 'bold 9px "Arial", sans-serif';
    ctx.fillStyle = 'rgba(245, 158, 11, 0.95)';
    ctx.fillText(label, headerX + 26, headerY + 70);
    
    // 상태 설명
    ctx.font = '9px "Arial", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    const wrappedDesc = wrapText(desc, 42);
    wrappedDesc.forEach((line, i) => {
      ctx.fillText(line, headerX + 26, headerY + 84 + i * 12);
    });
  }
  
  // ─── 하단 좌측: 위치 & 텔레메트리 카드 ───
  const cardX = 24;
  const cardY = OVERLAY_HEIGHT - 220;
  const cardW = 520;
  const cardH = 195;
  
  // 카드 배경 (반투명 어두운 패널)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  roundRect(ctx, cardX, cardY, cardW, cardH, 16);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  roundRect(ctx, cardX, cardY, cardW, cardH, 16);
  ctx.stroke();
  
  // ISS LIVE EXTERNAL CAMERA FEED 라벨
  ctx.beginPath();
  ctx.arc(cardX + 14, cardY - 8, 3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(74, 222, 128, 0.8)';
  ctx.fill();
  ctx.font = '9px "Courier New", monospace';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.fillText('ISS LIVE EXTERNAL CAMERA FEED', cardX + 24, cardY - 4);
  
  // ORBITAL TARGET 헤더
  ctx.font = '9px "Courier New", monospace';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.fillText('◉ ORBITAL TARGET', cardX + 16, cardY + 24);
  
  // 위치명 (대형 텍스트)
  const locName = locationData?.name || issData ? 'Over the Ocean' : 'CALIBRATING...';
  ctx.font = '24px "Arial", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.fillText(`📍 ${locName}`, cardX + 16, cardY + 56);
  
  // 국가/지역
  if (locationData) {
    const subLoc = [locationData.country, locationData.region].filter(Boolean).join(' • ');
    ctx.font = '12px "Arial", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillText(subLoc, cardX + 44, cardY + 74);
  }
  
  // 날씨 정보 (오른쪽 상단)
  if (weatherData) {
    const weatherX = cardX + cardW - 110;
    ctx.font = '22px "Arial", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillText(`${weatherData.temperature}°C`, weatherX, cardY + 40);
    const weatherIcon = weatherData.isDay ? '☀️' : '🌙';
    ctx.fillText(weatherIcon, weatherX + 70, cardY + 40);
    
    ctx.font = '11px "Arial", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillText(`☁️ ${weatherData.condition || ''}`, weatherX, cardY + 58);
  }
  
  // 구분선
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cardX + 16, cardY + 90);
  ctx.lineTo(cardX + cardW - 16, cardY + 90);
  ctx.stroke();
  
  // 텔레메트리 그리드 (LATITUDE / LONGITUDE / ALTITUDE)
  if (issData) {
    const gridY = cardY + 110;
    const colW = (cardW - 32) / 3;
    
    // LATITUDE
    ctx.font = '8px "Courier New", monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillText('LATITUDE', cardX + 16, gridY);
    ctx.font = '13px "Courier New", monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillText(formatCoord(issData.latitude, true), cardX + 16, gridY + 18);
    
    // LONGITUDE
    ctx.font = '8px "Courier New", monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillText('LONGITUDE', cardX + 16 + colW, gridY);
    ctx.font = '13px "Courier New", monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillText(formatCoord(issData.longitude, false), cardX + 16 + colW, gridY + 18);
    
    // ALTITUDE / VELOCITY
    ctx.font = '8px "Courier New", monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillText('ALTITUDE / VELOCITY', cardX + 16 + colW * 2, gridY);
    ctx.font = '13px "Courier New", monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillText(`▲ ${issData.altitude}km / ${Math.round(issData.velocity)}km/h`, cardX + 16 + colW * 2, gridY + 18);
  }
  
  // 서버 분석기 상태 인디케이터
  const analyzerY = cardY + 160;
  ctx.beginPath();
  ctx.arc(cardX + 20, analyzerY, 3, 0, Math.PI * 2);
  ctx.fillStyle = currentStreamStatus !== 'OFFLINE' 
    ? 'rgba(74, 222, 128, 0.7)' 
    : 'rgba(255, 255, 255, 0.2)';
  ctx.fill();
  ctx.font = '8px "Courier New", monospace';
  ctx.fillStyle = currentStreamStatus !== 'OFFLINE'
    ? 'rgba(74, 222, 128, 0.6)'
    : 'rgba(255, 255, 255, 0.25)';
  ctx.fillText(
    currentStreamStatus !== 'OFFLINE' ? 'STREAM ANALYSIS ACTIVE' : 'ANALYZER OFFLINE',
    cardX + 30, analyzerY + 3
  );
  
  // ─── 하단 우측: 재생 중인 곡 정보 ───
  if (currentSong) {
    const songCardX = cardX + cardW + 16;
    const songCardW = OVERLAY_WIDTH - songCardX - 24;
    const songCardY = OVERLAY_HEIGHT - 80;
    const songCardH = 56;
    
    // 곡 카드 배경
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    roundRect(ctx, songCardX, songCardY, songCardW, songCardH, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    roundRect(ctx, songCardX, songCardY, songCardW, songCardH, 12);
    ctx.stroke();
    
    // 🎵 Now Playing
    ctx.font = '8px "Courier New", monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillText('♫ NOW PLAYING', songCardX + 14, songCardY + 18);
    
    // 곡 제목
    ctx.font = '12px "Arial", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    const songTitle = currentSong.title.length > 40 
      ? currentSong.title.substring(0, 40) + '...' 
      : currentSong.title;
    ctx.fillText(songTitle, songCardX + 14, songCardY + 38);
  }
  
  // ─── 상단 우측: 시계 ───
  const now = new Date();
  const timeStr = now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  ctx.font = '10px "Courier New", monospace';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.textAlign = 'right';
  ctx.fillText(timeStr, OVERLAY_WIDTH - 32, 40);
  ctx.textAlign = 'left';
  
  // ─── 하단 그라데이션 (텍스트 가독성) ───
  const gradient = ctx.createLinearGradient(0, OVERLAY_HEIGHT - 280, 0, OVERLAY_HEIGHT);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.3)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, OVERLAY_HEIGHT - 280, OVERLAY_WIDTH, 280);
  // 카드를 그라데이션 위에 다시 그리지 않도록 순서 조정은 불필요 (이미 위에 그려짐)
  
  // PNG로 저장
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(OVERLAY_PATH, buffer);
}

// ─── 유틸리티 함수 ───────────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function formatCoord(val, isLat) {
  const dir = isLat ? (val >= 0 ? 'N' : 'S') : (val >= 0 ? 'E' : 'W');
  return `${Math.abs(val).toFixed(4)}° ${dir}`;
}

function wrapText(text, maxChars) {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length > maxChars) {
      lines.push(current.trim());
      current = word;
    } else {
      current += ' ' + word;
    }
  }
  if (current.trim()) lines.push(current.trim());
  return lines;
}

// ─── FFmpeg 송출 시작 ────────────────────────────────
function startStreaming() {
  if (!STREAM_KEY) {
    console.error('[StreamOverlay] ✗ YOUTUBE_STREAM_KEY missing in .env.local');
    process.exit(1);
  }
  
  if (!fs.existsSync(VIDEO_PATH)) {
    console.error(`[StreamOverlay] ✗ Video file not found: ${VIDEO_PATH}`);
    process.exit(1);
  }
  
  // 초기 오버레이 생성
  renderOverlay();
  
  console.log(`[StreamOverlay] Starting YouTube live stream`);
  console.log(`[StreamOverlay]   Background: ${path.basename(VIDEO_PATH)}`);
  console.log(`[StreamOverlay]   Overlay: ${OVERLAY_PATH}`);
  console.log(`[StreamOverlay]   Resolution: ${OVERLAY_WIDTH}x${OVERLAY_HEIGHT} @ ${FPS}fps`);
  
  const ffmpegArgs = [
    // 입력 1: 배경 비디오 (무한 루프)
    '-re',
    '-stream_loop', '-1',
    '-i', VIDEO_PATH,
    // 입력 2: 오버레이 PNG (1초마다 리로드)
    '-loop', '1',
    '-framerate', '1',
    '-i', OVERLAY_PATH,
    // 필터: 오버레이 합성
    '-filter_complex',
    `[0:v]scale=${OVERLAY_WIDTH}:${OVERLAY_HEIGHT}:force_original_aspect_ratio=decrease,pad=${OVERLAY_WIDTH}:${OVERLAY_HEIGHT}:(ow-iw)/2:(oh-ih)/2,fps=${FPS}[bg];[1:v]format=rgba[ovr];[bg][ovr]overlay=0:0:shortest=0[out]`,
    // 출력 설정
    '-map', '[out]',
    '-map', '0:a?',
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-tune', 'zerolatency',
    '-pix_fmt', 'yuv420p',
    '-b:v', BITRATE,
    '-maxrate', BITRATE,
    '-bufsize', '4000k',
    '-g', String(FPS * 2),    // GOP = 2초
    '-keyint_min', String(FPS * 2),
    '-sc_threshold', '0',
    '-threads', '2',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '44100',
    '-f', 'flv',
    RTMP_URL,
  ];
  
  ffmpegProcess = spawn('ffmpeg', ffmpegArgs);
  
  ffmpegProcess.stderr.on('data', (data) => {
    const msg = data.toString();
    if (msg.includes('frame=') || msg.includes('speed=')) {
      const statusLine = msg.split('\r').pop().trim();
      process.stdout.write(`\r[StreamOverlay] ${statusLine}`);
    } else if (msg.includes('Error') || msg.includes('error')) {
      console.error(`\n[FFmpeg] ${msg.trim()}`);
    }
  });
  
  ffmpegProcess.on('close', (code) => {
    console.log(`\n[StreamOverlay] FFmpeg closed (code: ${code})`);
    ffmpegProcess = null;
    
    if (!isStopping) {
      console.log('[StreamOverlay] Reconnecting in 5 seconds...');
      setTimeout(startStreaming, 5000);
    }
  });
  
  ffmpegProcess.on('error', (err) => {
    console.error('[StreamOverlay] FFmpeg error:', err.message);
  });
}

function restartFFmpeg() {
  if (ffmpegProcess) {
    console.log('[StreamOverlay] Restarting FFmpeg for background source switch...');
    ffmpegProcess.kill('SIGINT');
    // close 이벤트에서 자동 재시작됨
  }
}

// ─── 오버레이 주기적 갱신 + 텔레메트리 수집 ──────────
async function updateLoop() {
  while (!isStopping) {
    try {
      await fetchTelemetry();
      renderOverlay();
    } catch (err) {
      console.error('[Overlay] Update error:', err.message);
    }
    // 10초마다 갱신
    await new Promise(resolve => setTimeout(resolve, 10000));
  }
}

// ─── 종료 핸들링 ────────────────────────────────────
function shutdown() {
  isStopping = true;
  if (ffmpegProcess) {
    ffmpegProcess.kill('SIGINT');
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// ─── 메인 기동 ──────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   Lofi Space Station — YouTube Live Stream Overlay      ║');
  console.log('║   Canvas Overlay + Auto Background Switch               ║');
  console.log('║   Optimized for GCP e2-small (2 vCPU, 2GB RAM)         ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  
  loadNasaImages();
  
  // 텔레메트리 초기 수집
  await fetchTelemetry();
  
  // 초기 오버레이 렌더링
  renderOverlay();
  console.log('[Overlay] Initial overlay rendered');
  
  // 스트림 분석기에 WebSocket 연결
  startAnalyzerConnection();
  
  // 오버레이 갱신 루프 시작
  updateLoop();
  
  // FFmpeg 송출 시작
  startStreaming();
}

main().catch(err => {
  console.error('[StreamOverlay] Fatal error:', err);
  process.exit(1);
});
