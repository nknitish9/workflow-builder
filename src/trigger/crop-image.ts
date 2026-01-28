import { task } from "@trigger.dev/sdk/v3";
import { cropImageViaTransloadit } from '../lib/transloaditHelpers';

export const cropImageTask = task({
  id: 'crop-image',
  run: async (payload: {
    imageUrl: string;
    xPercent: number;
    yPercent: number;
    widthPercent: number;
    heightPercent: number;
  }) => {
    const croppedImageUrl = await cropImageViaTransloadit(
      payload.imageUrl,
      payload.xPercent,
      payload.yPercent,
      payload.widthPercent,
      payload.heightPercent
    );
    
    return { croppedImageUrl };
  },
});

export default cropImageTask;