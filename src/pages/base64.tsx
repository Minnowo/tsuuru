import { useEffect, useRef, useState } from "preact/hooks";
import { useDebouncedSessionStorage } from "../hooks/useDebouncedSessionStorage";

export const Base64Page = () => {
  const outputRef = useRef<HTMLTextAreaElement>(null);

  const { load, save, saveNow } = useDebouncedSessionStorage("base64-", 300);

  const [error, setError] = useState("");
  const [input, _setInput] = useState(load("input") ?? "");
  const [output, _setOutput] = useState(load("output") ?? "");
  const [decodeEachLine, _setDecodeEachLine] = useState(
    load("decode-each-line") === "true",
  );
  const [useWordWrap, _setUseWordWrap] = useState(
    load("decode-word-wrap") === "true",
  );
  const [urlSafe, _setUrlSafe] = useState(load("decode-url-safe") === "true");

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

  const updateDecodeEachLine = (value: boolean) => {
    saveNow("decode-each-line", String(value));
    _setDecodeEachLine(value);
  };

  const updateWordWrap = (value: boolean) => {
    saveNow("decode-word-wrap", String(value));
    _setUseWordWrap(value);
  };

  const updateUrlSafe = (value: boolean) => {
    saveNow("decode-url-safe", String(value));
    _setUrlSafe(value);
  };

  const resizeOutput = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    const scrollY = window.scrollY;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
    window.scrollTo(0, scrollY);
  };

  useEffect(() => {
    resizeOutput(outputRef.current);
  }, [output]);

  const encode = () => {
    try {
      setError("");
      const o = btoa(unescape(encodeURIComponent(input)));
      if (urlSafe) {
        updateOutput(
          o.replace(/\+/g, "-").replace(/=+$/, "").replace(/\//g, "_"),
        );
      } else {
        updateOutput(o);
      }
    } catch {
      setError("Failed to encode text.");
    }
  };

  const decode = () => {
    setError("");

    const base64 = urlSafe
      ? input
          .replace(/-/g, "+")
          .replace(/_/g, "/")
          .padEnd(input.length + ((4 - (input.length % 4)) % 4), "=")
      : input;

    if (decodeEachLine) {
      const result = base64
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((value) => {
          try {
            return decodeURIComponent(escape(atob(value)));
          } catch {
            setError("Invalid Base64 lines skipped.");
            return "";
          }
        })
        .join("\n");

      updateOutput(result);
      return;
    }

    try {
      updateOutput(decodeURIComponent(escape(atob(base64))));
    } catch {
      setError("Invalid Base64 string.");
    }
  };

  return (
    <section className="flex flex-col gap-2 p-2 pb-64">
      <div className="flex flex-row justify-between">
        <h1 className="font-bold">Base64 Encode / Decode</h1>

        <button
          className="px-4 text-c-red font-bold"
          onClick={() => {
            updateInput("");
            updateOutput("");
          }}
        >
          Clear
        </button>
      </div>

      <div className="flex gap-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={urlSafe}
            onChange={(e) =>
              updateUrlSafe((e.target as HTMLInputElement).checked)
            }
          />
          URL safe encoding
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={decodeEachLine}
            onChange={(e) =>
              updateDecodeEachLine((e.target as HTMLInputElement).checked)
            }
          />
          Decode each line separately
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={useWordWrap}
            onChange={(e) =>
              updateWordWrap((e.target as HTMLInputElement).checked)
            }
          />
          Word wrap
        </label>
      </div>

      {error && <div className="text-c-red">{error}</div>}

      <textarea
        spellcheck={false}
        className="font-mono border rounded p-2 h-48"
        placeholder="Enter text or Base64..."
        wrap={useWordWrap ? "soft" : "off"}
        value={input}
        onInput={(e) => updateInput((e.target as HTMLTextAreaElement).value)}
      />

      <div className="flex gap-4">
        <button className="px-4" onClick={encode}>
          Encode
        </button>

        <button className="px-4" onClick={decode}>
          Decode
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
        className="font-mono border rounded p-2 min-h-48 resize-none overflow-hidden"
        placeholder="Result..."
        wrap={useWordWrap ? "soft" : "off"}
        value={output}
        onInput={(e) =>
          updateOutput((e.target as HTMLTextAreaElement).value, true)
        }
      />
    </section>
  );
};
