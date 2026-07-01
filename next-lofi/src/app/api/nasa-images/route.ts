import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const nasaDir = path.join(process.cwd(), 'public', 'assets', 'nasa');
    
    if (!fs.existsSync(nasaDir)) {
      return NextResponse.json([]);
    }

    const files = fs.readdirSync(nasaDir)
      .filter(file => file.endsWith('.webp') || file.endsWith('.png') || file.endsWith('.jpg'));

    return NextResponse.json(files);
  } catch (error) {
    console.error("Failed to read nasa images directory:", error);
    return NextResponse.json({ error: "Failed to read images list" }, { status: 500 });
  }
}
