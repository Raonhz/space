import { NextResponse } from 'next/server';
// Placeholder for the stream analysis state.
// In a real implementation, a background service would update this global/cache state.
let currentStreamStatus = 'NORMAL';

export async function GET() {
  return NextResponse.json({ status: currentStreamStatus });
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    if (data.status) {
      currentStreamStatus = data.status;
      return NextResponse.json({ success: true, status: currentStreamStatus });
    }
    return NextResponse.json({ success: false }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
