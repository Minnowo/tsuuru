import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { format } from "./formatter";

describe("keyword case", () => {
  it("uppercases keywords by default", () => {
    assert.equal(format("select a from t"), "SELECT a FROM t");
  });

  it("lowercases keywords when configured", () => {
    assert.equal(
      format("SELECT a FROM t", { keywordCase: "lower" }),
      "select a from t",
    );
  });

  it("preserves original casing when configured", () => {
    assert.equal(
      format("SeLeCt a FrOm t", { keywordCase: "preserve" }),
      "SeLeCt a FrOm t",
    );
  });
});

describe("indentation", () => {
  it("indents a subquery join and the join nested inside it", () => {
    const sql = `
      SELECT * FROM a
      JOIN (SELECT * FROM x JOIN y ON x.id = y.id) sub ON a.id = sub.id
    `;

    assert.equal(
      format(sql),
      [
        "SELECT *",
        "FROM a",
        "JOIN (",
        "  SELECT *",
        "  FROM x",
        "  JOIN y ON x.id = y.id",
        ") sub ON a.id = sub.id",
      ].join("\n"),
    );
  });

  it("indents nested subqueries progressively deeper", () => {
    const sql =
      "SELECT * FROM (SELECT * FROM (SELECT * FROM t WHERE a = 1) x) y";

    assert.equal(
      format(sql),
      [
        "SELECT *",
        "FROM (",
        "  SELECT *",
        "  FROM (",
        "    SELECT *",
        "    FROM t",
        "    WHERE a = 1",
        "  ) x",
        ") y",
      ].join("\n"),
    );
  });

  it("keeps sequential (non-nested) joins compact, one per line", () => {
    const sql = "SELECT * FROM a JOIN b ON a.id = b.id JOIN c ON a.id = c.id";

    assert.equal(
      format(sql),
      [
        "SELECT *",
        "FROM a",
        "JOIN b ON a.id = b.id",
        "JOIN c ON a.id = c.id",
      ].join("\n"),
    );
  });

  it("expands grouped/nested joins (each ON matching the nearest unmatched JOIN) with progressive indentation", () => {
    const sql =
      "SELECT * FROM i JOIN w JOIN wil JOIN lilp ON wil.ID = lilp.ID ON w.ID = wil.ID ON w.ID = i.id";

    assert.equal(
      format(sql),
      [
        "SELECT *",
        "FROM i",
        "JOIN w",
        "  JOIN wil",
        "    JOIN lilp",
        "    ON wil.ID = lilp.ID",
        "  ON w.ID = wil.ID",
        "ON w.ID = i.id",
      ].join("\n"),
    );
  });

  it("expands a two-deep grouped join the same way", () => {
    const sql =
      "SELECT * FROM t1 JOIN t2 JOIN t3 ON t2.id = t3.id ON t1.id = t2.id";

    assert.equal(
      format(sql),
      [
        "SELECT *",
        "FROM t1",
        "JOIN t2",
        "  JOIN t3",
        "  ON t2.id = t3.id",
        "ON t1.id = t2.id",
      ].join("\n"),
    );
  });

  it("treats JOIN modifiers (LEFT OUTER JOIN, etc.) as one phrase", () => {
    const sql = "SELECT * FROM a LEFT OUTER JOIN b ON a.id = b.id";

    assert.equal(
      format(sql),
      ["SELECT *", "FROM a", "LEFT OUTER JOIN b ON a.id = b.id"].join("\n"),
    );
  });

  it("does not break simple function-call or IN-list parens", () => {
    const sql = "SELECT COUNT(a), b FROM t WHERE b IN (1, 2, 3)";

    assert.equal(format(sql), "SELECT COUNT(a), b FROM t WHERE b IN (1, 2, 3)");
  });

  it("breaks a paren once its inline width exceeds maxInlineWidth", () => {
    const sql =
      "SELECT * FROM t WHERE b IN (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15)";

    const out = format(sql, { maxInlineWidth: 40 });

    assert.ok(out.includes("IN (\n"));
    assert.ok(out.includes("  1,"));
  });
});

