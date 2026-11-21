// Languages highlighted inside fenced code blocks in the editor. Each loads on first use, so only the
// languages a document actually contains are parsed. Colours come from the theme's syntax palette (hljs),
// the same palette the reader uses.
import { LanguageDescription, LanguageSupport, StreamLanguage } from "@codemirror/language";

const lang = (name, alias, load) => LanguageDescription.of({ name, alias, load });
// Legacy (stream) modes must be wrapped in LanguageSupport, like the modern language packages.
const legacy = (mode) => async () => new LanguageSupport(StreamLanguage.define(mode));

export const codeLanguages = [
  lang("JavaScript", ["js", "javascript", "jsx", "mjs", "cjs"], async () => (await import("@codemirror/lang-javascript")).javascript({ jsx: true })),
  lang("TypeScript", ["ts", "typescript", "tsx"], async () => (await import("@codemirror/lang-javascript")).javascript({ typescript: true, jsx: true })),
  lang("Python", ["py", "python"], async () => (await import("@codemirror/lang-python")).python()),
  lang("Rust", ["rs", "rust"], async () => (await import("@codemirror/lang-rust")).rust()),
  lang("Java", ["java"], async () => (await import("@codemirror/lang-java")).java()),
  lang("Kotlin", ["kt", "kts", "kotlin"], async () => legacy((await import("@codemirror/legacy-modes/mode/clike")).kotlin)()),
  lang("C/C++", ["c", "h", "cpp", "c++", "cc", "hpp", "cxx"], async () => (await import("@codemirror/lang-cpp")).cpp()),
  lang("C#", ["cs", "csharp"], async () => legacy((await import("@codemirror/legacy-modes/mode/clike")).csharp)()),
  lang("Go", ["go", "golang"], async () => (await import("@codemirror/lang-go")).go()),
  lang("JSON", ["json", "jsonc", "json5"], async () => (await import("@codemirror/lang-json")).json()),
  lang("YAML", ["yaml", "yml"], async () => (await import("@codemirror/lang-yaml")).yaml()),
  lang("TOML", ["toml"], async () => legacy((await import("@codemirror/legacy-modes/mode/toml")).toml)()),
  lang("HTML", ["html", "htm", "xml", "svg"], async () => (await import("@codemirror/lang-html")).html()),
  lang("CSS", ["css", "scss", "less"], async () => (await import("@codemirror/lang-css")).css()),
  lang("SQL", ["sql"], async () => (await import("@codemirror/lang-sql")).sql()),
  lang("Shell", ["sh", "bash", "zsh", "shell", "console", "fish"], async () => legacy((await import("@codemirror/legacy-modes/mode/shell")).shell)()),
  lang("PowerShell", ["ps1", "powershell", "pwsh"], async () => legacy((await import("@codemirror/legacy-modes/mode/powershell")).powerShell)()),
  lang("Lua", ["lua"], async () => legacy((await import("@codemirror/legacy-modes/mode/lua")).lua)()),
  lang("Ruby", ["rb", "ruby"], async () => legacy((await import("@codemirror/legacy-modes/mode/ruby")).ruby)()),
  lang("Diff", ["diff", "patch"], async () => legacy((await import("@codemirror/legacy-modes/mode/diff")).diff)()),
  lang("Dockerfile", ["dockerfile", "docker"], async () => legacy((await import("@codemirror/legacy-modes/mode/dockerfile")).dockerFile)()),
];
