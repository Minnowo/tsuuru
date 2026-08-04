// SQL pretty-printer built on top of ./tokenizer. This is not a full parser -
// it only understands parenthesis nesting and CASE...END blocks, which is
// enough to make sensible indentation decisions without needing to know the
// full grammar of every dialect.

import { tokenize, type Token, type TokenType } from "./tokenizer";

export type KeywordCase = "upper" | "lower" | "preserve";

export type FormatterOptions = {
  // 1. Keyword casing.
  keywordCase: KeywordCase;

  indentSize: number;
  indentChar: " " | "\t";

  // Parenthesized groups (and CASE blocks) that would render inline wider
  // than this are broken onto multiple lines.
  maxInlineWidth: number;

  // 4. Collapse CASE...END onto a single line instead of breaking at
  // WHEN/ELSE/END.
  collapseCaseStatements: boolean;

  // 5. Strip `--` (and `#`) line comments from the output entirely.
  removeLineComments: boolean;

  // Strip /* ... */ block comments from the output entirely.
  removeBlockComments: boolean;

  // Blank lines to leave between top-level `;`-separated statements.
  linesBetweenStatements: number;

  // Force every statement to end with `;`, even if the input omitted it.
  trailingSemicolon: boolean;

  // Always put a JOIN's ON condition on its own line, aligned with the
  // JOIN, instead of only doing so for nested/grouped join chains.
  alwaysBreakOn: boolean;

  // Always put each SELECT column on its own line, comma-first, instead of
  // keeping the column list inline.
  expandSelectColumns: boolean;

  // If > 0, a SELECT whose column list would render inline wider than this
  // gets the same comma-first, one-column-per-line layout as
  // expandSelectColumns - but decided per-statement, not globally. 0 disables
  // this (the default).
  selectColumnsMaxWidth: number;

  // Put a blank line before every JOIN (including the first one, right
  // after FROM), to visually separate a chain of joins.
  spaceBetweenJoins: boolean;
};

export const DEFAULT_OPTIONS: FormatterOptions = {
  keywordCase: "upper",
  indentSize: 2,
  indentChar: " ",
  maxInlineWidth: 120,
  collapseCaseStatements: false,
  removeLineComments: false,
  removeBlockComments: false,
  linesBetweenStatements: 1,
  trailingSemicolon: false,
  alwaysBreakOn: false,
  expandSelectColumns: false,
  selectColumnsMaxWidth: 50,
  spaceBetweenJoins: false,
};

// --- tree building --------------------------------------------------------
//
// Turns the flat token stream into a tree of plain tokens, parenthesized
// groups, and CASE...END blocks. This is the structure the printer walks;
// building it up front lets us compute "does this group need to break onto
// multiple lines" bottom-up before printing a single character.

type TokenNode = { kind: "token"; token: Token };
type ParenNode = {
  kind: "paren";
  children: Node[];
  multiline: boolean;
};
type CaseNode = {
  kind: "case";
  children: Node[];
  multiline: boolean;
};
type Node = TokenNode | ParenNode | CaseNode;

const upper = (token: Token) => token.value.toUpperCase();
const isKeyword = (token: Token, word: string) =>
  token.type === "keyword" && upper(token) === word;
const isPunct = (token: Token, value: string) =>
  token.type === "punctuation" && token.value === value;

const buildTree = (tokens: Token[]): Node[] => {
  let i = 0;

  const parseNode = (): Node => {
    const token = tokens[i];

    if (isPunct(token, "(")) {
      i++;
      const children: Node[] = [];
      while (i < tokens.length && !isPunct(tokens[i], ")")) {
        children.push(parseNode());
      }
      if (i < tokens.length) {
        i++; // consume ")"
      }
      return { kind: "paren", children, multiline: false };
    }

    if (isKeyword(token, "CASE")) {
      const children: Node[] = [{ kind: "token", token }];
      i++;
      while (i < tokens.length) {
        const cur = tokens[i];

        if (isKeyword(cur, "CASE") || isPunct(cur, "(")) {
          children.push(parseNode());
          continue;
        }

        if (isKeyword(cur, "END")) {
          children.push({ kind: "token", token: cur });
          i++;
          break;
        }

        children.push({ kind: "token", token: cur });
        i++;
      }
      return { kind: "case", children, multiline: false };
    }

    i++;
    return { kind: "token", token };
  };

  const nodes: Node[] = [];
  while (i < tokens.length) {
    nodes.push(parseNode());
  }
  return nodes;
};

