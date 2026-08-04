// Best-effort JSON formatter. Unlike JSON.parse/JSON.stringify, this does not
// require the input to be valid JSON - it tokenizes whatever it's given and
// re-indents it, tolerating things like unquoted keys, single-quoted
// strings, trailing commas, and comments. It's meant as a fallback for
// input that's "almost JSON" (JS object literals, JSONC, etc).

import { tokenize, type Token } from "./tokenizer";

export type FormatOptions = {
  indentSize?: number;
  pretty?: boolean;
};

const isValueType = (t: Token) =>
  t.type === "string" ||
  t.type === "number" ||
  t.type === "keyword" ||
  t.type === "identifier" ||
  t.type === "unknown";

const normalizeString = (raw: string): string => {
  const quote = raw[0];
  const body =
    raw.length >= 2 && raw[raw.length - 1] === quote
      ? raw.slice(1, -1)
      : raw.slice(1);

  let result = "";
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];

    if (ch === "\\" && i + 1 < body.length) {
      const next = body[i + 1];
      if (next === quote) {
        result += next;
      } else if (next === "\\") {
        result += "\\\\";
      } else if (next === "n") {
        result += "\\n";
      } else if (next === "t") {
        result += "\\t";
      } else if (next === "r") {
        result += "\\r";
      } else if (next === '"') {
        result += '\\"';
      } else if (next === "u") {
        result += `\\u${body.slice(i + 2, i + 6)}`;
        i += 4;
      } else {
        result += next;
      }
      i++;
      continue;
    }

    if (ch === '"') {
      result += '\\"';
      continue;
    }

    result += ch;
  }

  return `"${result}"`;
};

export const format = (input: string, options: FormatOptions = {}): string => {
  const indentSize = options.indentSize ?? 2;
  const pretty = options.pretty ?? true;

  const toks = tokenize(input).filter((t) => t.type !== "whitespace");
  if (toks.length === 0) {
    return "";
  }

  let out = "";
  let indent = 0;
  const pad = () => (pretty ? " ".repeat(indent * indentSize) : "");
  const newline = () => {
    if (pretty) {
      out += `\n${pad()}`;
    }
  };

  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    const prev = toks[i - 1];

    if (t.type === "line_comment" || t.type === "block_comment") {
      if (!pretty) {
        continue;
      } // comments have no place in compact output
      if (out.length && !out.endsWith(`\n${pad()}`)) {
        out = out.replace(/[ \t]*$/, "");
        out += `\n${pad()}`;
      }
      out += t.value;
      newline();
      continue;
    }

    if (t.type === "punctuation" && (t.value === "}" || t.value === "]")) {
      indent = Math.max(0, indent - 1);
      out = out.replace(/\n[ \t]*$/, "");
      newline();
      out += t.value;
      continue;
    }

    if (t.type === "punctuation" && t.value === ",") {
      const next = toks[i + 1];
      if (next && (next.value === "}" || next.value === "]")) {
        continue;
      }
      out += ",";
      newline();
      continue;
    }

    if (t.type === "punctuation" && t.value === ":") {
      out += pretty ? ": " : ":";
      continue;
    }

    if (prev && isValueType(prev) && isValueType(t) && t.start > prev.end) {
      out += " ";
    }

    if (t.type === "string") {
      out += normalizeString(t.value);
    } else if (t.type === "identifier") {
      out += JSON.stringify(t.value);
    } else {
      out += t.value;
    }

    if (t.type === "punctuation" && (t.value === "{" || t.value === "[")) {
      const matchClose = t.value === "{" ? "}" : "]";
      const next = toks[i + 1];
      if (next && next.type === "punctuation" && next.value === matchClose) {
        out += matchClose;
        i++;
      } else {
        indent++;
        newline();
      }
    }
  }

  return out;
};
