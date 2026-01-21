import { NextRequest, NextResponse } from 'next/server';
import { uploadToTransloadit } from '@/lib/transloadit';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as 'image' | 'video';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    if (!type || (type !== 'image' && type !== 'video')) {
      return NextResponse.json({ error: 'Invalid type. Must be "image" or "video"' }, { status: 400 });
    }
    const result = await uploadToTransloadit(file, type);

    return NextResponse.json({
      success: true,
      url: result.url,
      thumbnailUrl: result.thumbnailUrl,
      fileName: file.name,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';