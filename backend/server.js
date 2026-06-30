/**
 * Lofi Space Station — Backend Server
 * 
 * 기능:
 * 1. NASA ISS 라이브 스트림 화면 상태 분석 (LOS/BLACK/NORMAL)
 * 2. WebSocket을 통해 프론트엔드에 실시간 상태 푸시
 * 3. ISS 위치 API 프록시 및 캐싱 (선택적 확장용)
 */
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// CORS 허용 설정 (허용된 도메인 화이트리스트 제한으로 보안 강화)
const ALLOWED_ORIGINS = [
  'https://space.raondr.com',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// 다운로드받은 Lofi 음악 폴더를 206 Partial Content 스트리밍으로 제공 (브라우저 Range Request 호환)
app.get('/music/:filename', (req, res) => {
  const filePath = path.join(__dirname, 'media/music', req.params.filename);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }

  const stat = fs.statSync(filePath);
  const totalSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    let start = parseInt(parts[0], 10);
    let end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

    // NaN 방어 조치
    if (isNaN(start)) start = 0;
    if (isNaN(end)) end = totalSize - 1;

    // 만약 범위를 넘어가는 비정상 요청이거나 시작이 끝보다 크면 416 리턴
    if (start >= totalSize || end >= totalSize || start > end) {
      res.writeHead(416, {
        'Content-Range': `bytes */${totalSize}`
      });
      return res.end();
    }

    const chunksize = (end - start) + 1;
    const fileStream = fs.createReadStream(filePath, { start, end });
    
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${totalSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'audio/mpeg'
    });
    
    fileStream.pipe(res);
  } else {
    // Range 헤더가 없으면 파일 전체 전송
    res.writeHead(200, {
      'Content-Length': totalSize,
      'Content-Type': 'audio/mpeg'
    });
    fs.createReadStream(filePath).pipe(res);
  }
});

// 프론트엔드용 음악 재생 목록 조회 API (0바이트/손상 파일 자가 삭제 및 자가 복구)
app.get('/api/music-list', (req, res) => {
  const musicDir = path.join(__dirname, 'media/music');
  if (!fs.existsSync(musicDir)) {
    return res.json([]);
  }
  const files = fs.readdirSync(musicDir)
    .filter(f => f.endsWith('.mp3'))
    .filter(f => {
      try {
        const filePath = path.join(musicDir, f);
        const stats = fs.statSync(filePath);
        if (stats.size < 100000) {
          fs.unlinkSync(filePath);
          console.warn(`[Self-Healing] Deleted corrupted empty track: ${f} (${stats.size} bytes)`);
          return false;
        }
        return true;
      } catch (e) {
        return false;
      }
    });

  res.json(files);
});

// 프론트엔드용 NASA WebP 이미지 리스트 조회 API
app.get('/api/nasa-images', (req, res) => {
  const nasaDir = path.resolve(__dirname, '../frontend/public/assets/nasa');
  if (!fs.existsSync(nasaDir)) {
    return res.json([]);
  }
  // .webp 확장자 파일들만 필터링하여 수집
  const files = fs.readdirSync(nasaDir)
    .filter(f => f.endsWith('.webp'))
    .sort((a, b) => {
      // 숫자 순 정렬을 시도하여 슬라이드쇼 순서 안정화
      const numA = parseInt(a.replace(/[^0-9]/g, ''), 10) || 0;
      const numB = parseInt(b.replace(/[^0-9]/g, ''), 10) || 0;
      return numA - numB;
    });
  res.json(files);
});

const PORT = process?.env?.API_BACKEND_PORT || 5000;
const API_BACKEND_HOST = process?.env?.API_BACKEND_HOST || '127.0.0.1';

// --- Health Check 엔드포인트 ---
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    streamStatus: analyzer.getStatus(),
    uptime: process.uptime(),
  });
});

// --- HTTP 서버 기동 ---
const server = app.listen(PORT, API_BACKEND_HOST, () => {
  console.log(`[Server] Lofi Space Station Backend listening at http://${API_BACKEND_HOST}:${PORT}`);
});

// --- WebSocket 서버: 스트림 상태 브로드캐스트 ---
const wss = new WebSocketServer({ server, path: '/ws/stream-status' });

const connectedClients = new Set();

wss.on('connection', (ws) => {
  console.log(`[WS] Client connected. Total: ${connectedClients.size + 1}`);
  connectedClients.add(ws);

  // 연결 즉시 현재 더미 상태 전송 (웹 전용 로컬 모드)
  const currentStatus = { status: 'OFFLINE', streamUrl: null, stats: null, timestamp: Date.now() };
  ws.send(JSON.stringify(currentStatus));

  ws.on('close', () => {
    connectedClients.delete(ws);
    console.log(`[WS] Client disconnected. Total: ${connectedClients.size}`);
  });

  ws.on('error', (err) => {
    console.error('[WS] Client error:', err.message);
    connectedClients.delete(ws);
  });
});

function broadcastStatus(statusData) {
  const message = JSON.stringify(statusData);
  for (const client of connectedClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

// --- 스트림 분석기 초기화 (비활성화) ---
// 클라이언트 PC 송출 및 로컬 비디오 전용 사용으로 인해 무거운 외부 스트리밍 추출 로직을 해제합니다.
console.log('[Server] External stream analysis is DISABLED. Running in local fallback mode.');

// --- 프로세스 종료 시 정리 ---
process.on('SIGINT', () => {
  console.log('[Server] Shutting down...');
  wss.close();
  server.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  server.close();
  process.exit(0);
});
