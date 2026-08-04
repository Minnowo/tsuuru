import { useEffect, useRef, useState } from "preact/hooks";
import { useDebouncedCallback } from "../hooks/useDebouncedCallback";

const save = (key: string, value: string) => {
  sessionStorage.setItem(`url-${key}`, value);
};
const load = (key: string): string | null => {
  return sessionStorage.getItem(`url-${key}`);
};

export const UrlEncoderPage = () => {
  const outputRef = useRef<HTMLTextAreaElement>(null);

  const [error, setError] = useState("");
  const [input, _setInput] = useState(load("input") ?? "");
  const [output, _setOutput] = useState(load("output") ?? "");
  const [encodeComponent, _setEncodeComponent] = useState(
    load("encode-component") !== "false",
  );

  const [debouncedSave, saveNow] = useDebouncedCallback(save, 300);

  const updateInput = (value: string) => {
    debouncedSave("input", value);
    _setInput(value);
  };

  const updateOutput = (value: string, debounce = false) => {
    if (debounce) {
      debouncedSave("output", value);
    } else {
      saveNow("output", value);
    }
    _setOutput(value);
  };

  const updateEncodeComponent = (value: boolean) => {
    save("encode-component", String(value));
    _setEncodeComponent(value);
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
    <section className="flex flex-col gap-2 p-2 pb-64">
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
        value={output}
        onInput={(e) =>
          updateOutput((e.target as HTMLTextAreaElement).value, true)
        }
      />
    </section>
  );
};
