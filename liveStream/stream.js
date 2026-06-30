require('dotenv').config({ path: '../.env' });
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

const STREAM_URL = 'rtmp://a.rtmp.youtube.com/live2';
const STREAM_KEY = process.env.YOUTUBE_STREAM_KEY;

if (!STREAM_KEY || STREAM_KEY === 'your_stream_key_here') {
  console.error("\n❌ 에러: .env 파일에 유튜브 스트림 키(YOUTUBE_STREAM_KEY)를 입력해주세요.");
  process.exit(1);
}

const videoPath = path.join(__dirname, 'assets', process.env.VIDEO_FILE || 'background.mp4');
const audioPath = path.join(__dirname, 'assets', process.env.AUDIO_FILE || 'lofi.mp3');

if (!fs.existsSync(videoPath)) {
  console.error(`\n❌ 에러: 영상 파일을 찾을 수 없습니다: ${videoPath}`);
  console.error(`assets 폴더 안에 영상을 넣고 .env 파일의 VIDEO_FILE 이름을 맞춰주세요.`);
  process.exit(1);
}

if (!fs.existsSync(audioPath)) {
  console.error(`\n❌ 에러: 오디오 파일을 찾을 수 없습니다: ${audioPath}`);
  console.error(`assets 폴더 안에 음악을 넣고 .env 파일의 AUDIO_FILE 이름을 맞춰주세요.`);
  process.exit(1);
}

console.log(`\n🚀 [Lofi Streamer] 방송 송출을 준비합니다...`);
console.log(`- 비디오 소스: ${videoPath}`);
console.log(`- 오디오 소스: ${audioPath}`);
console.log(`- 송출 대상: YouTube Live RTMP\n`);

function startStreaming() {
  console.log('📡 [Lofi Streamer] 스트리밍 시작!');

  ffmpeg()
    // 비디오 입력 (루프)
    .input(videoPath)
    .inputOptions(['-stream_loop -1', '-re']) // -re: 실시간 속도, -stream_loop: 무한 반복
    
    // 오디오 입력 (루프)
    .input(audioPath)
    .inputOptions(['-stream_loop -1', '-re'])

    // 비디오 코덱 및 설정 (유튜브 최적화)
    .videoCodec('libx264')
    .outputOptions([
      '-preset veryfast', // CPU 점유율 최적화
      '-maxrate 3000k',   // 최대 비트레이트 3000kbps (1080p 기준 적당)
      '-bufsize 6000k',
      '-pix_fmt yuv420p',
      '-g 60',            // 키프레임 간격 2초 (30fps 기준 60)
      '-r 30',            // 30 프레임
      '-shortest'         // 오디오/비디오 중 하나라도 끝나면(하지만 루프라 안 끝남)
    ])

    // 오디오 코덱 및 설정
    .audioCodec('aac')
    .audioBitrate('128k')
    .audioFrequency(44100)
    
    // 포맷 지정 (유튜브 권장 FLV)
    .format('flv')

    // FFmpeg 이벤트 핸들러
    .on('start', (commandLine) => {
      console.log('▶ FFmpeg 엔진이 가동되었습니다.\n');
    })
    .on('error', (err, stdout, stderr) => {
      console.error('\n⚠️ 스트리밍 에러 발생:', err.message);
      console.log('🔄 5초 후 스트리밍을 재시작합니다...');
      setTimeout(startStreaming, 5000);
    })
    .on('end', () => {
      console.log('\n🛑 스트리밍이 예기치 않게 종료되었습니다.');
      console.log('🔄 5초 후 재시작합니다...');
      setTimeout(startStreaming, 5000);
    })
    
    // 유튜브 서버로 스트리밍 (URL + KEY)
    .save(`${STREAM_URL}/${STREAM_KEY}`);
}

startStreaming();
