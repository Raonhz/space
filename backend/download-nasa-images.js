import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 프론트엔드의 public assets 하위 폴더로 지정
// 빌드 후에도 직접 호스팅 가능하도록 구성
const nasaDir = path.resolve(__dirname, '../frontend/public/assets/nasa');

// 디렉토리가 없으면 동기식 생성
if (!fs.existsSync(nasaDir)) {
  fs.mkdirSync(nasaDir, { recursive: true });
}

const NASA_SEARCH_API = 'https://images-api.nasa.gov/search?q=nebula+galaxy+earth+space&media_type=image';

function getJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function downloadImage(url, dest) {
  return new Promise((resolve, reject) => {
    function fetchUrl(currentUrl) {
      https.get(currentUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (response) => {
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
          file.on('finish', () => {
            file.close();
            resolve();
          });
          file.on('error', (err) => {
            fs.unlink(dest, () => {});
            reject(err);
          });
        } else {
          reject(new Error(`Status Code: ${status}`));
        }
      }).on('error', reject);
    }
    fetchUrl(url);
  });
}

async function startNasaDownloads() {
  console.log(`[NASA Downloader] Fetching space image registry from images.nasa.gov...`);
  console.log(`[NASA Downloader] Saving to: ${nasaDir}`);

  try {
    const data = await getJson(NASA_SEARCH_API);
    const items = data.collection.items || [];
    
    // 유효한 이미지 목록 필터링
    const imageUrls = [];
    for (const item of items) {
      if (imageUrls.length >= 40) break; // 최대 40장 다운로드
      
      const links = item.links || [];
      const imageLink = links.find(l => l.render === 'image' || l.href.endsWith('.jpg') || l.href.endsWith('.png'));
      
      if (imageLink && imageLink.href) {
        // NASA API 특성상 썸네일 대신 오리지널 해상도(collection.json 파일 속의 ~orig.jpg 또는 ~large.jpg 주소)를 수집하기 위해
        // href가 메타데이터 json 링크이면 다시 json을 읽어 실제 고화질 파일 경로를 뽑아냅니다.
        let rawUrl = imageLink.href;
        
        // 썸네일 대신 고화질 원본 이미지로 교체 시도
        // 예: ~thumb.jpg -> ~large.jpg / ~orig.jpg
        if (rawUrl.includes('~thumb')) {
          rawUrl = rawUrl.replace('~thumb', '~large');
        }
        
        imageUrls.push(rawUrl);
      }
    }

    console.log(`[NASA Downloader] Found ${imageUrls.length} high-quality candidate images.`);

    let successCount = 0;
    for (let i = 0; i < imageUrls.length; i++) {
      const url = imageUrls[i];
      const filename = `nasa_${i + 1}.jpg`;
      const destPath = path.join(nasaDir, filename);

      try {
        console.log(`[NASA Downloader] Downloading [${i + 1}/${imageUrls.length}] ${filename}...`);
        await downloadImage(url, destPath);
        console.log(`[NASA Downloader] Saved: ${filename}`);
        successCount++;
      } catch (err) {
        console.error(`[NASA Downloader] Failed to download image ${i + 1}:`, err.message);
      }
    }

    console.log(`\n=== NASA Download finished! ===`);
    console.log(`Successfully acquired: ${successCount}/${imageUrls.length} images.`);

  } catch (err) {
    console.error(`[NASA Downloader] Failure during process:`, err.message);
  }
}

startNasaDownloads();
