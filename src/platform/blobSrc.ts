import type { Attachment } from "svelte/attachments";

/**
 * Show a Blob in an <img>: sets src to an object URL that is revoked when the
 * blob changes or the image is removed
 */
export function blobSrc(blob: Blob): Attachment<HTMLImageElement> {
  return (img) => {
    const url = URL.createObjectURL(blob);
    img.src = url;
    return () => URL.revokeObjectURL(url);
  };
}
