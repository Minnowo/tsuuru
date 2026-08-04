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

const save = (key: string, value: string) => {
  sessionStorage.setItem(`json-${key}`, value);
};
const load = (key: string): string | null => {
  return sessionStorage.getItem(`json-${key}`);
};

export const JsonFormatterPage = () => {
  const [input, _setInput] = useState(load("input") ?? "");

  const [output, _setOutput] = useState(load("output") ?? "");

  const [error, setError] = useState("");

  const [indent, _setIndent] = useState(Number(load("indent") ?? "2"));

  const [sortKeys, _setSortKeys] = useState(load("sort-keys") === "true");

  const updateInput = (value: string) => {
    save("input", value);
    _setInput(value);
  };

  const updateOutput = (value: string) => {
    save("output", value);
    _setOutput(value);
  };

  const updateIndent = (value: number) => {
    save("indent", String(value));
    _setIndent(value);
  };

  const updateSortKeys = (value: boolean) => {
    save("sort-keys", String(value));
    _setSortKeys(value);
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
      <div className="flex flex-row justify-between">
        <h1 className="font-bold">JSON Formatter</h1>

        <button
          className="px-4 text-c-red font-bold"
          onClick={() => {
            updateInput("");
            updateOutput("");
            setError("");
          }}
        >
          Clear
        </button>
      </div>

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
