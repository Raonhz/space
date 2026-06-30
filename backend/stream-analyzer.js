/**
 * NASA ISS 라이브 스트림 화면 상태 분석기 (t3.small 최적화)
 * 
 * ffmpeg로 HLS 스트림에서 15초마다 프레임을 캡처하고:
 * 1. 색상 히스토그램으로 BLACK/LOS_BLUE 감지
 * 2. 프레임 유사도 비교로 정적 LOS 안내 화면 감지
 */
import { spawn } from 'child_process';
import sharp from 'sharp';

// 분석 결과 상태 타입
export const StreamStatus = {
  NORMAL: 'NORMAL',       // 정상 영상 (지구, 우주, ISS 등)
  LOS_BLUE: 'LOS_BLUE',  // NASA LOS 파란색 안내 화면
  LOS_STATIC: 'LOS_STATIC', // NASA LOS 회색 안내 화면 (정적 프레임)
  BLACK: 'BLACK',         // 완전 검은 화면 (카메라 전환, 암전)
  ERROR: 'ERROR',         // 스트림 접근 불가
  OFFLINE: 'OFFLINE',     // 분석기 비활성
};


/**
 * YouTube 라이브 스트림에서 yt-dlp로 직접 HLS URL을 추출합니다.
 */
async function extractStreamUrl(videoId) {
  return new Promise((resolve, reject) => {
    // 유튜브 비디오 ID 포맷 유효성 정밀 검증 (커맨드 인젝션 위협 사전 방어)
    const youtubeIdRegex = /^[a-zA-Z0-9_-]{11}$/;
    if (!youtubeIdRegex.test(videoId)) {
      return reject(new Error(`Invalid YouTube Video ID format: ${videoId}`));
    }

    const ytdlp = spawn('yt-dlp', [
      '--get-url',
      '--format', 'worst',  // 최저 화질 = 서버 부하 최소화
      `https://www.youtube.com/watch?v=${videoId}`
    ]);

    let url = '';
    let errMsg = '';

    ytdlp.stdout.on('data', (data) => { url += data.toString().trim(); });
    ytdlp.stderr.on('data', (data) => { errMsg += data.toString(); });

    ytdlp.on('close', (code) => {
      if (code === 0 && url) {
        resolve(url);
      } else {
        reject(new Error(`yt-dlp failed (code ${code}): ${errMsg}`));
      }
    });

    setTimeout(() => {
      ytdlp.kill();
      reject(new Error('yt-dlp timeout'));
    }, 10000);
  });
}

/**
 * ffmpeg로 HLS 스트림에서 단일 프레임을 캡처합니다.
 */
async function captureFrame(streamUrl) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-y',
      '-i', streamUrl,
      '-vframes', '1',
      '-f', 'image2pipe',
      '-vcodec', 'mjpeg',
      '-q:v', '8',            // 품질 낮춤 (서버 부하 최소화)
      '-loglevel', 'error',
      'pipe:1'
    ]);

    const chunks = [];
    let errMsg = '';

    ffmpeg.stdout.on('data', (data) => chunks.push(data));
    ffmpeg.stderr.on('data', (data) => { errMsg += data.toString(); });

    const timer = setTimeout(() => {
      ffmpeg.kill();
      reject(new Error('ffmpeg frame capture timeout'));
    }, 8000);

    ffmpeg.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    ffmpeg.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0 && chunks.length > 0) {
        resolve(Buffer.concat(chunks));
      } else {
        reject(new Error(`ffmpeg failed (code ${code}): ${errMsg}`));
      }
    });
  });
}

/**
 * 프레임을 160×90 그레이스케일로 축소하여 해시(fingerprint)를 생성합니다.
 * 프레임 유사도 비교에 사용됩니다.
 */
async function getFrameFingerprint(frameBuffer) {
  const { data } = await sharp(frameBuffer)
    .resize(160, 90)
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return data;
}

/**
 * 두 프레임 fingerprint의 유사도를 계산합니다 (0.0 ~ 1.0).
 * 1.0 = 완전 동일, 0.0 = 완전 다름
 */
