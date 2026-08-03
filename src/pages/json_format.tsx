import { useState } from "preact/hooks";

const normalizePythonDict = (value: string) => {
  return (
    value
      // Convert Python booleans/null
      .replace(/\bTrue\b/g, "true")
      .replace(/\bFalse\b/g, "false")
      .replace(/\bNone\b/g, "null")

      // Convert single quoted strings to JSON strings
      .replace(
        /'([^'\\]*(?:\\.[^'\\]*)*)'/g,
        (_, content) => `"${content.replace(/"/g, '\\"')}"`,
      )
  );
};

export const JsonFormatterPage = () => {
  const [input, setInput] = useState(
    sessionStorage.getItem("json-input") ?? "",
  );

  const [output, setOutput] = useState(
    sessionStorage.getItem("json-output") ?? "",
  );

  const [error, setError] = useState("");

  const [indent, setIndent] = useState(
    Number(sessionStorage.getItem("json-indent") ?? "2"),
  );

  const [sortKeys, setSortKeys] = useState(
    sessionStorage.getItem("json-sort-keys") === "true",
  );

  const updateInput = (value: string) => {
    setInput(value);
    sessionStorage.setItem("json-input", value);
  };

  const updateOutput = (value: string) => {
    setOutput(value);
    sessionStorage.setItem("json-output", value);
  };

  const updateIndent = (value: number) => {
    setIndent(value);
    sessionStorage.setItem("json-indent", String(value));
  };

  const updateSortKeys = (value: boolean) => {
    setSortKeys(value);
    sessionStorage.setItem("json-sort-keys", String(value));
  };

  const sortObjectKeys = (obj: unknown): unknown => {
    if (Array.isArray(obj)) {
      return obj.map(sortObjectKeys);
    }

    if (obj && typeof obj === "object") {
      return Object.fromEntries(
        Object.entries(obj)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, value]) => [key, sortObjectKeys(value)]),
      );
    }

    return obj;
  };

  const format = () => {
    try {
      setError("");

      let json;
      try {
        json = JSON.parse(input);
      } catch {
        json = JSON.parse(normalizePythonDict(input));
      }

      if (sortKeys) {
        json = sortObjectKeys(json);
      }

      updateOutput(JSON.stringify(json, null, indent));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid JSON");
    }
  };

  const minify = () => {
    try {
      setError("");

      let json;
      try {
        json = JSON.parse(input);
      } catch {
        json = JSON.parse(normalizePythonDict(input));
      }

      if (sortKeys) {
        json = sortObjectKeys(json);
      }

      updateOutput(JSON.stringify(json));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid JSON");
    }
  };

  return (
    <section className="flex flex-col gap-2 p-2">
      <h1 className="font-bold">JSON Formatter</h1>

      <div className="flex gap-4 items-center">
        <label className="flex items-center gap-2">
          Indent:
          <select
            value={indent}
            onChange={(e) =>
              updateIndent(Number((e.target as HTMLSelectElement).value))
            }
          >
            <option value="2">2 spaces</option>
            <option value="4">4 spaces</option>
            <option value="8">8 spaces</option>
          </select>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={sortKeys}
            onChange={(e) =>
              updateSortKeys((e.target as HTMLInputElement).checked)
            }
          />
          Sort keys
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
        className="font-mono border rounded p-2 h-64"
        placeholder="Paste JSON..."
        value={input}
        onInput={(e) => updateInput((e.target as HTMLTextAreaElement).value)}
      />

      <div className="flex gap-4">
        <button className="px-4" onClick={format}>
          Format
        </button>

        <button className="px-4" onClick={minify}>
          Minify
        </button>
      </div>

      <textarea
        spellcheck={false}
        className="font-mono border rounded p-2 h-64"
        placeholder="Formatted JSON..."
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
