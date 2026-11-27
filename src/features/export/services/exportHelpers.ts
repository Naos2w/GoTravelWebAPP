/**
 * Triggers a browser file download from a Blob using a temporary anchor element.
 */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  if (typeof document === "undefined" || typeof URL === "undefined") {
    return;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  if (typeof URL.revokeObjectURL === "function") {
    URL.revokeObjectURL(url);
  }
}

/**
 * Produces a filesystem-safe filename base with a fallback when the input is blank.
 */
export function sanitizeFilenameBase(name: string | undefined, fallback = "gotravel-export"): string {
  const cleaned = (name || "")
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || fallback;
}
