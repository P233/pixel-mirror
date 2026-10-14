/**
 * Mockup Buffer Generation
 *
 * Handles image file processing for mockups:
 * - Validates file type and size
 * - Generates square thumbnails for preview
 * - Records the image size
 */

import { MOCKUP_THUMBNAIL_SIZE } from "~/constants";
import { ValidationError } from "./errors";
import { validateFiles } from "./validation";

async function processFile(file: File): Promise<MockupInput> {
  const { thumbnail, width, height } = await new Promise<{ thumbnail: Blob; width: number; height: number }>(
    (resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        // Create square crop from top-center so tall page headers remain recognizable
        const size = Math.min(img.width, img.height);
        const sx = (img.width - size) / 2;
        const sy = 0;

        const canvas = document.createElement("canvas");
        canvas.width = MOCKUP_THUMBNAIL_SIZE;
        canvas.height = MOCKUP_THUMBNAIL_SIZE;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          reject(new ValidationError("Failed to get canvas context"));
          return;
        }

        ctx.drawImage(img, sx, sy, size, size, 0, 0, MOCKUP_THUMBNAIL_SIZE, MOCKUP_THUMBNAIL_SIZE);

        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(objectUrl);
            if (blob) {
              resolve({ thumbnail: blob, width: img.naturalWidth, height: img.naturalHeight });
            } else {
              reject(new ValidationError("Failed to create thumbnail"));
            }
          },
          file.type,
          0.8
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new ValidationError(`Failed to load image: ${file.name}`));
      };

      img.src = objectUrl;
    }
  );

  return {
    image: file,
    thumbnail,
    filename: file.name,
    mimeType: file.type,
    width,
    height,
    fileSize: file.size
  };
}

export interface GenerateMockupBuffersResult {
  data: MockupInput[];
  errors: ValidationError[];
}

/**
 * Generate mockup buffers from files with validation
 *
 * @param files - Array of files to process
 * @returns Object with successful data and any validation/processing errors
 */
export async function generateMockupBuffers(files: File[]): Promise<GenerateMockupBuffersResult> {
  // Validate files first
  const { validFiles, errors } = validateFiles(files);

  if (validFiles.length === 0) {
    return { data: [], errors };
  }

  // Process valid files
  const results = await Promise.allSettled(validFiles.map(processFile));

  const data: MockupInput[] = [];
  const processingErrors: ValidationError[] = [...errors];

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      data.push(result.value);
    } else {
      const file = validFiles[index];
      const error =
        result.reason instanceof ValidationError
          ? result.reason
          : new ValidationError(`Failed to process ${file.name}`, String(result.reason));
      processingErrors.push(error);
    }
  });

  return { data, errors: processingErrors };
}
