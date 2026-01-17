import { task } from "@trigger.dev/sdk/v3";
import ffmpeg from 'fluent-ffmpeg';
import { readFile, writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

export const cropImageTask = task({
  id: 'crop-image',
  run: async (payload: {
    imageUrl: string;
    xPercent: number;
    yPercent: number;
    widthPercent: number;
    heightPercent: number;
  }) => {
    const { imageUrl, xPercent, yPercent, widthPercent, heightPercent } = payload;

    // Download image
    const response = await fetch(imageUrl);
    const buffer = await response.arrayBuffer();
    
    const inputPath = join('/tmp', `input-${uuidv4()}.jpg`);
    const outputPath = join('/tmp', `output-${uuidv4()}.jpg`);
    
    await writeFile(inputPath, Buffer.from(buffer));

    try {
      // Get image dimensions
      const metadata = await new Promise<{ width: number; height: number }>(
        (resolve, reject) => {
          ffmpeg.ffprobe(inputPath, (err, data) => {
            if (err) reject(err);
            const stream = data.streams[0];
            resolve({ width: stream.width!, height: stream.height! });
          });
        }
      );

      const { width, height } = metadata;
      const cropX = Math.floor((xPercent / 100) * width);
      const cropY = Math.floor((yPercent / 100) * height);
      const cropWidth = Math.floor((widthPercent / 100) * width);
      const cropHeight = Math.floor((heightPercent / 100) * height);

      // Crop image using FFmpeg
      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .outputOptions([
            `-vf crop=${cropWidth}:${cropHeight}:${cropX}:${cropY}`,
          ])
          .output(outputPath)
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .run();
      });

      // Read cropped image
      const croppedBuffer = await readFile(outputPath);
      
      // Upload to Transloadit
      // For now, return as base64
      const base64 = croppedBuffer.toString('base64');
      const dataUrl = `data:image/jpeg;base64,${base64}`;

      return { croppedImageUrl: dataUrl };
    } finally {
      // Cleanup
      await unlink(inputPath).catch(() => {});
      await unlink(outputPath).catch(() => {});
    }
  },
});