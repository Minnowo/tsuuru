import { useEffect, useRef, useState } from "preact/hooks";
import { format as lenientFormat } from "../json/formatter";
import { useDebouncedSessionStorage } from "../hooks/useDebouncedSessionStorage";

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
  const outputRef = useRef<HTMLTextAreaElement>(null);

  const { load, save, saveNow } = useDebouncedSessionStorage("json-", 300);

  const [input, _setInput] = useState(load("input") ?? "");

  const [output, _setOutput] = useState(load("output") ?? "");

  const [error, setError] = useState("");

  const [indent, _setIndent] = useState(Number(load("indent") ?? "2"));

  const [sortKeys, _setSortKeys] = useState(load("sort-keys") === "true");

  const updateInput = (value: string) => {
    save("input", value);
    _setInput(value);
  };

  const updateOutput = (value: string, debounce = false) => {
    if (debounce) {
      save("output", value);
    } else {
      saveNow("output", value);
    }
    _setOutput(value);
  };

  const updateIndent = (value: number) => {
    saveNow("indent", String(value));
    _setIndent(value);
  };

  const updateSortKeys = (value: boolean) => {
    saveNow("sort-keys", String(value));
    _setSortKeys(value);
  };

  const resizeOutput = (el: HTMLTextAreaElement | null) => {
    if (!el) {
      return;
    }
    const scrollY = window.scrollY;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
    window.scrollTo(0, scrollY);
  };

  useEffect(() => {
    resizeOutput(outputRef.current);
  }, [output]);

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
    setError("");

    let json;
    try {
      try {
        json = JSON.parse(input);
      } catch {
        json = JSON.parse(normalizePythonDict(input));
      }
    } catch {
      setError(
        "Invalid JSON - showing best-effort formatting (sort keys is ignored).",
      );
      updateOutput(lenientFormat(input, { indentSize: indent }));
      return;
    }

    if (sortKeys) {
      json = sortObjectKeys(json);
    }

    updateOutput(JSON.stringify(json, null, indent));
  };

  const minify = () => {
    setError("");

    let json;
    try {
      try {
        json = JSON.parse(input);
      } catch {
        json = JSON.parse(normalizePythonDict(input));
      }
    } catch {
      setError(
        "Invalid JSON - showing best-effort formatting (sort keys is ignored).",
      );
      updateOutput(lenientFormat(input, { pretty: false }));
      return;
    }

    if (sortKeys) {
      json = sortObjectKeys(json);
    }

    updateOutput(JSON.stringify(json));
  };

  return (
    <section className="flex flex-col gap-2 p-2 pb-64">
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

        <button
          className="px-4"
          onClick={() => navigator.clipboard.writeText(output)}
        >
          Copy Result
        </button>
      </div>

      <textarea
        ref={outputRef}
        spellcheck={false}
        className="font-mono border rounded p-2 min-h-64 resize-none overflow-hidden"
        placeholder="Formatted JSON..."
        value={output}
        onInput={(e) =>
          updateOutput((e.target as HTMLTextAreaElement).value, true)
        }
      />
    </section>
  );
};