// --- layout -----------------------------------------------------------
//
// Bottom-up pass that decides which paren groups / CASE blocks must break
// onto multiple lines. A group is forced multiline if it (directly)
// contains a keyword that structurally requires a line break (SELECT, JOIN,
// AND, OR, ...), if any of its children are themselves forced multiline, or
// if its inline rendering would exceed maxInlineWidth.

const FORCE_BREAK_KEYWORDS = new Set([
  "SELECT",
  "JOIN",
  "UNION",
  "INTERSECT",
  "EXCEPT",
  "AND",
  "OR",
]);

const layout = (node: Node, opts: FormatterOptions): number => {
  if (node.kind === "token") {
    return node.token.value.length;
  }

  if (node.kind === "paren") {
    let width = 2; // "(" + ")"
    let forced = false;

    for (const child of node.children) {
      width += layout(child, opts) + 1;

      if (child.kind !== "token" && child.multiline) {
        forced = true;
      }
      if (
        child.kind === "token" &&
        child.token.type === "keyword" &&
        FORCE_BREAK_KEYWORDS.has(upper(child.token))
      ) {
        forced = true;
      }
      if (
        child.kind === "token" &&
        (child.token.type === "line_comment" || child.token.type === "block_comment")
      ) {
        forced = true;
      }
    }

    if (width > opts.maxInlineWidth) {
      forced = true;
    }

    node.multiline = forced;
    return forced ? Infinity : width;
  }

  // CASE block.
  let width = 0;
  let childForced = false;
  for (const child of node.children) {
    width += layout(child, opts) + 1;
    if (child.kind !== "token" && child.multiline) {
      childForced = true;
    }
  }

  node.multiline = !opts.collapseCaseStatements || childForced;
  return node.multiline ? Infinity : width;
};

// --- printer ------------------------------------------------------------

type LastKind = "identifier" | "quoted_identifier" | "close_paren" | "other" | null;

class Printer {
  lines: string[] = [];
  current = "";
  suppressSpace = true;
  lastKind: LastKind = null;
  // Whether the last thing printed was a complete value (identifier, number,
  // string, closing paren, ...) as opposed to a keyword/operator/punctuation.
  // Used to tell a unary +/- from a binary one.
  lastWasValue = false;
  indentUnit: string;

  constructor(opts: FormatterOptions) {
    this.indentUnit = opts.indentChar.repeat(opts.indentSize);
  }

  private indentStr(level: number): string {
    return this.indentUnit.repeat(Math.max(level, 0));
  }

  breakLine(level: number) {
    this.lines.push(this.current.replace(/[ \t]+$/, ""));
    this.current = this.indentStr(level);
    this.suppressSpace = true;
  }

  ensureBreak(level: number) {
    if (this.current.trim() !== "") {
      this.breakLine(level);
    } else {
      this.current = this.indentStr(level);
    }
  }

  // Leaves a single blank line before whatever gets written next, unless
  // we're at the very start of the output or already just after one.
  blankLine() {
    if (this.current.trim() !== "") {
      this.lines.push(this.current.replace(/[ \t]+$/, ""));
      this.current = "";
    }
    if (this.lines.length > 0 && this.lines[this.lines.length - 1] !== "") {
      this.lines.push("");
    }
    this.suppressSpace = true;
  }

  write(text: string, opts: { spaceBefore?: boolean } = {}) {
    const spaceBefore = opts.spaceBefore ?? true;

    if (
      spaceBefore &&
      !this.suppressSpace &&
      this.current !== "" &&
      !/\s$/.test(this.current)
    ) {
      this.current += " ";
    }

    this.current += text;
    this.suppressSpace = false;
  }

  finish(): string {
    this.lines.push(this.current.replace(/[ \t]+$/, ""));
    return this.lines.join("\n").replace(/[ \t]+$/gm, "");
  }
}

const renderKeyword = (value: string, opts: FormatterOptions): string => {
  if (opts.keywordCase === "upper") return value.toUpperCase();
  if (opts.keywordCase === "lower") return value.toLowerCase();
  return value;
};

// Value-producing token types: things a following unary +/- should treat as
// "there's already an operand here", i.e. a binary +/- context.
const isValueTokenType = (type: TokenType): boolean =>
  type === "identifier" ||
  type === "quoted_identifier" ||
  type === "number" ||
  type === "string" ||
  type === "dollar_string" ||
  type === "parameter";

