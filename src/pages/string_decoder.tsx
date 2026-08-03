import { useState } from "preact/hooks";

type DecoderResult = {
  name: string;
  output: string;
  error?: string;
};

const decoders = [
  {
    name: "String Literal",
    decode: (v: string) => {
      try {
        return JSON.parse(v);
      } catch {
        return v
          .replace(/\\n/g, "\n")
          .replace(/\\r/g, "\r")
          .replace(/\\t/g, "\t")
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, "\\");
      }
    },
  },
  {
    name: "URL Encoding",
    decode: (v: string) => decodeURIComponent(v),
  },
  {
    name: "Base64",
    decode: (v: string) => decodeURIComponent(escape(atob(v.trim()))),
  },
  {
    name: "Base64 URL Safe",
    decode: (v: string) =>
      decodeURIComponent(
        escape(atob(v.trim().replace(/-/g, "+").replace(/_/g, "/"))),
      ),
  },
  {
    name: "HTML Escape",
    decode: (v: string) => {
      const el = document.createElement("textarea");
      el.innerHTML = v;
      return el.value;
    },
  },
  {
    name: "Binary String",
    decode: (v: string) => {
      const cleaned = v.replace(/[\s_-]/g, "");

      if (!/^[01]+$/.test(cleaned)) {
        throw new Error("Not binary");
      }

      if (cleaned.length % 8 !== 0) {
        throw new Error("Binary length must be a multiple of 8");
      }

      return cleaned
        .match(/.{8}/g)!
        .map((byte) => String.fromCharCode(parseInt(byte, 2)))
        .join("");
    },
  },
  {
    name: "Hexadecimal String",
    decode: (v: string) =>
      (v.match(/[0-9a-f]{2}/gi) ?? [])
        .map((x) => String.fromCharCode(parseInt(x, 16)))
        .join(""),
  },
  {
    name: "Quoted-printable",
    decode: (v: string) =>
      v.replace(/=([0-9A-F]{2})/gi, (_, x) =>
        String.fromCharCode(parseInt(x, 16)),
      ),
  },
  {
    name: "Unicode Escape",
    decode: (v: string) =>
      v.replace(/\\u([0-9a-f]{4})/gi, (_, x) =>
        String.fromCharCode(parseInt(x, 16)),
      ),
  },
  {
    name: "Unicode NFD",
    decode: (v: string) => v.normalize("NFD"),
  },
  {
    name: "Unicode NFKD",
    decode: (v: string) => v.normalize("NFKD"),
  },
];

const save = (key: string, value: string) => {
  sessionStorage.setItem(`string-decoder-${key}`, value);
};
const load = (key: string): string | null => {
  return sessionStorage.getItem(`string-decoder-${key}`);
};

export const StringDecodePage = () => {
  const [input, _setInput] = useState(load("input") ?? "");

  const [results, _setResults] = useState<DecoderResult[]>(
    JSON.parse(load("results") ?? "[]"),
  );

  const setInput = (value: string) => {
    save("input", value);
    _setInput(value);
  };

  const setResults = (value: DecoderResult[]) => {
    save("results", JSON.stringify(value));
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
    <section className="flex flex-col gap-2 p-2">
      <h1 className="font-bold">String Decoder</h1>

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

        <button
          className="px-4"
          onClick={() => {
            setInput("");
            setResults([]);
          }}
        >
          Clear
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
