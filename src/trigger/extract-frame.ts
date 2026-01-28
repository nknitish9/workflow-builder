import { task } from '@trigger.dev/sdk/v3';
import { extractFrameViaTransloadit } from '@/lib/transloaditHelpers';

export const extractFrameTask = task({
  id: 'extract-frame',
  run: async (payload: {
    videoUrl: string;
    timestamp: string | number;
  }) => {
    const frameImageUrl = await extractFrameViaTransloadit(
      payload.videoUrl,
      payload.timestamp
    );

    return { frameImageUrl };
  },
});