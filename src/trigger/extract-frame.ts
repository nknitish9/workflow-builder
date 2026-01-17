import { task } from '@trigger.dev/sdk/v3';
import ffmpeg from 'fluent-ffmpeg';
import { writeFile, unlink, readFile } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

export const extractFrameTask = task({
  id: 'extract-frame',
  run: async (payload: {
    videoUrl: string;
    timestamp: string | number;
  }) => {
    const { videoUrl, timestamp } = payload;

    // Download video
    const response = await fetch(videoUrl);
    const buffer = await response.arrayBuffer();
    
    const inputPath = join('/tmp', `video-${uuidv4()}.mp4`);
    const outputPath = join('/tmp', `frame-${uuidv4()}.jpg`);
    
    await writeFile(inputPath, Buffer.from(buffer));

    try {
      // Get video duration if timestamp is percentage
      let seekTime = timestamp;
      if (typeof timestamp === 'string' && timestamp.includes('%')) {
        const duration = await new Promise<number>((resolve, reject) => {
          ffmpeg.ffprobe(inputPath, (err, data) => {
            if (err) reject(err);
            resolve(data.format.duration!);
          });
        });
        
        const percent = parseFloat(timestamp.replace('%', ''));
        seekTime = (percent / 100) * duration;
      }

      // Extract frame using FFmpeg
      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .seekInput(seekTime as number)
          .frames(1)
          .output(outputPath)
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .run();
      });

      // Read extracted frame
      const frameBuffer = await readFile(outputPath);
      
      // Upload to Transloadit
      // For now, return as base64
      const base64 = frameBuffer.toString('base64');
      const dataUrl = `data:image/jpeg;base64,${base64}`;

      return { frameImageUrl: dataUrl };
    } finally {
      // Cleanup
      await unlink(inputPath).catch(() => {});
      await unlink(outputPath).catch(() => {});
    }
  },
});