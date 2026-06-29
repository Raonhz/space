/**
 * Lofi Space Station — YouTube Live Stream Pusher (t3.small/e2-micro 최적화)
 * 
 * 기능:
 * 1. 로컬 비디오 파일을 무한 루프 돌리며 유튜브 RTMP 서버로 스트리밍 송출.
 * 2. 재인코딩이 없는 Stream Copy 방식(-c copy)을 사용하여 CPU 사용량을 2% 미만으로 극소화.
 * 3. 프로세스 비정상 종료 시 자동 재기동 및 복구 로직 내장.
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 유튜브 스트림 키 (운영 시 .env.local 혹은 환경변수에 지정 필수)
const STREAM_KEY = process.env.YOUTUBE_STREAM_KEY;
const YOUTUBE_RTMP_URL = 'rtmp://a.rtmp.youtube.com/live2';

// 송출용 기본 동영상 파일 경로 (개발 및 테스트용)
// 16:9 비율의 비디오 파일 (예: h264 비디오 + aac 오디오 규격 통일 권장)
const DEFAULT_VIDEO_PATH = path.join(__dirname, 'media/live-source.mp4');

let ffmpegProcess = null;
let isStopping = false;

function startStreaming() {
  if (!STREAM_KEY) {
    console.error('[StreamPusher] ✗ YouTube Stream Key (YOUTUBE_STREAM_KEY) is missing in environment!');
    console.error('[StreamPusher]   Please add YOUTUBE_STREAM_KEY="your-key-here" in backend/.env.local');
    process.exit(1);
  }

  const videoPath = process.env.STREAM_VIDEO_PATH || DEFAULT_VIDEO_PATH;

  if (!fs.existsSync(videoPath)) {
    console.error(`[StreamPusher] ✗ Target video source not found at: ${videoPath}`);
    console.error('[StreamPusher]   Please place a 16:9 video file named "live-source.mp4" in backend/media/ directory.');
    process.exit(1);
  }

  console.log(`[StreamPusher] Starting live stream to YouTube using: ${path.basename(videoPath)}`);
  console.log(`[StreamPusher] CPU Mode: Stream Copy (No re-encoding — Ultra Low CPU overhead)`);

  const ffmpegArgs = [
    '-re',                      // 실시간 속도로 프레임 읽기 (필수)
    '-stream_loop', '-1',       // 입력 소스 무한 루프 반복 설정
    '-i', videoPath,            // 입력 소스 파일 경로
    '-c:v', 'copy',             // 비디오 코덱 복사 (재인코딩 제외 -> CPU 소모 Zero화)
    '-c:a', 'copy',             // 오디오 코덱 복사
    '-f', 'flv',                // 유튜브 송출 규격인 FLV 포맷 지정
    `${YOUTUBE_RTMP_URL}/${STREAM_KEY}` // 유튜브 RTMP 전송 목적지 주소
  ];

  ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

  ffmpegProcess.stdout.on('data', (data) => {
    console.log(`[FFmpeg] stdout: ${data}`);
  });

  ffmpegProcess.stderr.on('data', (data) => {
    // FFmpeg는 표준 출력 대신 표준 에러로 상태 정보(frame, fps, size, time, bitrate 등)를 주기적으로 뱉습니다.
    const logMsg = data.toString();
    if (logMsg.includes('frame=') || logMsg.includes('speed=')) {
      // 너무 잦은 출력을 방지하기 위해 한 줄 요약 형태로 로그 남김
      const statusLine = logMsg.split('\r').pop().trim();
      process.stdout.write(`\r[StreamPusher] Status: ${statusLine}`);
    } else {
      console.log(`[FFmpeg] stderr: ${logMsg.trim()}`);
    }
  });

  ffmpegProcess.on('close', (code) => {
    console.log(`\n[StreamPusher] FFmpeg process closed with code ${code}`);
    ffmpegProcess = null;

    if (!isStopping) {
      console.log('[StreamPusher] Reconnecting and restarting stream in 5 seconds...');
      setTimeout(startStreaming, 5000);
    }
  });

  ffmpegProcess.on('error', (err) => {
    console.error('[StreamPusher] FFmpeg execution error:', err.message);
  });
}

function stopStreaming() {
  isStopping = true;
  if (ffmpegProcess) {
    console.log('[StreamPusher] Terminating FFmpeg process...');
    ffmpegProcess.kill('SIGINT');
  }
}

// 프로세스 시그널 핸들링
process.on('SIGINT', () => {
  stopStreaming();
  process.exit(0);
});

process.on('SIGTERM', () => {
  stopStreaming();
  process.exit(0);
});

// 스트리밍 시작
startStreaming();