const printPlainToken = (p: Printer, token: Token, opts: FormatterOptions) => {
  const text = token.type === "keyword" ? renderKeyword(token.value, opts) : token.value;

  if (isPunct(token, ",") || isPunct(token, ";")) {
    p.write(text, { spaceBefore: false });
    p.lastKind = "other";
    p.lastWasValue = false;
    return;
  }

  if (isPunct(token, ")")) {
    p.write(text, { spaceBefore: false });
    p.lastKind = "other";
    p.lastWasValue = true;
    return;
  }

  if (isPunct(token, ".")) {
    p.write(text, { spaceBefore: false });
    p.suppressSpace = true; // no space before the following token either
    p.lastKind = "other";
    return;
  }

  if (token.type === "operator" && token.value === "::") {
    p.write(text, { spaceBefore: false });
    p.suppressSpace = true;
    p.lastKind = "other";
    return;
  }

  // A +/- not following a value (start of expression, after a keyword,
  // comma, or open paren) is unary: no space between it and its operand.
  if (
    token.type === "operator" &&
    (token.value === "+" || token.value === "-") &&
    !p.lastWasValue
  ) {
    p.write(text);
    p.suppressSpace = true;
    p.lastKind = "other";
    p.lastWasValue = false;
    return;
  }

  p.write(text);

  if (token.type === "line_comment") {
    p.lastKind = "other";
    p.lastWasValue = false;
    return;
  }

  p.lastKind =
    token.type === "identifier"
      ? "identifier"
      : token.type === "quoted_identifier"
        ? "quoted_identifier"
        : "other";
  p.lastWasValue = isValueTokenType(token.type);
};

const printChildrenInline = (p: Printer, nodes: Node[], opts: FormatterOptions) => {
  for (const node of nodes) {
    printNode(p, node, 0, opts);
  }
};

const printParen = (p: Printer, node: ParenNode, indentLevel: number, opts: FormatterOptions) => {
  const noSpaceBefore =
    p.lastKind === "identifier" ||
    p.lastKind === "quoted_identifier" ||
    p.lastKind === "close_paren";

  p.write("(", { spaceBefore: !noSpaceBefore });
  p.suppressSpace = true;

  if (node.multiline) {
    p.breakLine(indentLevel + 1);
    printChildren(p, node.children, indentLevel + 1, opts);
    p.breakLine(indentLevel);
    p.write(")", { spaceBefore: false });
  } else {
    printChildrenInline(p, node.children, opts);
    p.write(")", { spaceBefore: false });
  }

  p.lastKind = "close_paren";
  p.lastWasValue = true;
};

const printCase = (p: Printer, node: CaseNode, indentLevel: number, opts: FormatterOptions) => {
  if (!node.multiline) {
    printChildrenInline(p, node.children, opts);
    p.lastKind = "other";
    p.lastWasValue = true;
    return;
  }

  for (const child of node.children) {
    if (child.kind === "token") {
      const kw = child.token.type === "keyword" ? upper(child.token) : "";

      if (kw === "WHEN" || kw === "ELSE") {
        p.ensureBreak(indentLevel + 1);
        printPlainToken(p, child.token, opts);
        continue;
      }

      if (kw === "END") {
        p.ensureBreak(indentLevel);
        printPlainToken(p, child.token, opts);
        continue;
      }

      printPlainToken(p, child.token, opts);
      continue;
    }

    printNode(p, child, indentLevel + 1, opts);
  }

  p.lastKind = "other";
  p.lastWasValue = true;
};

const printNode = (p: Printer, node: Node, indentLevel: number, opts: FormatterOptions) => {
  if (node.kind === "token") {
    printPlainToken(p, node.token, opts);
    return;
  }
  if (node.kind === "paren") {
    printParen(p, node, indentLevel, opts);
    return;
  }
  printCase(p, node, indentLevel, opts);
};

// Keywords that always start a new line at the clause's own indent level.
const CLAUSE_START = new Set([
  "SELECT",
  "FROM",
  "WHERE",
  "HAVING",
  "LIMIT",
  "OFFSET",
  "UNION",
  "INTERSECT",
  "EXCEPT",
  "INSERT",
  "UPDATE",
  "DELETE",
  "VALUES",
  "SET",
  "RETURNING",
  "WITH",
  "WINDOW",
  "GROUP",
  "ORDER",
]);

