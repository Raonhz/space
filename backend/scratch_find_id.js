import fs from 'fs';
import path from 'path';

const filePath = 'C:/Users/kimke/.gemini/antigravity-ide/brain/f47007be-3ea6-4fe9-aefa-b2cd0cec8923/.system_generated/steps/1834/content.md';

try {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // "videoId":"11자리ID" 찾기
  const regex = /"videoId":"([a-zA-Z0-9_-]{11})"/g;
  const matches = new Set();
  let match;
  while ((match = regex.exec(content)) !== null) {
    matches.add(match[1]);
  }
  
  console.log("FOUND_VIDEO_IDS:", Array.from(matches));
} catch (e) {
  console.error("ERROR reading dump:", e.message);
}
