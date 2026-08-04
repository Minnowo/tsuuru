// SQL tokenizer, aiming for broad compatibility across dialects (ANSI SQL,
// MySQL/MariaDB, PostgreSQL, SQLite, SQL Server / T-SQL, Oracle, BigQuery,
// Snowflake). It does not validate grammar - it only splits source text into
// a flat list of tokens with enough detail to drive a formatter.

export type TokenType =
  | "whitespace"
  | "line_comment"
  | "block_comment"
  | "string"
  | "dollar_string"
  | "quoted_identifier"
  | "identifier"
  | "keyword"
  | "number"
  | "parameter"
  | "operator"
  | "punctuation"
  | "unknown";

export type Token = {
  type: TokenType;
  value: string;
  start: number;
  end: number;
  line: number;
  column: number;
};

// Keywords are dialect-agnostic on purpose: this is a superset covering
// common reserved/non-reserved words across the supported dialects. Callers
// that need dialect-accurate keyword sets can post-process identifiers.
export const KEYWORDS = new Set(
  [
    "ADD",
    "ALL",
    "ALTER",
    "AND",
    "ANY",
    "AS",
    "ASC",
    "BEGIN",
    "BETWEEN",
    "BY",
    "CASCADE",
    "CASE",
    "CAST",
    "CHECK",
    "COLLATE",
    "COLUMN",
    "COMMIT",
    "CONSTRAINT",
    "CREATE",
    "CROSS",
    "CURRENT",
    "CURRENT_DATE",
    "CURRENT_TIME",
    "CURRENT_TIMESTAMP",
    "CURRENT_USER",
    "DATABASE",
    "DEFAULT",
    "DELETE",
    "DESC",
    "DISTINCT",
    "DROP",
    "ELSE",
    "END",
    "ESCAPE",
    "EXCEPT",
    "EXISTS",
    "EXPLAIN",
    "EXTRACT",
    "FALSE",
    "FETCH",
    "FILTER",
    "FOR",
    "FOREIGN",
    "FROM",
    "FULL",
    "FUNCTION",
    "GRANT",
    "GROUP",
    "HAVING",
    "IF",
    "ILIKE",
    "IN",
    "INDEX",
    "INNER",
    "INSERT",
    "INTERSECT",
    "INTO",
    "IS",
    "ISNULL",
    "JOIN",
    "KEY",
    "LATERAL",
    "LEFT",
    "LIKE",
    "LIMIT",
    "MATCH",
    "MERGE",
    "NATURAL",
    "NOT",
    "NOTNULL",
    "NULL",
    "NULLS",
    "OFFSET",
    "ON",
    "OR",
    "ORDER",
    "OUTER",
    "OVER",
    "PARTITION",
    "PRIMARY",
    "PROCEDURE",
    "QUALIFY",
    "REFERENCES",
    "REGEXP",
    "RENAME",
    "REPLACE",
    "RETURNING",
    "REVOKE",
    "RIGHT",
    "ROLLBACK",
    "ROW",
    "ROWS",
    "SCHEMA",
    "SELECT",
    "SET",
    "SIMILAR",
    "SOME",
    "TABLE",
    "TABLESAMPLE",
    "THEN",
    "TO",
    "TOP",
    "TRANSACTION",
    "TRIGGER",
    "TRUE",
    "TRUNCATE",
    "UNION",
    "UNIQUE",
    "UPDATE",
    "USING",
    "VALUES",
    "VIEW",
    "WHEN",
    "WHERE",
    "WINDOW",
    "WITH",
    "WITHIN",
  ].map((word) => word.toUpperCase()),
);

const isDigit = (ch: string) => ch >= "0" && ch <= "9";
const isIdentStart = (ch: string) =>
  (ch >= "a" && ch <= "z") ||
  (ch >= "A" && ch <= "Z") ||
  ch === "_" ||
  ch.charCodeAt(0) > 127; // allow unicode identifiers
const isIdentPart = (ch: string) =>
  isIdentStart(ch) || isDigit(ch) || ch === "$" || ch === "#";

// Multi-character operators, longest first so the scanner can greedily match.
const OPERATORS = [
  "<=>", // MySQL null-safe equals
  "!==",
  "::",
  "->>",
  "->",
  "=>",
  ":=",
  "||",
  "<<",
  ">>",
  "<>",
  "!=",
  "<=",
  ">=",
  "~*",
  "!~",
  "??",
  "?|",
  "?&",
  "=",
  "<",
  ">",
  "+",
  "-",
  "*",
  "/",
  "%",
  "^",
  "&",
  "|",
  "~",
  "!",
  "?",
];