// JOIN and its modifiers (LEFT OUTER JOIN, INNER JOIN, ...) are treated as a
// single phrase: the break happens before the first modifier, not before
// JOIN itself.
const JOIN_MODIFIERS = new Set(["LEFT", "RIGHT", "FULL", "INNER", "CROSS", "NATURAL", "OUTER"]);

// Keywords that, if present anywhere in a statement, keep it in the
// clause-by-clause layout even if it would otherwise be short enough to
// collapse onto a single line.
const NEVER_INLINE_STATEMENT_KEYWORDS = new Set([
  "JOIN",
  "AND",
  "OR",
  "UNION",
  "INTERSECT",
  "EXCEPT",
]);

// A chain of JOINs can be written with each ON matching the *nearest*
// unmatched preceding JOIN (like balanced brackets), e.g.
// `JOIN a JOIN b JOIN c ON b=c ON a=b`. When that nesting actually happens
// (more than one JOIN pending at once) we lay out the whole chain with one
// JOIN/ON per line, indented by nesting depth, rather than the usual
// `JOIN x ON y` single-line form.
type JoinEvent = { kind: "join" | "on"; depth: number; stacked: boolean };

const planJoins = (nodes: Node[]): JoinEvent[] => {
  const events: JoinEvent[] = [];
  let stackSize = 0;
  let inPhrase = false;
  let stretchStart = 0;
  let maxDepth = 0;

  const closeStretch = () => {
    const stacked = maxDepth >= 2;
    for (let k = stretchStart; k < events.length; k++) {
      events[k].stacked = stacked;
    }
    stretchStart = events.length;
    maxDepth = 0;
  };

  for (const node of nodes) {
    if (node.kind !== "token") {
      inPhrase = false;
      continue;
    }

    const token = node.token;
    if (token.type !== "keyword") {
      continue;
    }

    const kw = upper(token);

    if (JOIN_MODIFIERS.has(kw) || kw === "JOIN") {
      if (!inPhrase) {
        events.push({ kind: "join", depth: stackSize, stacked: false });
        stackSize++;
        maxDepth = Math.max(maxDepth, stackSize);
        inPhrase = true;
      }
      if (kw === "JOIN") {
        inPhrase = false;
      }
      continue;
    }

    inPhrase = false;

    if (kw === "ON" && stackSize > 0) {
      stackSize--;
      events.push({ kind: "on", depth: stackSize, stacked: false });
      if (stackSize === 0) {
        closeStretch();
      }
    }
  }

  if (events.length > stretchStart) {
    closeStretch();
  }

  return events;
};

// Consumes a comma-separated list of items (a SELECT column list, or an
// old-style comma-joined FROM list) starting at `startIdx`, splitting on
// top-level commas and stopping at the first token whose keyword is in
// `stopKeywords`. Returns the collected items and the index of the first
// unconsumed node.
const collectCommaItems = (
  nodes: Node[],
  startIdx: number,
  stopKeywords: Set<string>,
): { items: Node[][]; endIdx: number } => {
  let idx = startIdx;
  const items: Node[][] = [[]];

  while (idx < nodes.length) {
    const node = nodes[idx];

    if (node.kind === "token") {
      const token = node.token;

      if (token.type === "keyword" && stopKeywords.has(upper(token))) {
        break;
      }

      if (isPunct(token, ",")) {
        items.push([]);
        idx++;
        continue;
      }
    }

    items[items.length - 1].push(node);
    idx++;
  }

  return { items: items.filter((item) => item.length > 0), endIdx: idx };
};

// Approximate inline width of a comma-separated item list (as if rendered
// "item1, item2, item3"), used to decide whether selectColumnsMaxWidth is
// exceeded. Matches the same rough per-node "+1 for a separator" style used
// elsewhere (layout(), isSimpleSelectFromBranch's width check).
const commaListWidth = (items: Node[][], opts: FormatterOptions): number => {
  let width = 0;
  items.forEach((item, i) => {
    if (i > 0) width += 2; // ", "
    for (const node of item) {
      width += (node.kind === "token" ? node.token.value.length : layout(node, opts)) + 1;
    }
  });
  return width;
};

// Whether a SELECT's column list should get the expandSelectColumns
// (one-per-line, comma-first) treatment: either the option is on globally,
// or selectColumnsMaxWidth is set and this particular column list is wider
// than it.
const shouldExpandColumns = (items: Node[][], opts: FormatterOptions): boolean =>
  opts.expandSelectColumns ||
  (opts.selectColumnsMaxWidth > 0 && commaListWidth(items, opts) > opts.selectColumnsMaxWidth);