describe("AND / OR placement", () => {
  it("puts AND/OR at the start of new indented lines", () => {
    const sql = "SELECT * FROM t WHERE a = 1 AND b = 2 OR c = 3";

    assert.equal(
      format(sql),
      ["SELECT *", "FROM t", "WHERE a = 1", "  AND b = 2", "  OR c = 3"].join(
        "\n",
      ),
    );
  });

  it("does not break the AND inside a BETWEEN ... AND ... expression", () => {
    const sql = "SELECT * FROM t WHERE a BETWEEN 1 AND 10 AND b = 2";

    assert.equal(
      format(sql),
      ["SELECT *", "FROM t", "WHERE a BETWEEN 1 AND 10", "  AND b = 2"].join(
        "\n",
      ),
    );
  });

  it("breaks AND/OR inside a JOIN's ON condition", () => {
    const sql = "SELECT * FROM a JOIN b ON a.id = b.id AND a.x = b.y";

    assert.equal(
      format(sql),
      ["SELECT *", "FROM a", "JOIN b ON a.id = b.id", "  AND a.x = b.y"].join(
        "\n",
      ),
    );
  });
});

describe("alwaysBreakOn", () => {
  it("keeps ON inline with JOIN by default for a simple join", () => {
    assert.equal(
      format("SELECT * FROM a JOIN b ON a.id = b.id"),
      ["SELECT *", "FROM a", "JOIN b ON a.id = b.id"].join("\n"),
    );
  });

  it("always puts ON on its own line, aligned with JOIN, when enabled", () => {
    assert.equal(
      format("SELECT * FROM a JOIN b ON a.id = b.id", { alwaysBreakOn: true }),
      ["SELECT *", "FROM a", "JOIN b", "ON a.id = b.id"].join("\n"),
    );
  });

  it("still aligns ON with its own JOIN's depth in a grouped join chain", () => {
    const sql =
      "SELECT * FROM t1 JOIN t2 JOIN t3 ON t2.id = t3.id ON t1.id = t2.id";

    assert.equal(
      format(sql, { alwaysBreakOn: true }),
      [
        "SELECT *",
        "FROM t1",
        "JOIN t2",
        "  JOIN t3",
        "  ON t2.id = t3.id",
        "ON t1.id = t2.id",
      ].join("\n"),
    );
  });
});

describe("spaceBetweenJoins", () => {
  it("does not add blank lines by default", () => {
    assert.equal(
      format("SELECT * FROM a JOIN b ON a.id = b.id JOIN c ON a.id = c.id"),
      [
        "SELECT *",
        "FROM a",
        "JOIN b ON a.id = b.id",
        "JOIN c ON a.id = c.id",
      ].join("\n"),
    );
  });

  it("puts a blank line before every JOIN, including the first, when enabled", () => {
    assert.equal(
      format("SELECT * FROM a JOIN b ON a.id = b.id JOIN c ON a.id = c.id", {
        spaceBetweenJoins: true,
      }),
      [
        "SELECT *",
        "FROM a",
        "",
        "JOIN b ON a.id = b.id",
        "",
        "JOIN c ON a.id = c.id",
      ].join("\n"),
    );
  });

  it("adds one blank line per join phrase, not per JOIN modifier word", () => {
    assert.equal(
      format("SELECT * FROM a LEFT OUTER JOIN b ON a.id = b.id", {
        spaceBetweenJoins: true,
      }),
      ["SELECT *", "FROM a", "", "LEFT OUTER JOIN b ON a.id = b.id"].join("\n"),
    );
  });

  it("still separates joins nested in a grouped join chain", () => {
    const sql =
      "SELECT * FROM t1 JOIN t2 JOIN t3 ON t2.id = t3.id ON t1.id = t2.id";

    assert.equal(
      format(sql, { spaceBetweenJoins: true }),
      [
        "SELECT *",
        "FROM t1",
        "",
        "JOIN t2",
        "",
        "  JOIN t3",
        "  ON t2.id = t3.id",
        "ON t1.id = t2.id",
      ].join("\n"),
    );
  });
});

