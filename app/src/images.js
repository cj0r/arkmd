// Helpers for inserting pictures. Pure logic (see images.test.js).

const TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp", "image/svg+xml": "svg", "image/avif": "avif", "image/bmp": "bmp" };
const EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "avif", "bmp"]);

/** The file extension for an image MIME type, or null. */
export function extensionForType(type) {
  return TYPES[String(type ?? "").toLowerCase()] || null;
}

/** Whether a file name has an image extension. */
export function isImagePath(path) {
  return EXTENSIONS.has(String(path ?? "").split(".").pop().toLowerCase());
}

/** "pasted-20261122-143009" for a picture taken from the clipboard. */
export function pastedStem(date = new Date()) {
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `pasted-${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
}

/** Alt text suggested for a file: its name without folder, extension and separators ("holiday_photo-1.png" gives "holiday photo 1"). */
export function altFromPath(path) {
  const name = String(path ?? "").split(/[\\/]/).pop().replace(/\.[^.]*$/, "");
  return name.replace(/[-_]+/g, " ").trim();
}

/** Whether a clipboard holds a picture and no text, so Paste should insert the picture. */
export function pastesAsImage(items) {
  const list = Array.from(items ?? []);
  return list.some((i) => i.kind === "file" && extensionForType(i.type)) && !list.some((i) => i.kind === "string" && i.type === "text/plain");
}