// Whether the first top-level SELECT's column list would trigger
// shouldExpandColumns. Used to keep a would-otherwise-collapse-to-one-line
// top-level statement from bypassing printChildren (and so the
// expandSelectColumns/selectColumnsMaxWidth column layout) entirely.
const topLevelSelectColumnsWouldExpand = (tree: Node[], opts: FormatterOptions): boolean => {
  const selectIdx = tree.findIndex((n) => n.kind === "token" && isKeyword(n.token, "SELECT"));
  if (selectIdx === -1) return false;

  let i = selectIdx + 1;
  if (i < tree.length) {
    const first = tree[i];
    if (first.kind === "token" && first.token.type === "block_comment") return false;
    if (first.kind === "token" && isKeyword(first.token, "DISTINCT")) i++;
  }

  const { items } = collectCommaItems(tree, i, CLAUSE_START);
  return items.length > 1 && shouldExpandColumns(items, opts);
};

// Prints a comma-first list, one item per line. The first item is indented
// one level past `indentLevel`; continuation lines dedent by 2 characters so
// the leading "," lines up with, and the item content after it starts at,
// the same column as the first item.
const printCommaFirstList = (
  p: Printer,
  items: Node[][],
  indentLevel: number,
  opts: FormatterOptions,
) => {
  items.forEach((item, i) => {
    p.ensureBreak(indentLevel + 1);
    if (i > 0) {
      p.current = p.current.slice(0, Math.max(0, p.current.length - 2));
      p.write(",", { spaceBefore: false });
    }
    for (const itemNode of item) {
      printNode(p, itemNode, indentLevel + 1, opts);
    }
  });
};

// Keywords that end a FROM target / SELECT column run - anything beyond
// these means the simple comma-list reading doesn't apply.
const FROM_STOP_KEYWORDS = new Set<string>([
  ...CLAUSE_START,
  "JOIN",
  "LEFT",
  "RIGHT",
  "FULL",
  "INNER",
  "CROSS",
  "NATURAL",
  "OUTER",
  "ON",
  "AND",
  "OR",
]);

// Keywords whose presence marks a node list as "statement-like" (a clause
// list containing SELECT/FROM/WHERE/JOIN/... boundaries) rather than a bare
// boolean condition (the direct children of a WHERE/ON/AND paren).
const CLAUSE_KEYWORDS = new Set<string>([...CLAUSE_START, "JOIN", "LEFT", "RIGHT", "FULL", "INNER", "CROSS", "NATURAL", "OUTER", "ON"]);

const hasClauseKeyword = (nodes: Node[]): boolean =>
  nodes.some(
    (n) => n.kind === "token" && n.token.type === "keyword" && CLAUSE_KEYWORDS.has(upper(n.token)),
  );

// Decides, for every top-level AND/OR token in `nodes`, whether it should
// align flush with the enclosing clause/paren or be indented one level in.
//
// - An AND/OR immediately preceded by a closing paren always aligns flush
//   with the paren it follows (the parens already provide visual grouping).
// - Otherwise, inside a bare boolean-condition scope (no clause/JOIN
//   keywords in `nodes`), a lone AND/OR stays flush too; a run of 2+
//   chained AND/OR indents the whole run one level in, to set the list
//   apart from a single compound comparison.
// - Inside a statement-like scope (WHERE/JOIN/... present directly in
//   `nodes`), AND/OR always indents one level in, regardless of chain
//   length - this is the common `WHERE a = 1\n  AND b = 2` shape.
const planAndOrIndent = (nodes: Node[]): Map<number, "flush" | "bump"> => {
  const chainLengthMatters = !hasClauseKeyword(nodes);
  const result = new Map<number, "flush" | "bump">();
  let group: number[] = [];
  let prevWasParen = false;
  let pendingBetween = false;

  const flushGroup = () => {
    const mode: "flush" | "bump" = chainLengthMatters && group.length < 2 ? "flush" : "bump";
    for (const i of group) result.set(i, mode);
    group = [];
  };

  for (let k = 0; k < nodes.length; k++) {
    const node = nodes[k];

    if (node.kind !== "token") {
      prevWasParen = true;
      continue;
    }

    const token = node.token;
    if (token.type !== "keyword") {
      prevWasParen = false;
      continue;
    }

    const kw = upper(token);

    if (kw === "BETWEEN") {
      pendingBetween = true;
      prevWasParen = false;
      continue;
    }

    if (kw === "AND" || kw === "OR") {
      if (pendingBetween) {
        pendingBetween = false;
      } else if (prevWasParen) {
        flushGroup();
        result.set(k, "flush");
      } else {
        group.push(k);
      }
      prevWasParen = false;
      continue;
    }

    if (CLAUSE_KEYWORDS.has(kw)) {
      flushGroup();
    }
    prevWasParen = false;
  }

  flushGroup();
  return result;
};

