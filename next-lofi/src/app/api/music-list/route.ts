import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const musicDir = path.join(process.cwd(), 'public', 'music');
    
    if (!fs.existsSync(musicDir)) {
      return NextResponse.json([]);
    }

    const files = fs.readdirSync(musicDir)
      .filter(file => file.endsWith('.mp3'));

    return NextResponse.json(files);
  } catch (error) {
    console.error("Failed to read music directory:", error);
    return NextResponse.json({ error: "Failed to read music list" }, { status: 500 });
  }
}
