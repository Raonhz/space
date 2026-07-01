const fs = require('fs');
const path = require('path');

const src = 'C:\\Users\\kimke\\.gemini\\antigravity-ide\\brain\\6af4c047-a353-440f-b928-f924954a1a48\\satellite_icon_1782889115896.png';
const dest = path.join(__dirname, 'next-lofi/src/app/icon.png');
const oldFavicon = path.join(__dirname, 'next-lofi/src/app/favicon.ico');

if (fs.existsSync(src)) {
  fs.copyFileSync(src, dest);
  console.log('🚀 인공위성 파비콘 적용 성공 (icon.png)');
  
  if (fs.existsSync(oldFavicon)) {
    fs.unlinkSync(oldFavicon);
    console.log('🗑️ 충돌 방지를 위해 기존 favicon.ico 제거 완료');
  }
} else {
  console.error('❌ 에러: 원본 이미지를 찾을 수 없습니다.');
}

// 스크립트 실행 후 자가 삭제
try { fs.unlinkSync(__filename); } catch (e) {}