const PUNCTUATION = new Set(["(", ")", ",", ";", ".", "[", "]", "{", "}", ":"]);

class Scanner {
  readonly src: string;
  pos = 0;
  line = 1;
  column = 1;

  constructor(src: string) {
    this.src = src;
  }

  eof(offset = 0): boolean {
    return this.pos + offset >= this.src.length;
  }

  peek(offset = 0): string {
    return this.src[this.pos + offset] ?? "";
  }

  slice(from: number, to: number): string {
    return this.src.slice(from, to);
  }

  advance(count = 1) {
    for (let i = 0; i < count && !this.eof(); i++) {
      if (this.src[this.pos] === "\n") {
        this.line++;
        this.column = 1;
      } else {
        this.column++;
      }
      this.pos++;
    }
  }
}

const matchDollarTag = (scanner: Scanner, offset: number): string | null => {
  // Matches a Postgres dollar-quote tag opener like `$$` or `$tag$`, starting
  // at `offset` (which must point at the leading `$`). Returns the full
  // opening delimiter (including both `$`) or null if this isn't one.
  if (scanner.peek(offset) !== "$") {
    return null;
  }

  const isTagChar = (ch: string) => isIdentStart(ch) || isDigit(ch);

  let i = offset + 1;
  while (!scanner.eof(i) && isTagChar(scanner.peek(i))) {
    i++;
  }

  if (scanner.peek(i) !== "$") {
    return null;
  }

  return scanner.slice(scanner.pos + offset, scanner.pos + i + 1);
};

const readWhitespace = (scanner: Scanner): Token => {
  const start = scanner.pos;
  const line = scanner.line;
  const column = scanner.column;

  while (!scanner.eof() && /\s/.test(scanner.peek())) {
    scanner.advance();
  }

  return {
    type: "whitespace",
    value: scanner.slice(start, scanner.pos),
    start,
    end: scanner.pos,
    line,
    column,
  };
};

const readLineComment = (scanner: Scanner, markerLength: number): Token => {
  const start = scanner.pos;
  const line = scanner.line;
  const column = scanner.column;

  scanner.advance(markerLength);
  while (!scanner.eof() && scanner.peek() !== "\n") {
    scanner.advance();
  }

  return {
    type: "line_comment",
    value: scanner.slice(start, scanner.pos),
    start,
    end: scanner.pos,
    line,
    column,
  };
};

const readBlockComment = (scanner: Scanner): Token => {
  // Nested block comments are supported (Postgres, T-SQL); dialects that
  // don't nest them will simply never produce nested `/*` in practice.
  const start = scanner.pos;
  const line = scanner.line;
  const column = scanner.column;

  let depth = 0;

  while (!scanner.eof()) {
    if (scanner.peek() === "/" && scanner.peek(1) === "*") {
      scanner.advance(2);
      depth++;
      continue;
    }

    if (scanner.peek() === "*" && scanner.peek(1) === "/") {
      scanner.advance(2);
      depth--;
      if (depth === 0) {
        break;
      }
      continue;
    }

    scanner.advance();
  }

  return {
    type: "block_comment",
    value: scanner.slice(start, scanner.pos),
    start,
    end: scanner.pos,
    line,
    column,
  };
};

const readQuoted = (
  scanner: Scanner,
  quote: string,
  type: TokenType,
  allowBackslashEscape: boolean,
): Token => {
  const start = scanner.pos;
  const line = scanner.line;
  const column = scanner.column;

  scanner.advance(); // opening quote

  while (!scanner.eof()) {
    const ch = scanner.peek();

    if (allowBackslashEscape && ch === "\\" && !scanner.eof(1)) {
      scanner.advance(2);
      continue;
    }

    if (ch === quote) {
      if (scanner.peek(1) === quote) {
        // Doubled-quote escape, e.g. 'it''s' or "col""name".
        scanner.advance(2);
        continue;
      }

      scanner.advance();
      break;
    }

    scanner.advance();
  }

  return {
    type,
    value: scanner.slice(start, scanner.pos),
    start,
    end: scanner.pos,
    line,
    column,
  };
};

