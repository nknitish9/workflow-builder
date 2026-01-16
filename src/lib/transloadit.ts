import Transloadit from 'transloadit';

if (!process.env.NEXT_PUBLIC_TRANSLOADIT_KEY) {
  throw new Error('Missing NEXT_PUBLIC_TRANSLOADIT_KEY');
}

if (!process.env.TRANSLOADIT_SECRET) {
  throw new Error('Missing TRANSLOADIT_SECRET');
}

export const transloadit = new Transloadit({
  authKey: process.env.NEXT_PUBLIC_TRANSLOADIT_KEY,
  authSecret: process.env.TRANSLOADIT_SECRET,
});

export async function uploadToTransloadit(
  file: File,
  templateId?: string
): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const params = templateId
    ? { template_id: templateId }
    : {
        steps: {
          ':original': {
            robot: '/upload/handle',
          },
          exported: {
            use: ':original',
            robot: '/s3/store',
            credentials: 'YOUR_S3_CREDENTIALS',
          },
        },
      };

  const assembly = await transloadit.createAssembly({
    files: {
      file: file as any, // Type assertion for Transloadit library compatibility
    },
    params,
  });

  // Safely access results with proper null checks
  if (!assembly.results || !assembly.results.exported || !assembly.results.exported[0]) {
    throw new Error('Upload failed: No results returned from Transloadit');
  }

  return assembly.results.exported[0].ssl_url || assembly.results.exported[0].url || '';
}

// Helper to get Transloadit signature for client-side uploads
export function getTransloaditSignature() {
  const params = {
    auth: {
      key: process.env.NEXT_PUBLIC_TRANSLOADIT_KEY || '',
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