function compareFingerprints(fp1, fp2) {
  if (!fp1 || !fp2 || fp1.length !== fp2.length) return 0;

  let totalDiff = 0;
  const len = fp1.length;

  // 샘플링: 전체 픽셀의 25%만 비교 (CPU 절약)
  const step = 4;
  let compared = 0;

  for (let i = 0; i < len; i += step) {
    totalDiff += Math.abs(fp1[i] - fp2[i]);
    compared++;
  }

  const avgDiff = totalDiff / compared;
  // avgDiff 범위: 0~255, 정규화하여 유사도로 변환
  return 1 - (avgDiff / 255);
}

/**
 * 캡처된 프레임의 색상 히스토그램을 분석하여 화면 상태를 판별합니다.
 */
async function analyzeFrame(frameBuffer) {
  const { data, info } = await sharp(frameBuffer)
    .resize(160, 90)  // 더 작은 해상도로 분석 (CPU 절약)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const totalPixels = info.width * info.height;
  let darkPixels = 0;
  let bluePixels = 0;
  let totalBrightness = 0;

  for (let i = 0; i < data.length; i += 3) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const avg = (r + g + b) / 3;
    totalBrightness += avg;

    if (avg < 15) {
      darkPixels++;
    }

    if (b > 80 && b > r * 1.8 && b > g * 1.3 && avg > 30 && avg < 120) {
      bluePixels++;
    }
  }

  const darkRatio = darkPixels / totalPixels;
  const blueRatio = bluePixels / totalPixels;
  const avgBrightness = totalBrightness / totalPixels;

  const stats = {
    darkRatio: Math.round(darkRatio * 100),
    blueRatio: Math.round(blueRatio * 100),
    avgBrightness: Math.round(avgBrightness),
  };

  if (darkRatio > 0.90) {
    return { status: StreamStatus.BLACK, confidence: darkRatio, stats };
  }
  if (blueRatio > 0.50) {
    const confidence = Math.min(blueRatio / 0.70, 1.0);
    return { status: StreamStatus.LOS_BLUE, confidence, stats };
  }

  return { status: StreamStatus.NORMAL, confidence: 1 - Math.max(darkRatio, blueRatio), stats };
}

/**
 * 스트림 분석기 클래스 (t3.small 최적화)
 */
export class StreamAnalyzer {
  constructor({ videoIds = ['FuuC4dpSQ1M', 'uwXgcTc8oY8'], intervalMs = 15000, onStatusChange } = {}) {
    this.videoIds = videoIds;
    this.intervalMs = intervalMs;
    this.onStatusChange = onStatusChange || (() => { });
    this.currentStatus = StreamStatus.OFFLINE;
    this.currentVideoIdx = 0;
    this.streamUrl = null;
    this.urlRefreshTimer = null;
    this.analyzeTimer = null;
    this.running = false;
    this.consecutiveErrors = 0;
    this.lastStats = null;

    // 프레임 유사도 감지용
    this.prevFingerprint = null;
    this.staticFrameCount = 0;         // 연속 유사 프레임 수
    this.staticThreshold = 0.992;      // 유사도 99.2% 이상이어야만 진짜 안내문 정지 화면으로 간주
    this.staticCountForLOS = 3;        // 연속 3회(약 45초) 정적이면 LOS 판정
  }

  async start() {
    if (this.running) return;
    this.running = true;
    console.log(`[StreamAnalyzer] Starting HLS Hybrid mode (interval: ${this.intervalMs}ms, t3.small optimized)`);

    await this.refreshStreamUrl();
    this.runAnalysisLoop();

    // 30분마다 구글 CDN HLS URL 강제 갱신 (주소 만료 방지)
    this.urlRefreshTimer = setInterval(() => this.refreshStreamUrl(), 30 * 60 * 1000);
  }

  stop() {
    this.running = false;
    if (this.analyzeTimer) clearTimeout(this.analyzeTimer);
    if (this.urlRefreshTimer) clearInterval(this.urlRefreshTimer);
    this.updateStatus(StreamStatus.OFFLINE);
    console.log('[StreamAnalyzer] Stopped.');
  }

