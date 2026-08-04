import { useState } from "preact/hooks";
import { decoders, type DecoderResult } from "./decoders";
import { useDebouncedSessionStorage } from "../hooks/useDebouncedSessionStorage";

export const StringDecodePage = () => {
  const { load, save, saveNow } = useDebouncedSessionStorage(
    "string-decoder-",
    300,
  );

  const [input, _setInput] = useState(load("input") ?? "");

  const [results, _setResults] = useState<DecoderResult[]>(
    JSON.parse(load("results") ?? "[]"),
  );

  const setInput = (value: string) => {
    save("input", value);
    _setInput(value);
  };

  const setResults = (value: DecoderResult[]) => {
    saveNow("results", JSON.stringify(value));
    _setResults(value);
  };

  const runDecoders = () => {
    const output = decoders.map((decoder) => {
      try {
        const result = decoder.decode(input);

        if (!result || result === input) {
          return {
            name: decoder.name,
            output: "",
            error: "No change",
          };
        }

        return {
          name: decoder.name,
          output: result,
        };
      } catch (e) {
        return {
          name: decoder.name,
          output: "",
          error: e instanceof Error ? e.message : "Failed",
        };
      }
    });

    setResults(output);
  };

  return (
    <section className="flex flex-col gap-2 p-2 pb-64">
      <div className="flex flex-row justify-between">
        <h1 className="font-bold">String Decoder</h1>

        <button
          className="px-4 text-c-red font-bold"
          onClick={() => {
            setInput("");
            setResults([]);
          }}
        >
          Clear
        </button>
      </div>

      <textarea
        className="font-mono border rounded p-2 h-48"
        placeholder="Paste encoded string..."
        spellcheck={false}
        value={input}
        onInput={(e) => {
          const value = (e.target as HTMLTextAreaElement).value;

          setInput(value);
        }}
      />

      <div className="flex gap-2">
        <button className="px-4" onClick={runDecoders}>
          Decode
        </button>
      </div>

      <table className="border-collapse border">
        <thead>
          <tr>
            <th className="border p-2 text-left">Decoder</th>
            <th className="border p-2 text-left">Result</th>
          </tr>
        </thead>

        <tbody>
          {results.map((result, i) => (
            <tr key={i}>
              <td className="border p-2 align-top">{result.name}</td>

              <td className="border p-2 font-mono whitespace-pre-wrap">
                {result.error ? (
                  <span className="text-c-subtext0">{result.error}</span>
                ) : (
                  <textarea
                    spellcheck={false}
                    className="w-full h-full font-mono"
                    value={result.output}
                  >
                    {" "}
                  </textarea>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
};