// Finds the end of the current SELECT branch: the next top-level
// UNION/INTERSECT/EXCEPT keyword, or the end of `nodes`.
const findBranchEnd = (nodes: Node[], startIdx: number): number => {
  for (let i = startIdx; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.kind === "token" && node.token.type === "keyword") {
      const kw = upper(node.token);
      if (kw === "UNION" || kw === "INTERSECT" || kw === "EXCEPT") {
        return i;
      }
    }
  }
  return nodes.length;
};

// A branch collapses onto a single line when it's nothing more than
// `SELECT <cols> FROM <table>` - no WHERE/GROUP/JOIN/..., no oracle hint
// comment, nothing forced multiline, and it fits within maxInlineWidth.
const isSimpleSelectFromBranch = (
  nodes: Node[],
  selectIdx: number,
  branchEnd: number,
  opts: FormatterOptions,
): boolean => {
  let i = selectIdx + 1;

  if (i < branchEnd) {
    const first = nodes[i];
    if (first.kind === "token" && first.token.type === "block_comment") {
      return false; // oracle hint always forces a break
    }
    if (first.kind === "token" && isKeyword(first.token, "DISTINCT")) {
      i++;
    }
  }

  const { items: columnItems, endIdx: afterColumns } = collectCommaItems(nodes, i, CLAUSE_START);
  for (const item of columnItems) {
    for (const node of item) {
      if (
        node.kind === "token" &&
        (node.token.type === "line_comment" || node.token.type === "block_comment")
      ) {
        return false;
      }
      if (node.kind !== "token" && node.multiline) return false;
    }
  }

  // With expandSelectColumns (or selectColumnsMaxWidth) triggering, multiple
  // columns must each get their own line - only a single column is short
  // enough to merge onto the FROM line too. Otherwise columns already stay
  // inline regardless of count.
  if (columnItems.length > 1 && shouldExpandColumns(columnItems, opts)) return false;

  i = afterColumns;
  if (i >= branchEnd || !(nodes[i].kind === "token" && isKeyword((nodes[i] as TokenNode).token, "FROM"))) {
    return false; // no FROM directly after the column list
  }
  i++; // consume FROM
  if (i >= branchEnd) return false; // FROM with no target

  while (i < branchEnd) {
    const node = nodes[i];
    if (node.kind === "token") {
      const token = node.token;
      if (isPunct(token, ",")) return false; // multi-table FROM
      if (token.type === "keyword" && upper(token) !== "AS") return false;
      if (token.type === "line_comment" || token.type === "block_comment") return false;
    } else if (node.multiline) {
      return false;
    }
    i++;
  }

  if (i !== branchEnd) return false;

  let width = 0;
  for (let k = selectIdx; k < branchEnd; k++) {
    const node = nodes[k];
    width += (node.kind === "token" ? node.token.value.length : layout(node, opts)) + 1;
  }
  return width <= opts.maxInlineWidth;
};

