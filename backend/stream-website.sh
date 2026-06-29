#!/bin/bash
# ============================================================================
# Lofi Space Station — 웹사이트 화면 유튜브 라이브 송출 스크립트
# 최적화 대상: GCP e2-small (2 vCPU, 2GB RAM)
# 
# 동작 원리:
#   1. Xvfb 가상 디스플레이(720p)를 생성합니다.
#   2. Chromium 브라우저를 극한 메모리 절약 모드로 띄워 웹사이트를 로드합니다.
#   3. FFmpeg가 가상 화면을 캡처하여 유튜브 RTMP로 실시간 송출합니다.
# ============================================================================

set -euo pipefail

# --- 설정 ---
DISPLAY_NUM=":99"
RESOLUTION="1280x720"
FPS="15"
BITRATE="2500k"
SITE_URL="https://space.raondr.com/"

# .env.local에서 스트림 키 로드
ENV_FILE="$(dirname "$0")/.env.local"
if [ -f "$ENV_FILE" ]; then
  export $(grep -v '^#' "$ENV_FILE" | grep 'YOUTUBE_STREAM_KEY' | xargs)
fi

STREAM_KEY="${YOUTUBE_STREAM_KEY:-}"
if [ -z "$STREAM_KEY" ]; then
  echo "[StreamWebsite] ✗ YOUTUBE_STREAM_KEY가 설정되지 않았습니다."
  echo "[StreamWebsite]   .env.local 파일에 YOUTUBE_STREAM_KEY를 추가해 주세요."
  exit 1
fi

RTMP_URL="rtmp://a.rtmp.youtube.com/live2/${STREAM_KEY}"

# --- 정리 함수 (종료 시 모든 프로세스 정리) ---
cleanup() {
  echo ""
  echo "[StreamWebsite] 종료 중... 모든 프로세스를 정리합니다."
  # 자식 프로세스 그룹 전체 종료
  kill $(jobs -p) 2>/dev/null || true
  # Xvfb 정리
  kill "$XVFB_PID" 2>/dev/null || true
  kill "$CHROME_PID" 2>/dev/null || true
  kill "$FFMPEG_PID" 2>/dev/null || true
  echo "[StreamWebsite] 정리 완료."
  exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# --- 1단계: 기존 프로세스 정리 ---
echo "[StreamWebsite] 기존 프로세스 정리 중..."
pkill -f "Xvfb ${DISPLAY_NUM}" 2>/dev/null || true
pkill -f "chromium.*${DISPLAY_NUM}" 2>/dev/null || true
sleep 1

# --- 2단계: 가상 디스플레이 시작 ---
echo "[StreamWebsite] 가상 디스플레이(${RESOLUTION}) 시작..."
Xvfb ${DISPLAY_NUM} -screen 0 ${RESOLUTION}x24 -ac +extension GLX +render -noreset &
XVFB_PID=$!
sleep 2

# Xvfb가 정상 기동되었는지 확인
if ! kill -0 "$XVFB_PID" 2>/dev/null; then
  echo "[StreamWebsite] ✗ Xvfb 가상 디스플레이 시작 실패"
  exit 1
fi
echo "[StreamWebsite] ✓ 가상 디스플레이 기동 완료 (PID: ${XVFB_PID})"

# --- 3단계: Chromium 브라우저 시작 (극한 메모리 절약 모드) ---
echo "[StreamWebsite] Chromium 브라우저 시작 중 (메모리 최적화 모드)..."
DISPLAY=${DISPLAY_NUM} chromium \
  --no-sandbox \
  --disable-gpu \
  --disable-software-rasterizer \
  --disable-dev-shm-usage \
  --disable-extensions \
  --disable-background-networking \
  --disable-background-timer-throttling \
  --disable-backgrounding-occluded-windows \
  --disable-breakpad \
  --disable-component-update \
  --disable-default-apps \
  --disable-hang-monitor \
  --disable-popup-blocking \
  --disable-prompt-on-repost \
  --disable-sync \
  --disable-translate \
  --metrics-recording-only \
  --no-first-run \
  --no-default-browser-check \
  --autoplay-policy=no-user-gesture-required \
  --window-size=1280,720 \
  --window-position=0,0 \
  --start-fullscreen \
  --kiosk \
  --js-flags="--max-old-space-size=256" \
  --renderer-process-limit=1 \
  "${SITE_URL}" &
CHROME_PID=$!
echo "[StreamWebsite] ✓ Chromium 기동 완료 (PID: ${CHROME_PID})"

# 브라우저가 페이지를 완전히 로드할 시간 확보
echo "[StreamWebsite] 웹사이트 로딩 대기 (20초)..."
sleep 20

# Chromium이 아직 살아 있는지 확인
if ! kill -0 "$CHROME_PID" 2>/dev/null; then
  echo "[StreamWebsite] ✗ Chromium이 메모리 부족으로 종료되었습니다."
  echo "[StreamWebsite]   서버 사양 업그레이드가 필요할 수 있습니다."
  exit 1
fi
echo "[StreamWebsite] ✓ 웹사이트 로딩 완료"

# --- 4단계: FFmpeg 화면 캡처 + 유튜브 송출 ---
echo "[StreamWebsite] ================================================"
echo "[StreamWebsite] 유튜브 라이브 스트리밍 송출 시작!"
echo "[StreamWebsite] 해상도: ${RESOLUTION} | FPS: ${FPS} | 비트레이트: ${BITRATE}"
echo "[StreamWebsite] 대상: ${SITE_URL}"
echo "[StreamWebsite] ================================================"

# 무한 재시도 루프 (FFmpeg 크래시 시 자동 복구)
while true; do
  DISPLAY=${DISPLAY_NUM} ffmpeg \
    -f x11grab \
    -thread_queue_size 512 \
    -video_size ${RESOLUTION} \
    -framerate ${FPS} \
    -i ${DISPLAY_NUM}.0 \
    -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 \
    -c:v libx264 \
    -preset ultrafast \
    -tune zerolatency \
    -pix_fmt yuv420p \
    -b:v ${BITRATE} \
    -maxrate ${BITRATE} \
    -bufsize 5000k \
    -g 30 \
    -keyint_min 30 \
    -sc_threshold 0 \
    -threads 1 \
    -c:a aac \
    -b:a 128k \
    -ar 44100 \
    -shortest \
    -f flv \
    "${RTMP_URL}" &
  FFMPEG_PID=$!

  echo "[StreamWebsite] ✓ FFmpeg 송출 시작 (PID: ${FFMPEG_PID})"
  echo "[StreamWebsite] 유튜브 스튜디오에서 영상이 들어오는지 확인하세요!"

  # FFmpeg가 종료될 때까지 대기
  wait "$FFMPEG_PID" || true

  echo "[StreamWebsite] FFmpeg가 종료되었습니다. 5초 후 재시작..."
  sleep 5

  # Chromium이 여전히 살아 있는지 확인, 죽었으면 다시 띄움
  if ! kill -0 "$CHROME_PID" 2>/dev/null; then
    echo "[StreamWebsite] Chromium 재시작 중..."
    DISPLAY=${DISPLAY_NUM} chromium \
      --no-sandbox --disable-gpu --disable-software-rasterizer \
      --disable-dev-shm-usage --disable-extensions \
      --disable-background-networking --no-first-run \
      --autoplay-policy=no-user-gesture-required \
      --window-size=1280,720 --start-fullscreen --kiosk \
      --js-flags="--max-old-space-size=256" \
      --renderer-process-limit=1 \
      "${SITE_URL}" &
    CHROME_PID=$!
    sleep 15
  fi
done