describe("expandSelectColumns", () => {
  it("keeps a simple SELECT...FROM on one line by default, even with multiple columns", () => {
    assert.equal(format("SELECT a, b, c FROM t"), "SELECT a, b, c FROM t");
  });

  it("puts each column on its own line, comma-first, when enabled", () => {
    assert.equal(
      format("SELECT a, b, c FROM t", { expandSelectColumns: true }),
      ["SELECT", "  a", ", b", ", c", "FROM t"].join("\n"),
    );
  });

  it("treats each comma-separated column as a unit, including function calls and aliases", () => {
    assert.equal(
      format("SELECT COUNT(*) AS total, a.name FROM t", {
        expandSelectColumns: true,
      }),
      ["SELECT", "  COUNT(*) AS total", ", a.name", "FROM t"].join("\n"),
    );
  });

  it("still merges a single column onto one line, even when enabled", () => {
    assert.equal(
      format("SELECT a FROM t", { expandSelectColumns: true }),
      "SELECT a FROM t",
    );
  });
});

describe("selectColumnsMaxWidth", () => {
  const sql =
    "SELECT some_long_column_name_12345679, another_long_column_name FROM some_very_long_table_name";

  it("does nothing when disabled", () => {
    assert.equal(
      format(sql, { selectColumnsMaxWidth: 0, maxInlineWidth: 80 }),
      [
        "SELECT some_long_column_name_12345679, another_long_column_name",
        "FROM some_very_long_table_name",
      ].join("\n"),
    );
  });

  it("does nothing when the column list fits within it", () => {
    assert.equal(
      format(sql, { selectColumnsMaxWidth: 200, maxInlineWidth: 80 }),
      [
        "SELECT some_long_column_name_12345679, another_long_column_name",
        "FROM some_very_long_table_name",
      ].join("\n"),
    );
  });

  it("expands columns, comma-first, once the column list exceeds it - for that statement only", () => {
    assert.equal(
      format(sql, { selectColumnsMaxWidth: 40 }),
      [
        "SELECT",
        "  some_long_column_name_12345679",
        ", another_long_column_name",
        "FROM some_very_long_table_name",
      ].join("\n"),
    );
  });

  it("does not affect other SELECTs whose columns fit", () => {
    const out = format(
      `SELECT a FROM t1 UNION ALL SELECT some_long_column_name_12345679, another_long_column_name FROM some_very_long_table_name`,
      { selectColumnsMaxWidth: 40 },
    );
    assert.ok(out.startsWith("SELECT a FROM t1\nUNION ALL"));
  });

  it("still merges a single (even very wide) column onto one line", () => {
    assert.equal(
      format("SELECT some_extremely_long_single_column_name FROM t", {
        selectColumnsMaxWidth: 5,
      }),
      "SELECT some_extremely_long_single_column_name FROM t",
    );
  });
});

describe("CASE statements", () => {
  const sql = "SELECT CASE WHEN a = 1 THEN 'x' ELSE 'y' END FROM t";

  it("breaks WHEN/ELSE/END onto separate lines by default", () => {
    assert.equal(
      format(sql),
      [
        "SELECT CASE",
        "  WHEN a = 1 THEN 'x'",
        "  ELSE 'y'",
        "END",
        "FROM t",
      ].join("\n"),
    );
  });

  it("collapses CASE onto a single line when configured", () => {
    assert.equal(
      format(sql, { collapseCaseStatements: true }),
      "SELECT CASE WHEN a = 1 THEN 'x' ELSE 'y' END FROM t",
    );
  });
});

describe("comments", () => {
  it("keeps comments by default", () => {
    const out = format("SELECT a -- keep me\nFROM t /* keep too */");
    assert.ok(out.includes("-- keep me"));
    assert.ok(out.includes("keep too"));
  });

  it("removes only line comments when removeLineComments is set", () => {
    const out = format("SELECT a -- drop me\nFROM t /* keep me */", {
      removeLineComments: true,
    });
    assert.ok(!out.includes("drop me"));
    assert.ok(out.includes("keep me"));
  });

  it("removes only block comments when removeBlockComments is set", () => {
    const out = format("SELECT a -- keep me\nFROM t /* drop me */", {
      removeBlockComments: true,
    });
    assert.ok(out.includes("keep me"));
    assert.ok(!out.includes("drop me"));
  });

  it("removes both when both are set", () => {
    const out = format("SELECT a -- drop me\nFROM t /* also drop */", {
      removeLineComments: true,
      removeBlockComments: true,
    });
    assert.ok(!out.includes("drop me"));
    assert.ok(!out.includes("also drop"));
  });
});