const printChildren = (p: Printer, nodes: Node[], indentLevel: number, opts: FormatterOptions) => {
  let inJoinPhrase = false;
  let betweenPending = false;
  let lastKeyword = "";
  let lineIndent = indentLevel;
  // The indent level of the clause/JOIN/ON that AND/OR conditions attach to
  // (as opposed to `lineIndent`, which tracks whatever line we're currently
  // on - those diverge once an AND/OR has broken onto its own line).
  let clauseBaseIndent = indentLevel;
  let pendingJoins = 0;
  let joinEventIndex = 0;
  const joinEvents = planJoins(nodes);
  const andOrPlan = planAndOrIndent(nodes);

  let idx = 0;
  while (idx < nodes.length) {
    const node = nodes[idx];
    idx++;

    if (node.kind !== "token") {
      printNode(p, node, lineIndent, opts);
      inJoinPhrase = false;
      lastKeyword = "";
      continue;
    }

    const token = node.token;

    if (token.type === "keyword") {
      const kw = upper(token);

      if (kw === "SELECT") {
        lineIndent = indentLevel;
        clauseBaseIndent = indentLevel;
        p.ensureBreak(indentLevel);

        const branchEnd = findBranchEnd(nodes, idx);
        if (isSimpleSelectFromBranch(nodes, idx - 1, branchEnd, opts)) {
          for (let k = idx - 1; k < branchEnd; k++) {
            printNode(p, nodes[k], lineIndent, opts);
          }
          idx = branchEnd;
          inJoinPhrase = false;
          lastKeyword = "";
          continue;
        }

        printPlainToken(p, token, opts);
        lastKeyword = kw;

        // An oracle-hint block comment right after SELECT stays on the
        // SELECT line; everything else (DISTINCT, columns) is then forced
        // onto its own line, since nothing may share a line with the hint.
        let hasHint = false;
        if (idx < nodes.length) {
          const hintNode = nodes[idx];
          if (hintNode.kind === "token" && hintNode.token.type === "block_comment") {
            printPlainToken(p, hintNode.token, opts);
            idx++;
            hasHint = true;
          }
        }

        if (idx < nodes.length) {
          const distinctNode = nodes[idx];
          if (distinctNode.kind === "token" && isKeyword(distinctNode.token, "DISTINCT")) {
            if (hasHint) {
              p.ensureBreak(indentLevel + 1);
            }
            printPlainToken(p, distinctNode.token, opts);
            idx++;
          }
        }

        {
          const { items, endIdx } = collectCommaItems(nodes, idx, CLAUSE_START);
          if (items.length > 0) {
            if (items.length === 1 && !hasHint) {
              for (const itemNode of items[0]) {
                printNode(p, itemNode, indentLevel, opts);
              }
            } else if (shouldExpandColumns(items, opts)) {
              printCommaFirstList(p, items, indentLevel, opts);
            } else {
              // Stays inline with SELECT, unless a hint comment already
              // forced a break onto a fresh indented line.
              const itemIndent = hasHint ? indentLevel + 1 : indentLevel;
              if (hasHint) p.ensureBreak(itemIndent);
              items.forEach((item, i) => {
                if (i > 0) p.write(",", { spaceBefore: false });
                for (const itemNode of item) {
                  printNode(p, itemNode, itemIndent, opts);
                }
              });
            }
          } else if (hasHint) {
            p.ensureBreak(indentLevel + 1);
          }
          idx = endIdx;
        }
        continue;
      }

      if (JOIN_MODIFIERS.has(kw) || kw === "JOIN") {
        if (!inJoinPhrase) {
          const event = joinEvents[joinEventIndex++];
          const depth = event.stacked ? event.depth : 0;
          lineIndent = indentLevel + depth;
          clauseBaseIndent = lineIndent;
          if (opts.spaceBetweenJoins) {
            p.blankLine();
          }
          p.ensureBreak(lineIndent);
          pendingJoins++;
          inJoinPhrase = true;
        }
        printPlainToken(p, token, opts);
        if (kw === "JOIN") {
          inJoinPhrase = false;
        }
        lastKeyword = kw;
        continue;
      }

      inJoinPhrase = false;

      if (kw === "ON" && pendingJoins > 0) {
        const event = joinEvents[joinEventIndex++];
        pendingJoins--;
        if (event.stacked || opts.alwaysBreakOn) {
          const depth = event.stacked ? event.depth : 0;
          lineIndent = indentLevel + depth;
          clauseBaseIndent = lineIndent;
          p.ensureBreak(lineIndent);
        }
        printPlainToken(p, token, opts);
        lastKeyword = kw;
        continue;
      }

      if (kw === "AND" || kw === "OR") {
        if (betweenPending) {
          betweenPending = false;
        } else {
          const mode = andOrPlan.get(idx - 1) ?? "bump";
          lineIndent = mode === "flush" ? clauseBaseIndent : clauseBaseIndent + 1;
          p.ensureBreak(lineIndent);
        }
        printPlainToken(p, token, opts);
        lastKeyword = kw;
        continue;
      }

      if (kw === "BETWEEN") {
        betweenPending = true;
        printPlainToken(p, token, opts);
        lastKeyword = kw;
        continue;
      }

      // Keep "DELETE FROM" on one line rather than breaking before FROM.
      if (kw === "FROM" && lastKeyword === "DELETE") {
        printPlainToken(p, token, opts);
        lastKeyword = kw;
        continue;
      }

      if (kw === "FROM") {
        lineIndent = indentLevel;
        clauseBaseIndent = indentLevel;
        p.ensureBreak(indentLevel);
        printPlainToken(p, token, opts);
        lastKeyword = kw;

        // Old-style comma-joined FROM lists get one table per line,
        // comma-first, like an expanded SELECT column list. A single
        // target (the common case) stays inline on the FROM line.
        const { items, endIdx } = collectCommaItems(nodes, idx, FROM_STOP_KEYWORDS);
        if (items.length > 1) {
          printCommaFirstList(p, items, indentLevel, opts);
          idx = endIdx;
        }
        continue;
      }

      if (CLAUSE_START.has(kw)) {
        lineIndent = indentLevel;
        clauseBaseIndent = indentLevel;
        p.ensureBreak(indentLevel);
        printPlainToken(p, token, opts);
        lastKeyword = kw;
        continue;
      }

      printPlainToken(p, token, opts);
      lastKeyword = kw;
      continue;
    }

    inJoinPhrase = false;
    lastKeyword = "";

    printPlainToken(p, token, opts);

    if (token.type === "line_comment") {
      // Nothing may follow a line comment on the same source line.
      p.ensureBreak(lineIndent);
    }
  }
};

