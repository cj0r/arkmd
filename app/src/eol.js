// Line endings. CodeMirror works with "\n" internally, so a file that uses Windows line endings (CRLF) would be
// rewritten with "\n" on save. For files whose line endings are all CRLF the editor is told to use "\r\n", and the
// text is read back with sliceDoc, which keeps them. Files that mix endings are saved with "\n".

/** "\r\n" when every line ending in the text is CRLF; otherwise null (use the default "\n"). */
export function lineSeparatorFor(text) {
  const crlf = /\r\n/.test(text);
  const loneLf = /(?<!\r)\n/.test(text);
  const loneCr = /\r(?!\n)/.test(text);
  return crlf && !loneLf && !loneCr ? "\r\n" : null;
}

/** The document text with the file's own line endings. */
export function docText(state) {
  return state.sliceDoc(0, state.doc.length);
}