const readBracketIdentifier = (scanner: Scanner): Token => {
  // T-SQL style [bracketed identifier], `]]` is the escape for a literal `]`.
  const start = scanner.pos;
  const line = scanner.line;
  const column = scanner.column;

  scanner.advance();

  while (!scanner.eof()) {
    if (scanner.peek() === "]") {
      if (scanner.peek(1) === "]") {
        scanner.advance(2);
        continue;
      }
      scanner.advance();
      break;
    }
    scanner.advance();
  }

  return {
    type: "quoted_identifier",
    value: scanner.slice(start, scanner.pos),
    start,
    end: scanner.pos,
    line,
    column,
  };
};

const readDollarString = (scanner: Scanner, tag: string): Token => {
  const start = scanner.pos;
  const line = scanner.line;
  const column = scanner.column;

  scanner.advance(tag.length);

  while (!scanner.eof()) {
    if (scanner.slice(scanner.pos, scanner.pos + tag.length) === tag) {
      scanner.advance(tag.length);
      break;
    }
    scanner.advance();
  }

  return {
    type: "dollar_string",
    value: scanner.slice(start, scanner.pos),
    start,
    end: scanner.pos,
    line,
    column,
  };
};

const readNumber = (scanner: Scanner): Token => {
  const start = scanner.pos;
  const line = scanner.line;
  const column = scanner.column;

  // Hex (0x...), binary (0b...), octal (0o...) literals.
  if (
    scanner.peek() === "0" &&
    /[xXbBoO]/.test(scanner.peek(1)) &&
    /[0-9a-fA-F_]/.test(scanner.peek(2))
  ) {
    scanner.advance(2);
    while (!scanner.eof() && /[0-9a-fA-F_]/.test(scanner.peek())) {
      scanner.advance();
    }
    return {
      type: "number",
      value: scanner.slice(start, scanner.pos),
      start,
      end: scanner.pos,
      line,
      column,
    };
  }

  const consumeDigits = () => {
    while (
      !scanner.eof() &&
      (isDigit(scanner.peek()) || scanner.peek() === "_")
    ) {
      scanner.advance();
    }
  };

  consumeDigits();

  if (scanner.peek() === "." && isDigit(scanner.peek(1))) {
    scanner.advance();
    consumeDigits();
  } else if (scanner.peek() === "." && !isIdentStart(scanner.peek(1))) {
    // Trailing dot with no fraction digits, e.g. `1.`
    scanner.advance();
  }

  if (/[eE]/.test(scanner.peek())) {
    const save = scanner.pos;
    scanner.advance();
    if (scanner.peek() === "+" || scanner.peek() === "-") {
      scanner.advance();
    }
    if (isDigit(scanner.peek())) {
      consumeDigits();
    } else {
      scanner.pos = save; // not actually an exponent, back out
    }
  }

  // Optional dialect-specific numeric suffixes, e.g. BigQuery's `123n`.
  if (scanner.peek() === "n" && !isIdentPart(scanner.peek(1))) {
    scanner.advance();
  }

  return {
    type: "number",
    value: scanner.slice(start, scanner.pos),
    start,
    end: scanner.pos,
    line,
    column,
  };
};

const readIdentifier = (scanner: Scanner): Token => {
  const start = scanner.pos;
  const line = scanner.line;
  const column = scanner.column;

  scanner.advance();
  while (!scanner.eof() && isIdentPart(scanner.peek())) {
    scanner.advance();
  }

  const value = scanner.slice(start, scanner.pos);
  const type: TokenType = KEYWORDS.has(value.toUpperCase())
    ? "keyword"
    : "identifier";

  return { type, value, start, end: scanner.pos, line, column };
};

const readParameter = (scanner: Scanner): Token => {
  // Covers `?`, `:name`, `@name`, `@@name` (T-SQL system vars/functions),
  // and `$1`/`$2` positional parameters (Postgres).
  const start = scanner.pos;
  const line = scanner.line;
  const column = scanner.column;

  const marker = scanner.peek();
  scanner.advance();

  if (marker === "@" && scanner.peek() === "@") {
    scanner.advance();
  }

  if (marker === "$") {
    while (!scanner.eof() && isDigit(scanner.peek())) {
      scanner.advance();
    }
  } else {
    while (!scanner.eof() && isIdentPart(scanner.peek())) {
      scanner.advance();
    }
  }

  return {
    type: "parameter",
    value: scanner.slice(start, scanner.pos),
    start,
    end: scanner.pos,
    line,
    column,
  };
};

