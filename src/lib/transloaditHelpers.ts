interface TransloaditClient {
  createAssembly(params: any): Promise<any>;
  awaitAssemblyCompletion(assemblyId: string): Promise<any>;
}

let transloaditClient: TransloaditClient | null = null;

async function getTransloaditClient(): Promise<TransloaditClient> {
  if (transloaditClient) {
    return transloaditClient;
  }

  const TransloaditModule = await import('transloadit');
  const Transloadit = TransloaditModule.Transloadit ?? TransloaditModule;
  
  if (!process.env.TRANSLOADIT_KEY || !process.env.TRANSLOADIT_SECRET) {
    throw new Error('TRANSLOADIT_KEY and TRANSLOADIT_SECRET must be set in environment variables');
  }

  transloaditClient = new Transloadit({
    authKey: process.env.TRANSLOADIT_KEY,
    authSecret: process.env.TRANSLOADIT_SECRET,
  });

  return transloaditClient;
}

export async function cropImageViaTransloadit(
  imageUrl: string,
  xPercent: number,
  yPercent: number,
  widthPercent: number,
  heightPercent: number
): Promise<string> {
  try {
    console.log('[Transloadit] Creating crop assembly...');

    const transloadit = await getTransloaditClient();

    const assembly = await transloadit.createAssembly({
      params: {
        steps: {
          imported: {
            robot: '/http/import',
            url: imageUrl,
          },
          cropped: {
            use: 'imported',
            robot: '/image/resize',
            crop: {
              x1: `${xPercent}%`,
              y1: `${yPercent}%`,
              x2: `${xPercent + widthPercent}%`,
              y2: `${yPercent + heightPercent}%`,
            },
            format: 'jpg',
            quality: 95,
            result: true,
          },
        },
      },
    });
    
    const completed = await transloadit.awaitAssemblyCompletion(assembly.assembly_id);

    const result = completed.results?.cropped?.[0];
    if (!result?.ssl_url) {
      throw new Error('Crop operation failed - no output URL');
    }
    
    return result.ssl_url;
  } catch (error) {
    throw new Error(`Failed to crop image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function extractFrameViaTransloadit(
  videoUrl: string,
  timestamp: string | number
): Promise<string> {
  try {
    const transloadit = await getTransloaditClient();

    // Convert timestamp to format Transloadit expects
    let timestampStr: string;
    
    if (typeof timestamp === 'string' && timestamp.includes('%')) {
      const percent = parseFloat(timestamp.replace('%', ''));
      timestampStr = `${percent}%`;
    } else {
      const seconds = parseFloat(String(timestamp));
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      timestampStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    const assembly = await transloadit.createAssembly({
      params: {
        steps: {
          imported: {
            robot: '/http/import',
            url: videoUrl,
          },
          extracted_frame: {
            use: 'imported',
            robot: '/video/thumbs',
            count: 1,
            format: 'jpg',
            time: timestampStr,
            result: true,
          },
        },
      },
    });
    
    const completed = await transloadit.awaitAssemblyCompletion(assembly.assembly_id);

    const result = completed.results?.extracted_frame?.[0];
    if (!result?.ssl_url) {
      throw new Error('Frame extraction failed - no output URL');
    }

    return result.ssl_url;
  } catch (error) {
    throw new Error(`Failed to extract frame via Transloadit: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}