import { Transloadit } from 'transloadit';
import fs from 'fs';
import path from 'path';
import os from 'os';

if (!process.env.TRANSLOADIT_KEY) {
  throw new Error('Missing TRANSLOADIT_KEY');
}

if (!process.env.TRANSLOADIT_SECRET) {
  throw new Error('Missing TRANSLOADIT_SECRET');
}

export const transloadit = new Transloadit({
  authKey: process.env.TRANSLOADIT_KEY!,
  authSecret: process.env.TRANSLOADIT_SECRET!,
});

// Template IDs - create these in your Transloadit dashboard
export const TRANSLOADIT_TEMPLATES = {
  IMAGE_UPLOAD: process.env.NEXT_PUBLIC_TRANSLOADIT_IMAGE_TEMPLATE_ID,
  VIDEO_UPLOAD: process.env.NEXT_PUBLIC_TRANSLOADIT_VIDEO_TEMPLATE_ID,
};

/**
 * Upload result interface
 */
export interface UploadResult {
  url: string;
  thumbnailUrl?: string;
  fileName?: string;
}

/**
 * Upload file to Transloadit with optimized settings
 * Uses Transloadit's temporary storage
 */
export async function uploadToTransloadit(
  file: any,
  type: 'image' | 'video'
): Promise<UploadResult> {
  let tempFilePath: string | null = null;
  
  try {
    const templateId = type === 'image' 
      ? TRANSLOADIT_TEMPLATES.IMAGE_UPLOAD 
      : TRANSLOADIT_TEMPLATES.VIDEO_UPLOAD;

    let params: any;

    if (templateId) {
      params = { template_id: templateId };
    } else {
      params = {
        steps: {
          ':original': {
            robot: '/upload/handle',
          },
          ...(type === 'image' ? {
            'optimized': {
              use: ':original',
              robot: '/image/resize',
              width: 2048,
              height: 2048,
              resize_strategy: 'fit',
              imagemagick_stack: 'v3.0.0',
              format: 'jpg',
              quality: 85,
            },
            'thumbnail': {
              use: ':original',
              robot: '/image/resize',
              width: 400,
              height: 400,
              resize_strategy: 'fit',
              format: 'jpg',
              quality: 80,
            },
          } : {
            'encoded': {
              use: ':original',
              robot: '/video/encode',
              preset: 'webm',
              ffmpeg_stack: 'v6.0.0',
            },
            'thumbnail': {
              use: ':original',
              robot: '/video/thumbs',
              count: 1,
              format: 'jpg',
            },
          }),
        },
      };
    }

    // Convert File → Buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    const safeFileName =
      typeof file.name === 'string' ? file.name : 'upload.bin';

    tempFilePath = path.join(
      os.tmpdir(),
      `${Date.now()}-${safeFileName}`
    );

    // Write buffer to temp file
    fs.writeFileSync(tempFilePath, buffer);

    // Create Transloadit assembly using FILE PATH
    const assembly = await transloadit.createAssembly({
      files: {
        file: tempFilePath,
      },
      params,
    });

    // Wait for assembly to complete if it's still processing
    let completedAssembly = assembly;
    if (assembly.ok === 'ASSEMBLY_UPLOADING' || assembly.ok === 'ASSEMBLY_EXECUTING') {
      if (!assembly.assembly_id) {
        throw new Error('Upload failed: No assembly ID returned');
      }
      completedAssembly = await transloadit.awaitAssemblyCompletion(assembly.assembly_id);
    }

    // Clean up temp file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
      tempFilePath = null;
    }

    // Check assembly status
    if (completedAssembly.ok !== 'ASSEMBLY_COMPLETED') {
      throw new Error(`Upload failed: ${completedAssembly.message || completedAssembly.ok}`);
    }

    // Extract URLs from results
    const results = completedAssembly.results;
    
    if (!results) {
      throw new Error('Upload failed: No results returned from Transloadit');
    }
    
    // Find the main file and thumbnail
    let mainFile;
    let thumbnail;

    if (type === 'image') {
      mainFile = results.optimized?.[0] || results[':original']?.[0];
      thumbnail = results.thumbnail?.[0];
    } else {
      mainFile = results.encoded?.[0] || results[':original']?.[0];
      thumbnail = results.thumbnail?.[0];
    }

    if (!mainFile) {
      const allResults: any[] = [];
      Object.entries(results).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          allResults.push(...value.map(v => ({ ...v, _resultKey: key })));
        }
      });
      
      if (type === 'video') {
        mainFile = allResults.find((r: any) => {
          const mime = (r.mime || '').toLowerCase();
          const name = (r.name || '').toLowerCase();
          const isVideo = mime.startsWith('video/') || mime.includes('mp4') || mime.includes('quicktime') || mime.includes('webm');
          const isNotThumb = !name.includes('thumb');
          return isVideo && isNotThumb;
        });
        
        if (!thumbnail) {
          thumbnail = allResults.find((r: any) => {
            const mime = (r.mime || '').toLowerCase();
            const name = (r.name || '').toLowerCase();
            return mime.startsWith('image/') || name.includes('thumb');
          });
        }
      } else {
        // For image
        mainFile = allResults.find((r: any) => {
          const mime = (r.mime || '').toLowerCase();
          return mime.startsWith('image/');
        });
      }
    }

    if (!mainFile) {
      const allFiles: any[] = [];
      Object.values(results).forEach((value) => {
        if (Array.isArray(value)) {
          allFiles.push(...value);
        }
      });
      
      if (allFiles.length > 0) {
        // For video, prefer non-image files
        if (type === 'video') {
          mainFile = allFiles.find(f => !(f.mime || '').toLowerCase().startsWith('image/')) || allFiles[0];
        } else {
          mainFile = allFiles[0];
        }
      }
      
      if (!mainFile) {
        throw new Error(`Upload failed: No ${type} file found in Transloadit results. Check server logs for complete assembly data.`);
      }
    }

    // Extract URLs with proper null checks
    const mainUrl = mainFile.ssl_url || mainFile.url;
    const thumbUrl = thumbnail?.ssl_url || thumbnail?.url;

    if (!mainUrl) {
      throw new Error('Upload failed: No URL in main file result');
    }

    return {
      url: mainUrl,
      thumbnailUrl: thumbUrl || undefined,
      fileName: safeFileName,
    };
  } catch (error) {
    // Clean up temp file on error
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
    throw new Error(`Failed to upload ${type}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get signature for client-side uploads
 */
export function getTransloaditSignature(type: 'image' | 'video') {
  const templateId = type === 'image' 
    ? TRANSLOADIT_TEMPLATES.IMAGE_UPLOAD 
    : TRANSLOADIT_TEMPLATES.VIDEO_UPLOAD;

  const params = templateId
    ? {
        auth: {
          key: process.env.TRANSLOADIT_KEY || '',
        },
        template_id: templateId,
      }
    : {
        auth: {
          key: process.env.TRANSLOADIT_KEY || '',
        },
        steps: {
          ':original': {
            robot: '/upload/handle',
          },
        },
      };

  return {
    params: JSON.stringify(params),
    signature: transloadit.calcSignature(params),
  };
}