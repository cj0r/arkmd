// Checks for a new file name typed by the user (Rename file). The same rules apply on every platform, so a
// name that works on one system can be moved to another.

const FORBIDDEN = /[<>:"/\\|?*\u0000-\u001f]/;
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

/** The name to use: trimmed, and given the old file's extension when the user typed none. */
export function newFileName(typed, oldName = "") {
  const name = String(typed ?? "").trim();
  const ext = /\.[A-Za-z0-9]{1,8}$/.exec(oldName)?.[0] ?? "";
  return name && !/\.[^.]+$/.test(name) ? name + ext : name;
}

/** Why `name` can't be a file name, or null when it can. */
export function fileNameProblem(name) {
  if (!name || !name.trim()) return "Enter a name.";
  if (name === "." || name === ".." || /^\.+$/.test(name)) return "That name isn't allowed.";
  if (FORBIDDEN.test(name)) return "A name can't contain / \\ : * ? \" < > | or control characters.";
  if (/[. ]$/.test(name)) return "A name can't end with a dot or a space.";
  if (RESERVED.test(name)) return "That name is reserved by Windows.";
  if (new TextEncoder().encode(name).length > 255) return "That name is too long.";
  return null;
}
