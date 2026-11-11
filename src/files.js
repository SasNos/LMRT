import { MAX_FILE_BYTES } from "./constants.js";
import { parseMarkdown } from "./markdown.js";

// Add a format here to teach the reader a new file type.
export const FORMATS = {
  ".md": parseMarkdown,
  ".markdown": parseMarkdown,
};

export const ACCEPT = Object.keys(FORMATS).join(",");

export function checkFile(file) {
  const name = typeof file?.name === "string" ? file.name : "";
  const dot = name.lastIndexOf(".");
  const extension = dot < 0 ? "" : name.slice(dot).toLowerCase();
  const parse = Object.hasOwn(FORMATS, extension) ? FORMATS[extension] : null;
  if (!parse) return { ok: false, error: "unsupported" };
  if (!(file.size >= 0) || file.size > MAX_FILE_BYTES) return { ok: false, error: "too-large" };
  return { ok: true, parse };
}