const readOperatorOrPunctuation = (scanner: Scanner): Token => {
  const start = scanner.pos;
  const line = scanner.line;
  const column = scanner.column;

  for (const op of OPERATORS) {
    if (scanner.slice(scanner.pos, scanner.pos + op.length) === op) {
      scanner.advance(op.length);
      return {
        type: "operator",
        value: op,
        start,
        end: scanner.pos,
        line,
        column,
      };
    }
  }

  const ch = scanner.peek();

  if (PUNCTUATION.has(ch)) {
    scanner.advance();
    return {
      type: "punctuation",
      value: ch,
      start,
      end: scanner.pos,
      line,
      column,
    };
  }

  scanner.advance();
  return {
    type: "unknown",
    value: ch,
    start,
    end: scanner.pos,
    line,
    column,
  };
};

export const tokenize = (src: string): Token[] => {
  const scanner = new Scanner(src);
  const tokens: Token[] = [];

  while (!scanner.eof()) {
    const ch = scanner.peek();

    if (/\s/.test(ch)) {
      tokens.push(readWhitespace(scanner));
      continue;
    }

    if (ch === "-" && scanner.peek(1) === "-") {
      tokens.push(readLineComment(scanner, 2));
      continue;
    }

    if (ch === "#") {
      // MySQL/PostgreSQL(psql meta) style line comment. Only treated as a
      // comment when not immediately part of an identifier (e.g. `#temp`
      // in T-SQL is a table name, so this only fires at token boundaries,
      // which is guaranteed here since identifiers are consumed whole).
      tokens.push(readLineComment(scanner, 1));
      continue;
    }

    if (ch === "/" && scanner.peek(1) === "*") {
      tokens.push(readBlockComment(scanner));
      continue;
    }

    if (ch === "'") {
      tokens.push(readQuoted(scanner, "'", "string", true));
      continue;
    }

    if (ch === '"') {
      tokens.push(readQuoted(scanner, '"', "quoted_identifier", false));
      continue;
    }

    if (ch === "`") {
      tokens.push(readQuoted(scanner, "`", "quoted_identifier", false));
      continue;
    }

    if (ch === "[") {
      tokens.push(readBracketIdentifier(scanner));
      continue;
    }

    // National character string literals: N'...', and dialect string
    // prefixes like E'...' (Postgres escape strings), B'...'/X'...' (bit /
    // hex strings, MySQL & Postgres).
    if (
      /[nNeEbBxXuU]/.test(ch) &&
      scanner.peek(1) === "'" &&
      !isIdentPart(scanner.peek(-1))
    ) {
      const start = scanner.pos;
      const line = scanner.line;
      const column = scanner.column;
      scanner.advance(); // prefix letter
      const stringToken = readQuoted(scanner, "'", "string", true);
      tokens.push({
        ...stringToken,
        value: scanner.slice(start, stringToken.end),
        start,
        line,
        column,
      });
      continue;
    }

    if (ch === "$") {
      const tag = matchDollarTag(scanner, 0);
      if (tag !== null) {
        tokens.push(readDollarString(scanner, tag));
        continue;
      }

      if (isDigit(scanner.peek(1))) {
        tokens.push(readParameter(scanner));
        continue;
      }
    }

    if (
      ch === ":" &&
      scanner.peek(1) !== ":" &&
      isIdentStart(scanner.peek(1))
    ) {
      tokens.push(readParameter(scanner));
      continue;
    }

    if (ch === "@") {
      tokens.push(readParameter(scanner));
      continue;
    }

    if (ch === "?") {
      // Bare `?` positional placeholder vs. Postgres JSON operators (`?|`,
      // `?&`) or regex match (`~*` handled separately); operator table
      // already matches the multi-char forms first.
      if (/[|&]/.test(scanner.peek(1))) {
        tokens.push(readOperatorOrPunctuation(scanner));
        continue;
      }
      tokens.push(readParameter(scanner));
      continue;
    }

    if (isDigit(ch) || (ch === "." && isDigit(scanner.peek(1)))) {
      tokens.push(readNumber(scanner));
      continue;
    }

    if (isIdentStart(ch)) {
      tokens.push(readIdentifier(scanner));
      continue;
    }

    tokens.push(readOperatorOrPunctuation(scanner));
  }

  return tokens;
};
