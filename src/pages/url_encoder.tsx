import { useState } from "preact/hooks";

const save = (key: string, value: string) => {
  sessionStorage.setItem(`url-${key}`, value);
};
const load = (key: string): string | null => {
  return sessionStorage.getItem(`url-${key}`);
};

export const UrlEncoderPage = () => {
  const [error, setError] = useState("");
  const [input, _setInput] = useState(load("input") ?? "");
  const [output, _setOutput] = useState(load("output") ?? "");
  const [encodeComponent, _setEncodeComponent] = useState(
    load("encode-component") !== "false",
  );

  const updateInput = (value: string) => {
    save("input", value);
    _setInput(value);
  };

  const updateOutput = (value: string) => {
    save("output", value);
    _setOutput(value);
  };

  const updateEncodeComponent = (value: boolean) => {
    save("encode-component", String(value));
    _setEncodeComponent(value);
  };

  const encode = () => {
    try {
      setError("");
      updateOutput(
        encodeComponent ? encodeURIComponent(input) : encodeURI(input),
      );
    } catch {
      setError("Failed to encode text.");
    }
  };

  const decode = () => {
    try {
      setError("");
      updateOutput(
        encodeComponent ? decodeURIComponent(input) : decodeURI(input),
      );
    } catch {
      setError("Failed to decode text.");
    }
  };

  return (
    <section className="flex flex-col gap-2 p-2">
      <div className="flex flex-row justify-between">
        <h1 className="font-bold">URL Encoder / Decoder</h1>

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

      <div className="flex gap-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={encodeComponent}
            onChange={(e) =>
              updateEncodeComponent((e.target as HTMLInputElement).checked)
            }
          />
          Encode component (also encodes &, /, ?, :, etc.)
        </label>
      </div>

      {error && <div className="text-c-red">{error}</div>}

      <textarea
        spellcheck={false}
        className="font-mono border rounded p-2 h-48"
        placeholder="Enter text or URL..."
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