  async refreshStreamUrl() {
    if (this.videoIds.length === 0) {
      this.streamUrl = null;
      return;
    }
    const videoId = this.videoIds[this.currentVideoIdx];
    try {
      console.log(`[StreamAnalyzer] Extracting Google HLS URL for ${videoId}...`);
      this.streamUrl = await extractStreamUrl(videoId);
      console.log(`[StreamAnalyzer] Google HLS URL obtained.`);
      this.consecutiveErrors = 0;

      // 스트림 URL 갱신 시 상태 변경 통지 (HLS 주소 동적 갱신 전송용)
      this.updateStatus(this.currentStatus);
    } catch (err) {
      console.error(`[StreamAnalyzer] URL extraction failed:`, err.message);
      this.currentVideoIdx = (this.currentVideoIdx + 1) % this.videoIds.length;
      this.streamUrl = null;
    }
  }

  async runAnalysisLoop() {
    if (!this.running) return;

    try {
      if (!this.streamUrl) {
        await this.refreshStreamUrl();
        if (!this.streamUrl) {
          this.updateStatus(StreamStatus.ERROR);
          this.consecutiveErrors++;
        }
      }

      if (this.streamUrl) {
        const frameBuffer = await captureFrame(this.streamUrl);

        // 1단계: 색상 히스토그램 분석 (BLACK, LOS_BLUE)
        const colorResult = await analyzeFrame(frameBuffer);
        this.lastStats = colorResult.stats;

        if (colorResult.status !== StreamStatus.NORMAL) {
          // BLACK 또는 LOS_BLUE가 감지되면 즉시 판정
          this.staticFrameCount = 0;
          this.updateStatus(colorResult.status);
        } else {
          // 2단계: 프레임 유사도 분석 (정적 LOS 안내 화면)
          const fingerprint = await getFrameFingerprint(frameBuffer);
          const similarity = compareFingerprints(this.prevFingerprint, fingerprint);
          this.prevFingerprint = fingerprint;

          this.lastStats.similarity = Math.round(similarity * 100);

          if (similarity >= this.staticThreshold) {
            this.staticFrameCount++;
            console.log(`[StreamAnalyzer] Static frame detected (${this.staticFrameCount}/${this.staticCountForLOS}, similarity: ${(similarity * 100).toFixed(1)}%)`);

            if (this.staticFrameCount >= this.staticCountForLOS) {
              this.updateStatus(StreamStatus.LOS_STATIC);
            }
          } else {
            // 프레임이 변화하고 있음 → 정상 영상
            this.staticFrameCount = 0;
            this.updateStatus(StreamStatus.NORMAL);
          }
        }

        this.consecutiveErrors = 0;
      }
    } catch (err) {
      console.error('[StreamAnalyzer] Analysis cycle failed:', err.message);
      this.consecutiveErrors++;

      if (this.consecutiveErrors >= 3) {
        console.log('[StreamAnalyzer] Too many errors, switching to backup video ID...');
        this.currentVideoIdx = (this.currentVideoIdx + 1) % this.videoIds.length;
        this.streamUrl = null;
        this.consecutiveErrors = 0;
      }
    }

    // 다음 분석 예약
    const delay = this.consecutiveErrors > 0
      ? Math.min(this.intervalMs * (1 + this.consecutiveErrors), 60000)
      : this.intervalMs;

    this.analyzeTimer = setTimeout(() => this.runAnalysisLoop(), delay);
  }

  updateStatus(newStatus) {
    this.currentStatus = newStatus;
    this.onStatusChange({
      status: newStatus,
      streamUrl: this.streamUrl,
      videoId: this.videoIds[this.currentVideoIdx],
      stats: this.lastStats,
      timestamp: Date.now(),
    });
  }

  getStatus() {
    return {
      status: this.currentStatus,
      streamUrl: this.streamUrl,
      videoId: this.videoIds[this.currentVideoIdx],
      stats: this.lastStats,
      timestamp: Date.now(),
    };
  }
}
