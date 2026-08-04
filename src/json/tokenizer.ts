// Lenient JSON tokenizer. It does not validate that the input is well-formed
// JSON - it only splits source text into a flat list of tokens with enough
// detail to drive a best-effort formatter, tolerating things like unquoted
// keys, single-quoted strings, trailing commas, and comments.

export type TokenType =
  | "whitespace"
  | "line_comment"
  | "block_comment"
  | "string"
  | "number"
  | "keyword"
  | "identifier"
  | "punctuation"
  | "unknown";

export type Token = {
  type: TokenType;
  value: string;
  start: number;
  end: number;
};

const KEYWORDS = new Set([
  "true",
  "false",
  "null",
  "undefined",
  "NaN",
  "Infinity",
]);

const isDigit = (ch: string) => ch >= "0" && ch <= "9";
const isIdentStart = (ch: string) => /[A-Za-z_$]/.test(ch);
const isIdentPart = (ch: string) => /[A-Za-z0-9_$]/.test(ch);

export const tokenize = (src: string): Token[] => {
  const tokens: Token[] = [];
  let i = 0;
  const n = src.length;

  while (i < n) {
    const start = i;
    const ch = src[i];

    // whitespace
    if (/\s/.test(ch)) {
      while (i < n && /\s/.test(src[i])) {
        i++;
      }
      tokens.push({
        type: "whitespace",
        value: src.slice(start, i),
        start,
        end: i,
      });
      continue;
    }

    // line comment
    if (ch === "/" && src[i + 1] === "/") {
      i += 2;
      while (i < n && src[i] !== "\n") {
        i++;
      }
      tokens.push({
        type: "line_comment",
        value: src.slice(start, i),
        start,
        end: i,
      });
      continue;
    }

    // block comment
    if (ch === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) {
        i++;
      }
      i = Math.min(i + 2, n);
      tokens.push({
        type: "block_comment",
        value: src.slice(start, i),
        start,
        end: i,
      });
      continue;
    }

    // strings (double or single quoted)
    if (ch === '"' || ch === "'") {
      const quote = ch;
      i++;
      while (i < n && src[i] !== quote) {
        if (src[i] === "\\" && i + 1 < n) {
          i += 2;
        } else if (src[i] === "\n") {
          // unterminated string - stop at end of line
          break;
        } else {
          i++;
        }
      }
      if (src[i] === quote) {
        i++;
      }
      tokens.push({
        type: "string",
        value: src.slice(start, i),
        start,
        end: i,
      });
      continue;
    }

    // numbers
    if (isDigit(ch) || ((ch === "-" || ch === "+") && isDigit(src[i + 1]))) {
      i++;
      while (i < n && /[0-9.eE+\-]/.test(src[i])) {
        i++;
      }
      tokens.push({
        type: "number",
        value: src.slice(start, i),
        start,
        end: i,
      });
      continue;
    }

    // identifiers / keywords (unquoted keys, true/false/null, etc.)
    if (isIdentStart(ch)) {
      i++;
      while (i < n && isIdentPart(src[i])) {
        i++;
      }
      const value = src.slice(start, i);
      tokens.push({
        type: KEYWORDS.has(value) ? "keyword" : "identifier",
        value,
        start,
        end: i,
      });
      continue;
    }

    // punctuation
    if ("{}[]:,".includes(ch)) {
      i++;
      tokens.push({ type: "punctuation", value: ch, start, end: i });
      continue;
    }

    // anything else (stray characters like unmatched quotes, symbols, etc.)
    i++;
    tokens.push({ type: "unknown", value: ch, start, end: i });
  }

  return tokens;
};