describe("statements", () => {
  it("separates multiple statements with the configured number of blank lines", () => {
    const out = format("SELECT a FROM t; SELECT b FROM u;", {
      linesBetweenStatements: 2,
    });

    assert.equal(
      out,
      ["SELECT a FROM t;", "", "", "SELECT b FROM u;"].join("\n"),
    );
  });

  it("adds a trailing semicolon when configured, even if absent", () => {
    assert.equal(
      format("SELECT a FROM t", { trailingSemicolon: true }),
      "SELECT a FROM t;",
    );
  });
});

describe("malformed / invalid SQL", () => {
  it("does not throw on an unterminated paren, and still formats what it can", () => {
    assert.doesNotThrow(() => format("SELECT * FROM t WHERE (a = 1 AND b = 2"));

    const out = format("SELECT * FROM t WHERE (a = 1 AND b = 2");
    assert.ok(out.includes("SELECT *"));
    assert.ok(out.includes("WHERE ("));
  });

  it("does not throw on a stray closing paren", () => {
    assert.doesNotThrow(() => format("SELECT * FROM t WHERE a = 1)"));

    const out = format("SELECT * FROM t WHERE a = 1)");
    assert.ok(out.includes("a = 1)"));
  });

  it("does not throw on an unterminated CASE", () => {
    assert.doesNotThrow(() => format("SELECT CASE WHEN a = 1 THEN 'x' FROM t"));
  });

  it("does not throw on an unterminated string", () => {
    assert.doesNotThrow(() => format("SELECT 'unterminated FROM t"));
  });

  it("does not throw on completely empty input", () => {
    assert.equal(format(""), "");
    assert.equal(format("   \n  "), "");
  });

  it("does not throw on gibberish token soup", () => {
    assert.doesNotThrow(() => format(") ( ) AND OR SELECT ( FROM"));
  });
});

describe("short statement collapsing", () => {
  it("keeps a trivial statement on a single line", () => {
    assert.equal(format("SELECT 123 FROM DUAL"), "SELECT 123 FROM DUAL");
  });

  it("collapses a short statement with a simple WHERE (no AND/OR)", () => {
    assert.equal(
      format("SELECT a FROM t WHERE a = 1"),
      "SELECT a FROM t WHERE a = 1",
    );
  });

  it("still breaks onto multiple lines once the statement exceeds maxInlineWidth", () => {
    const sql =
      "SELECT some_long_column_name, another_long_column_name FROM some_very_long_table_name";

    assert.equal(
      format(sql, { maxInlineWidth: 40 }),
      [
        "SELECT some_long_column_name, another_long_column_name",
        "FROM some_very_long_table_name",
      ].join("\n"),
    );
  });

  it("never collapses a statement containing JOIN, even if short", () => {
    const out = format("SELECT * FROM a JOIN b ON a.id = b.id");
    assert.ok(out.includes("\n"));
  });

  it("never collapses a statement containing AND/OR, even if short", () => {
    const out = format("SELECT * FROM t WHERE a = 1 AND b = 2");
    assert.ok(out.includes("\n"));
  });

  it("never collapses a statement containing a comment", () => {
    const out = format("SELECT 1 -- note\nFROM t");
    assert.ok(out.includes("\n"));
  });

  it("still collapses a single column even when expandSelectColumns is enabled", () => {
    const out = format("SELECT a FROM t", { expandSelectColumns: true });
    assert.equal(out, "SELECT a FROM t");
  });
});

describe("idempotency", () => {
  it("formatting already-formatted output leaves it unchanged", () => {
    const sql = `
      SELECT a, b
      FROM t1
      JOIN t2 ON t1.id = t2.id
      WHERE a = 1
        AND b = 2
    `;

    const once = format(sql);
    const twice = format(once);

    assert.equal(once, twice);
  });
});
