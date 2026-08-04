import { useEffect, useRef, useState } from "preact/hooks";
import { useDebouncedSessionStorage } from "../hooks/useDebouncedSessionStorage";

type Unit = "seconds" | "milliseconds";

const toDate = (input: string, unit: Unit): Date => {
  const n = Number(input.trim());

  if (!input.trim() || isNaN(n)) {
    throw new Error("Not a valid numeric timestamp");
  }

  return new Date(unit === "seconds" ? n * 1000 : n);
};

export const TimestampPage = () => {
  const outputRef = useRef<HTMLTextAreaElement>(null);

  const { load, save, saveNow } = useDebouncedSessionStorage("timestamp-", 300);

  const [error, setError] = useState("");
  const [input, _setInput] = useState(load("input") ?? "");
  const [output, _setOutput] = useState(load("output") ?? "");
  const [unit, _setUnit] = useState<Unit>((load("unit") as Unit) ?? "seconds");
  const [useUtc, _setUseUtc] = useState(load("use-utc") === "true");

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

  const updateUnit = (value: Unit) => {
    saveNow("unit", value);
    _setUnit(value);
  };

  const updateUseUtc = (value: boolean) => {
    saveNow("use-utc", String(value));
    _setUseUtc(value);
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

  const toHuman = () => {
    try {
      setError("");
      const date = toDate(input, unit);

      if (isNaN(date.getTime())) {
        throw new Error("Not a valid timestamp");
      }

      updateOutput(useUtc ? date.toUTCString() : date.toString());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to convert");
    }
  };

  const toTimestamp = () => {
    try {
      setError("");

      const date = new Date(input.trim());

      if (isNaN(date.getTime())) {
        throw new Error("Not a valid date string");
      }

      const ms = date.getTime();

      updateOutput(String(unit === "seconds" ? Math.floor(ms / 1000) : ms));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to convert");
    }
  };

  const useNow = () => {
    setError("");
    updateInput(
      String(unit === "seconds" ? Math.floor(Date.now() / 1000) : Date.now()),
    );
  };

  return (
    <section className="flex flex-col gap-2 p-2 pb-64">
      <div className="flex flex-row justify-between">
        <h1 className="font-bold">Timestamp to Human Readable</h1>

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
          Unit:
          <select
            value={unit}
            onChange={(e) =>
              updateUnit((e.target as HTMLSelectElement).value as Unit)
            }
          >
            <option value="seconds">Seconds</option>
            <option value="milliseconds">Milliseconds</option>
          </select>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={useUtc}
            onChange={(e) =>
              updateUseUtc((e.target as HTMLInputElement).checked)
            }
          />
          UTC
        </label>

        <button className="px-4" onClick={useNow}>
          Now
        </button>
      </div>

      {error && <div className="text-c-red">{error}</div>}

      <textarea
        spellcheck={false}
        className="font-mono border rounded p-2 h-24"
        placeholder="Unix timestamp or date string..."
        value={input}
        onInput={(e) => updateInput((e.target as HTMLTextAreaElement).value)}
      />

      <div className="flex gap-4">
        <button className="px-4" onClick={toHuman}>
          Timestamp to Date
        </button>

        <button className="px-4" onClick={toTimestamp}>
          Date to Timestamp
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
        className="font-mono border rounded p-2 min-h-24 resize-none overflow-hidden"
        placeholder="Result..."
        value={output}
        onInput={(e) =>
          updateOutput((e.target as HTMLTextAreaElement).value, true)
        }
      />
    </section>
  );
};
