import { useState } from "preact/hooks";
import {
  format,
  DEFAULT_OPTIONS,
  type FormatterOptions,
  type KeywordCase,
} from "../sql/formatter";

const save = (key: string, value: string) => {
  sessionStorage.setItem(`sql-${key}`, value);
};
const load = (key: string): string | null => {
  return sessionStorage.getItem(`sql-${key}`);
};

export const SqlFormatPage = () => {
  const [error, setError] = useState("");
  const [input, _setInput] = useState(load("input") ?? "");
  const [output, _setOutput] = useState(load("output") ?? "");

  const [keywordCase, _setKeywordCase] = useState<KeywordCase>(
    (load("keyword-case") as KeywordCase) ?? DEFAULT_OPTIONS.keywordCase,
  );
  const [indentSize, _setIndentSize] = useState<number>(
    Number(load("indent-size") ?? DEFAULT_OPTIONS.indentSize),
  );
  const [maxInlineWidth, _setMaxInlineWidth] = useState<number>(
    Number(load("max-inline-width") ?? DEFAULT_OPTIONS.maxInlineWidth),
  );
  const [collapseCaseStatements, _setCollapseCaseStatements] =
    useState<boolean>(
      load("collapse-case") === "true"
        ? true
        : load("collapse-case") === "false"
          ? false
          : DEFAULT_OPTIONS.collapseCaseStatements,
    );
  const [removeComments, _setRemoveComments] = useState<boolean>(
    load("remove-comments") === "true"
      ? true
      : load("remove-comments") === "false"
        ? false
        : DEFAULT_OPTIONS.removeComments,
  );
  const [trailingSemicolon, _setTrailingSemicolon] = useState<boolean>(
    load("trailing-semicolon") === "true"
      ? true
      : load("trailing-semicolon") === "false"
        ? false
        : DEFAULT_OPTIONS.trailingSemicolon,
  );
  const [linesBetweenStatements, _setLinesBetweenStatements] =
    useState<number>(
      Number(
        load("lines-between-statements") ??
          DEFAULT_OPTIONS.linesBetweenStatements,
      ),
    );
  const [alwaysBreakOn, _setAlwaysBreakOn] = useState<boolean>(
    load("always-break-on") === "true"
      ? true
      : load("always-break-on") === "false"
        ? false
        : DEFAULT_OPTIONS.alwaysBreakOn,
  );
  const [expandSelectColumns, _setExpandSelectColumns] = useState<boolean>(
    load("expand-select-columns") === "true"
      ? true
      : load("expand-select-columns") === "false"
        ? false
        : DEFAULT_OPTIONS.expandSelectColumns,
  );
  const [selectColumnsMaxWidth, _setSelectColumnsMaxWidth] =
    useState<number>(
      Number(
        load("select-columns-max-width") ??
          DEFAULT_OPTIONS.selectColumnsMaxWidth,
      ),
    );
  const [wordWrap, _setWordWrap] = useState<boolean>(
    load("word-wrap") === "false" ? false : true,
  );

  const updateInput = (value: string) => {
    save("input", value);
    _setInput(value);
  };

  const updateOutput = (value: string) => {
    save("output", value);
    _setOutput(value);
  };

  const setKeywordCase = (value: KeywordCase) => {
    save("keyword-case", value);
    _setKeywordCase(value);
  };

  const setIndentSize = (value: number) => {
    save("indent-size", String(value));
    _setIndentSize(value);
  };

  const setMaxInlineWidth = (value: number) => {
    save("max-inline-width", String(value));
    _setMaxInlineWidth(value);
  };

  const setCollapseCaseStatements = (value: boolean) => {
    save("collapse-case", String(value));
    _setCollapseCaseStatements(value);
  };

  const setRemoveComments = (value: boolean) => {
    save("remove-comments", String(value));
    _setRemoveComments(value);
  };

  const setTrailingSemicolon = (value: boolean) => {
    save("trailing-semicolon", String(value));
    _setTrailingSemicolon(value);
  };

  const setLinesBetweenStatements = (value: number) => {
    save("lines-between-statements", String(value));
    _setLinesBetweenStatements(value);
  };

  const setAlwaysBreakOn = (value: boolean) => {
    save("always-break-on", String(value));
    _setAlwaysBreakOn(value);
  };

  const setExpandSelectColumns = (value: boolean) => {
    save("expand-select-columns", String(value));
    _setExpandSelectColumns(value);
  };

  const setSelectColumnsMaxWidth = (value: number) => {
    save("select-columns-max-width", String(value));
    _setSelectColumnsMaxWidth(value);
  };

  const setWordWrap = (value: boolean) => {
    save("word-wrap", String(value));
    _setWordWrap(value);
  };

  const options: Partial<FormatterOptions> = {
    keywordCase,
    indentSize,
    maxInlineWidth,
    collapseCaseStatements,
    removeComments,
    trailingSemicolon,
    linesBetweenStatements,
    alwaysBreakOn,
    expandSelectColumns,
    selectColumnsMaxWidth,
  };

  const runFormat = () => {
    try {
      setError("");
      updateOutput(format(input, options));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to format SQL");
    }
  };

  return (
    <section className="flex flex-col gap-2 p-2">
      <h1 className="font-bold">SQL Formatter</h1>

      <div className="flex flex-wrap gap-4 items-center">
        <label className="flex items-center gap-2">
          Keyword case:
          <select
            value={keywordCase}
            onChange={(e) =>
              setKeywordCase(
                (e.target as HTMLSelectElement).value as KeywordCase,
              )
            }
          >
            <option value="upper">UPPER</option>
            <option value="lower">lower</option>
            <option value="preserve">Preserve</option>
          </select>
        </label>

        <label className="flex items-center gap-2">
          Indent size:
          <input
            type="number"
            min={1}
            max={8}
            className="w-16"
            value={indentSize}
            onInput={(e) =>
              setIndentSize(
                Number((e.target as HTMLInputElement).value) || 1,
              )
            }
          />
        </label>

        <label className="flex items-center gap-2">
          Max inline width:
          <input
            type="number"
            min={10}
            max={400}
            className="w-20"
            value={maxInlineWidth}
            onInput={(e) =>
              setMaxInlineWidth(
                Number((e.target as HTMLInputElement).value) || 10,
              )
            }
          />
        </label>

        <label className="flex items-center gap-2">
          Blank lines between statements:
          <input
            type="number"
            min={0}
            max={5}
            className="w-16"
            value={linesBetweenStatements}
            onInput={(e) =>
              setLinesBetweenStatements(
                Number((e.target as HTMLInputElement).value) || 0,
              )
            }
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-4 items-center">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={collapseCaseStatements}
            onChange={(e) =>
              setCollapseCaseStatements(
                (e.target as HTMLInputElement).checked,
              )
            }
          />
          Collapse CASE statements to a single line
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={removeComments}
            onChange={(e) =>
              setRemoveComments((e.target as HTMLInputElement).checked)
            }
          />
          Remove comments
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={trailingSemicolon}
            onChange={(e) =>
              setTrailingSemicolon((e.target as HTMLInputElement).checked)
            }
          />
          Force trailing semicolon
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={alwaysBreakOn}
            onChange={(e) =>
              setAlwaysBreakOn((e.target as HTMLInputElement).checked)
            }
          />
          Always put ON on its own line
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={expandSelectColumns}
            onChange={(e) =>
              setExpandSelectColumns((e.target as HTMLInputElement).checked)
            }
          />
          Expand SELECT columns, comma-first
        </label>

        <label className="flex items-center gap-2">
          Select columns max width (0 = off):
          <input
            type="number"
            min={0}
            max={400}
            className="w-20"
            value={selectColumnsMaxWidth}
            onInput={(e) =>
              setSelectColumnsMaxWidth(
                Number((e.target as HTMLInputElement).value) || 0,
              )
            }
          />
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={wordWrap}
            onChange={(e) =>
              setWordWrap((e.target as HTMLInputElement).checked)
            }
          />
          Word wrap
        </label>

        <button
          className="px-4"
          onClick={() => {
            updateInput("");
            updateOutput("");
            setError("");
          }}
        >
          Clear
        </button>
      </div>

      {error && <div className="text-c-red">{error}</div>}

      <textarea
        spellcheck={false}
        wrap={wordWrap ? "soft" : "off"}
        className={`font-mono border rounded p-2 h-64 ${wordWrap ? "" : "whitespace-pre overflow-x-auto"}`}
        placeholder="Paste SQL..."
        value={input}
        onInput={(e) => updateInput((e.target as HTMLTextAreaElement).value)}
      />

      <button className="px-4 w-fit" onClick={runFormat}>
        Format
      </button>

      <textarea
        spellcheck={false}
        wrap={wordWrap ? "soft" : "off"}
        className={`font-mono border rounded p-2 h-64 ${wordWrap ? "" : "whitespace-pre overflow-x-auto"}`}
        placeholder="Formatted SQL..."
        value={output}
        readOnly
      />

      <button
        className="px-4 w-fit"
        onClick={() => navigator.clipboard.writeText(output)}
      >
        Copy Result
      </button>
    </section>
  );
};
