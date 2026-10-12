/** Triggers a browser download of `blob` as `fileName`. */
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** "avatar michael.svg" → "avatar michael" */
export const baseName = (fileName: string | null, fallback = "design") =>
  (fileName ?? fallback).replace(/\.[^.]+$/, "") || fallback;
