// Links in a document: which ones leave the app, which open another file next to it, which jump within the page.
// Pure logic (see links.test.js).

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** Classify a link's address: { kind: "external", url } | { kind: "anchor", fragment } | { kind: "file", path, fragment } | null. */
export function parseLink(href) {
  const raw = String(href ?? "").trim();
  if (!raw) return null;
  if (/^(https?:|mailto:)/i.test(raw)) return { kind: "external", url: raw };
  if (raw[0] === "#") return { kind: "anchor", fragment: decode(raw.slice(1)) };
  if (SCHEME.test(raw) || raw.startsWith("//") || raw[0] === "/" || raw[0] === "\\" || /^[a-z]:[\\/]/i.test(raw)) return null;
  const [beforeFragment, ...frag] = raw.split("#");
  const path = decode(beforeFragment.split("?")[0]).replace(/\\/g, "/");
  return path && isRelativePath(path) ? { kind: "file", path, fragment: decode(frag.join("#")) } : null;
}

/** The file and heading a [[wikilink]] points to: "Note", "Note#Heading", "folder/Note|alias". A name without an extension gets .md. */
export function wikilinkTarget(text) {
  const target = String(text ?? "").split("|")[0].trim();
  const [name, ...frag] = target.split("#");
  const path = name.trim().replace(/\\/g, "/");
  if (!path || !isRelativePath(path)) return null;
  return { path: /\.[A-Za-z0-9]{1,8}$/.test(path) ? path : path + ".md", fragment: frag.join("#").trim() };
}

/** GitHub-style anchor name for a heading: lower case, punctuation dropped, spaces to hyphens. */
export function slugify(text) {
  return String(text ?? "").trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/\s/g, "-");
}

const IMAGE_TYPES = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", avif: "image/avif", bmp: "image/bmp" };

/** MIME type for an image file name, or null. */
export function imageType(path) {
  return IMAGE_TYPES[String(path).split(".").pop().toLowerCase()] || null;
}

/** Whether a decoded path stays relative to the document's folder: not rooted, no drive letter, no network share.
 *  Checked after decoding, because %2F and %5C turn into / and \ there. */
export function isRelativePath(path) {
  return !(path.startsWith("/") || /^[a-z]:/i.test(path));
}

function decode(s) {
  try { return decodeURIComponent(s); } catch { return s; }
}
