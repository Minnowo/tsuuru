import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { tokenize } from "./tokenizer";

const values = (src: string) => tokenize(src).map((t) => t.value);
const significant = (src: string) =>
  tokenize(src).filter((t) => t.type !== "whitespace");

describe("basic statement", () => {
  it("tokenizes a simple select", () => {
    const tokens = significant("SELECT a, b FROM t WHERE a = 1;");

    assert.deepEqual(
      tokens.map((t) => [t.type, t.value]),
      [
        ["keyword", "SELECT"],
        ["identifier", "a"],
        ["punctuation", ","],
        ["identifier", "b"],
        ["keyword", "FROM"],
        ["identifier", "t"],
        ["keyword", "WHERE"],
        ["identifier", "a"],
        ["operator", "="],
        ["number", "1"],
        ["punctuation", ";"],
      ],
    );
  });
});

describe("comments", () => {
  it("tokenizes line comments with --", () => {
    const tokens = significant("SELECT 1 -- trailing comment\nFROM t");
    assert.ok(tokens.some((t) => t.type === "line_comment"));
    assert.equal(
      tokens.find((t) => t.type === "line_comment")!.value,
      "-- trailing comment",
    );
  });

  it("tokenizes MySQL # line comments", () => {
    const tokens = significant("SELECT 1 # comment\nFROM t");
    assert.equal(
      tokens.find((t) => t.type === "line_comment")!.value,
      "# comment",
    );
  });

  it("tokenizes block comments, including nested ones", () => {
    const tokens = significant("/* outer /* inner */ still outer */ SELECT");
    assert.equal(tokens[0].type, "block_comment");
    assert.equal(
      tokens[0].value,
      "/* outer /* inner */ still outer */",
    );
  });
});

describe("string literals", () => {
  it("handles doubled single-quote escapes", () => {
    const [tok] = significant("'it''s here'");
    assert.equal(tok.type, "string");
    assert.equal(tok.value, "'it''s here'");
  });

  it("handles backslash escapes", () => {
    const [tok] = significant("'a\\'b'");
    assert.equal(tok.type, "string");
    assert.equal(tok.value, "'a\\'b'");
  });

  it("handles dialect string prefixes (N'', E'', B'', X'')", () => {
    assert.equal(significant("N'unicode'")[0].value, "N'unicode'");
    assert.equal(significant("E'esc\\n'")[0].value, "E'esc\\n'");
    assert.equal(significant("B'0101'")[0].value, "B'0101'");
    assert.equal(significant("X'1A2B'")[0].value, "X'1A2B'");
  });

  it("handles Postgres dollar-quoted strings", () => {
    const [tok] = significant("$$hello 'world'$$");
    assert.equal(tok.type, "dollar_string");
    assert.equal(tok.value, "$$hello 'world'$$");
  });

  it("handles tagged dollar-quoted strings", () => {
    const [tok] = significant("$tag$it's a string$tag$");
    assert.equal(tok.type, "dollar_string");
    assert.equal(tok.value, "$tag$it's a string$tag$");
  });
});

describe("quoted identifiers", () => {
  it("handles double-quoted identifiers with escapes", () => {
    const [tok] = significant('"my ""weird"" col"');
    assert.equal(tok.type, "quoted_identifier");
    assert.equal(tok.value, '"my ""weird"" col"');
  });

  it("handles MySQL backtick identifiers", () => {
    const [tok] = significant("`my col`");
    assert.equal(tok.type, "quoted_identifier");
    assert.equal(tok.value, "`my col`");
  });

  it("handles T-SQL bracket identifiers with ]] escape", () => {
    const [tok] = significant("[my ]]col]");
    assert.equal(tok.type, "quoted_identifier");
    assert.equal(tok.value, "[my ]]col]");
  });
});

describe("numbers", () => {
  it("tokenizes integers, decimals, and exponents", () => {
    assert.equal(significant("42")[0].value, "42");
    assert.equal(significant("3.14")[0].value, "3.14");
    assert.equal(significant(".5")[0].value, ".5");
    assert.equal(significant("1e10")[0].value, "1e10");
    assert.equal(significant("1.5e-10")[0].value, "1.5e-10");
  });

  it("tokenizes hex, binary, and octal literals", () => {
    assert.equal(significant("0xFF")[0].value, "0xFF");
    assert.equal(significant("0b1010")[0].value, "0b1010");
    assert.equal(significant("0o17")[0].value, "0o17");
  });

  it("tokenizes numbers with underscore separators", () => {
    assert.equal(significant("1_000_000")[0].value, "1_000_000");
  });
});

describe("parameters", () => {
  it("tokenizes ? placeholders", () => {
    const [tok] = significant("? ");
    assert.equal(tok.type, "parameter");
    assert.equal(tok.value, "?");
  });

  it("tokenizes :name placeholders", () => {
    const [tok] = significant(":user_id");
    assert.equal(tok.type, "parameter");
    assert.equal(tok.value, ":user_id");
  });

  it("tokenizes @name and @@name variables", () => {
    assert.equal(significant("@myvar")[0].value, "@myvar");
    assert.equal(significant("@@ROWCOUNT")[0].value, "@@ROWCOUNT");
  });

  it("tokenizes $1 positional parameters", () => {
    const [tok] = significant("$1");
    assert.equal(tok.type, "parameter");
    assert.equal(tok.value, "$1");
  });

  it("distinguishes :: cast operator from :name parameter", () => {
    const tokens = significant("a::int");
    assert.equal(tokens[1].type, "operator");
    assert.equal(tokens[1].value, "::");
  });
});

describe("operators", () => {
  it("tokenizes multi-character operators greedily", () => {
    assert.deepEqual(values("a <> b"), ["a", " ", "<>", " ", "b"]);
    assert.deepEqual(values("a ->> b"), ["a", " ", "->>", " ", "b"]);
    assert.deepEqual(values("a || b"), ["a", " ", "||", " ", "b"]);
    assert.deepEqual(values("a <=> b"), ["a", " ", "<=>", " ", "b"]);
  });

  it("tokenizes Postgres JSON operators", () => {
    assert.equal(significant("a ?| b")[1].value, "?|");
    assert.equal(significant("a ?& b")[1].value, "?&");
  });
});

describe("round-trip", () => {
  it("concatenating all token values reproduces the source exactly", () => {
    const src = `
      -- comment
      SELECT "col", t.[bracket], \`backtick\`, $$dollar$$, N'unicode'
      FROM my_table AS t
      WHERE t.id = :id AND t.val <=> NULL /* trailing */
    `;

    assert.equal(values(src).join(""), src);
  });
});
