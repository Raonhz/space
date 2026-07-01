import fs from 'fs';
import path from 'path';
import https from 'https';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const musicDir = path.join(__dirname, '../public/music');
const zipPath = path.join(__dirname, '../public/openlofi.zip');

// 디렉토리가 없으면 동기식 생성
if (!fs.existsSync(musicDir)) {
  fs.mkdirSync(musicDir, { recursive: true });
}

// console.log / error 로깅 파일 저장용 훅 탑재 (디버깅 목적)
const logFile = path.join(__dirname, 'download_debug.log');
fs.writeFileSync(logFile, `=== Downloader Run: ${new Date().toISOString()} ===\n`);

function writeLog(type, args) {
  const msg = `[${type}] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}\n`;
  fs.appendFileSync(logFile, msg);
}

const origLog = console.log;
const origErr = console.error;
console.log = (...args) => { origLog(...args); writeLog('INFO', args); };
console.error = (...args) => { origErr(...args); writeLog('ERROR', args); };

const ZIP_URL = 'https://github.com/btahir/open-lofi/releases/download/v1.0.0/openlofi.zip';

// 리디렉션을 지원하는 대용량 파일 다운로더
function downloadZip(url, dest) {
  return new Promise((resolve, reject) => {
    function fetchUrl(currentUrl) {
      console.log(`[Downloader] Requesting chunk from: ${currentUrl.substring(0, 70)}...`);
      https.get(currentUrl, (response) => {
        const status = response.statusCode;

        // 리디렉션 처리
        if (status >= 300 && status < 400 && response.headers.location) {
          const redirectUrl = new URL(response.headers.location, currentUrl).href;
          fetchUrl(redirectUrl);
          return;
        }

        if (status === 200) {
          const file = fs.createWriteStream(dest);
          response.pipe(file);
          
          let downloaded = 0;
          const total = parseInt(response.headers['content-length'] || '0', 10);
          let lastLogged = 0;

          response.on('data', (chunk) => {
            downloaded += chunk.length;
            const percent = total > 0 ? Math.round((downloaded / total) * 100) : 0;
            // 10% 단위로 진행률 출력
            if (percent % 10 === 0 && percent !== lastLogged) {
              console.log(`[Downloader] Download progress: ${percent}% (${(downloaded / 1024 / 1024).toFixed(1)} MB / ${(total / 1024 / 1024).toFixed(1)} MB)`);
              lastLogged = percent;
            }
          });

          file.on('finish', () => {
            file.close();
            resolve();
          });
          file.on('error', (err) => {
            fs.unlink(dest, () => {});
            reject(err);
          });
        } else {
          reject(new Error(`Failed to download zip: Status Code ${status}`));
        }
      }).on('error', (err) => {
        reject(err);
      });
    }

    fetchUrl(url);
  });
}

// 윈도우/리눅스 내장 tar 명령어를 이용한 고속 압축 해제
function unzipFile(src, dest) {
  return new Promise((resolve, reject) => {
    // Windows 및 리눅스에 공통 내장된 tar 명령어로 zip 파일 해제
    const cmd = `tar -xf "${src}" -C "${dest}"`;
    console.log(`[Downloader] Extracting zip using command: ${cmd}`);
    
    exec(cmd, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`Extraction failed: ${stderr || err.message}`));
      } else {
        resolve();
      }
    });
  });
}

let isDownloading = false;

export async function startDownload() {
  if (isDownloading) {
    console.log('[Downloader] Already running, skipping duplicate trigger.');
    return;
  }

  // 폴더에 이미 정상 파일들이 많이 있으면 굳이 zip 다시 안 받음
  const existingFiles = fs.readdirSync(musicDir).filter(f => f.endsWith('.mp3'));
  if (existingFiles.length >= 40) {
    console.log(`[Downloader] ${existingFiles.length} Lofi tracks already exist in music folder. Skip bundle download.`);
    return;
  }

  isDownloading = true;
  console.log(`[Downloader] Starting Lofi full bundle download (529MB)...`);
  
  try {
    // 1단계: Zip 다운로드
    await downloadZip(ZIP_URL, zipPath);
    console.log(`[Downloader] Zip download completed! File saved at: ${zipPath}`);

    // 2단계: 압축 해제
    console.log(`[Downloader] Extracting tracks...`);
    await unzipFile(zipPath, musicDir);
    console.log(`[Downloader] Extraction completed successfully!`);

    // 3단계: 다운로드받은 zip 파일 삭제 (디스크 절약)
    fs.unlinkSync(zipPath);
    console.log(`[Downloader] Cleaned up temporary zip file.`);

    // 4단계: 만약 zip 내부의 폴더 구조가 중첩되어 있을 경우 평탄화(Flatten)
    // zip 안에 lofi-master/music/... 형태로 들어갈 수 있으므로 music 폴더 내부 서브 폴더들을 찾아 mp3를 루트로 끌어올립니다.
    flattenMusicDir(musicDir);

  } catch (err) {
    console.error(`[Downloader] Critical Failure:`, err.message);
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  } finally {
    isDownloading = false;
  }
}

// 서브폴더 속 MP3를 최상위 music 폴더로 복사/이동하고 서브폴더 삭제
function flattenMusicDir(dir) {
  try {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        // 재귀 탐색
        flattenMusicDir(fullPath);
        
        // 서브폴더 안의 모든 파일들을 상위 dir로 이동
        const subItems = fs.readdirSync(fullPath);
        for (const subItem of subItems) {
          const oldPath = path.join(fullPath, subItem);
          const newPath = path.join(dir, subItem);
          fs.renameSync(oldPath, newPath);
        }
        
        // 빈 서브폴더 제거
        fs.rmdirSync(fullPath);
        console.log(`[Downloader] Flattened and removed folder: ${item}`);
      }
    }
  } catch (e) {
    console.error(`[Downloader] Flatten failed:`, e.message);
  }
}

startDownload();