// --- entry point ----------------------------------------------------------

const splitStatements = (tokens: Token[]): Token[][] => {
  const statements: Token[][] = [];
  let current: Token[] = [];
  let depth = 0;

  for (const token of tokens) {
    if (isPunct(token, "(")) depth++;
    if (isPunct(token, ")")) depth--;

    current.push(token);

    if (isPunct(token, ";") && depth === 0) {
      statements.push(current);
      current = [];
    }
  }

  if (current.length > 0) {
    statements.push(current);
  }

  return statements;
};

export const format = (sql: string, userOptions: Partial<FormatterOptions> = {}): string => {
  const opts: FormatterOptions = { ...DEFAULT_OPTIONS, ...userOptions };

  const allTokens = tokenize(sql).filter((t) => t.type !== "whitespace");
  const tokens = allTokens.filter(
    (t) =>
      !(opts.removeLineComments && t.type === "line_comment") &&
      !(opts.removeBlockComments && t.type === "block_comment"),
  );

  const statements = splitStatements(tokens);
  const rendered: string[] = [];

  for (const statementTokens of statements) {
    let hasSemicolon = false;
    let body = statementTokens;

    const last = statementTokens[statementTokens.length - 1];
    if (last && isPunct(last, ";")) {
      hasSemicolon = true;
      body = statementTokens.slice(0, -1);
    }

    if (body.length === 0) {
      continue;
    }

    const tree = buildTree(body);
    let width = 0;
    let forced = false;
    for (const node of tree) {
      const w = layout(node, opts);
      width += w + 1;
      if (!isFinite(w)) {
        forced = true;
      }
    }

    const hasComment = body.some(
      (t) => t.type === "line_comment" || t.type === "block_comment",
    );

    // JOINs and multi-condition WHERE/ON clauses (AND/OR) benefit from
    // being visibly broken out even when short, so those always keep the
    // clause-by-clause layout. Everything else - a trivial
    // `SELECT 123 FROM DUAL` and the like - collapses onto one line when
    // it's short enough to fit.
    const hasStructuralKeyword = body.some(
      (t) =>
        t.type === "keyword" &&
        NEVER_INLINE_STATEMENT_KEYWORDS.has(t.value.toUpperCase()),
    );

    // Short statements (e.g. `SELECT 123 FROM DUAL`) read better on one
    // line than broken out clause-by-clause. Only applies when nothing in
    // the statement structurally needs its own line already.
    const canInlineStatement =
      !forced &&
      !hasComment &&
      !hasStructuralKeyword &&
      !opts.expandSelectColumns &&
      !topLevelSelectColumnsWouldExpand(tree, opts) &&
      width <= opts.maxInlineWidth;

    const printer = new Printer(opts);
    if (canInlineStatement) {
      printChildrenInline(printer, tree, opts);
    } else {
      printChildren(printer, tree, 0, opts);
    }

    if (hasSemicolon || opts.trailingSemicolon) {
      printer.write(";", { spaceBefore: false });
    }

    rendered.push(printer.finish().trim());
  }

  const separator = "\n".repeat(opts.linesBetweenStatements + 1);
  return rendered.filter(Boolean).join(separator);
};
