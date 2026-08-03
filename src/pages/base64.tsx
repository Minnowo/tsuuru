import { useState } from "preact/hooks";

export const Base64Page = () => {
  const [error, setError] = useState("");
  const [input, setInput] = useState(
    sessionStorage.getItem("base64-input") ?? "",
  );
  const [output, setOutput] = useState(
    sessionStorage.getItem("base64-output") ?? "",
  );
  const [decodeEachLine, setDecodeEachLine] = useState(
    sessionStorage.getItem("base64-decode-each-line") === "true",
  );
  const [useWordWrap, setUseWordWrap] = useState(
    sessionStorage.getItem("base64-decode-word-wrap") !== "false",
  );
  const [urlSafe, setUrlSafe] = useState(
    sessionStorage.getItem("base64-decode-url-safe") === "true",
  );

  const updateInput = (value: string) => {
    setInput(value);
    sessionStorage.setItem("base64-input", value);
  };

  const updateOutput = (value: string) => {
    setOutput(value);
    sessionStorage.setItem("base64-output", value);
  };

  const updateDecodeEachLine = (value: boolean) => {
    setDecodeEachLine(value);
    sessionStorage.setItem("base64-decode-each-line", String(value));
  };

  const updateWordWrap = (value: boolean) => {
    setUseWordWrap(value);
    sessionStorage.setItem("base64-decode-word-wrap", String(value));
  };

  const updateUrlSafe = (value: boolean) => {
    setUrlSafe(value);
    sessionStorage.setItem("base64-decode-url-safe", String(value));
  };

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
    <section className="flex flex-col gap-2 p-2">
      <h1 className="font-bold">Base64 Encode / Decode</h1>

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
        <button
          className="px-4"
          onClick={() => {
            updateInput("");
            updateOutput("");
          }}
        >
          Clear
        </button>
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
      </div>

      <textarea
        spellcheck={false}
        className="font-mono border rounded p-2 h-48"
        placeholder="Result..."
        wrap={useWordWrap ? "soft" : "off"}
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
