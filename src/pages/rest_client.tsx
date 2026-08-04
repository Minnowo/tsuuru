import { useState } from "preact/hooks";
import { useDebouncedCallback } from "../hooks/useDebouncedCallback";

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

const contentTypes = [
  "application/json",
  "application/xml",
  "text/xml",
  "text/plain",
  "text/html",
  "application/x-www-form-urlencoded",
  "multipart/form-data",
];
const commonHeaders = [
  ["Authorization", "Bearer x"],
  ["Authorization", "Basic x"],

  ["Accept", "application/json"],
  ["Accept", "application/xml"],
  ["Accept", "text/plain"],
  ["Accept", "text/html"],
  ["Accept", "text/xml"],
  ["Accept", "application/x-www-form-urlencoded"],
  ["Accept", "multipart/form-data"],
  ["Accept", "application/octet-stream"],
];

const save = (key: string, value: string) => {
  sessionStorage.setItem(`rest-${key}`, value);
};
const load = (key: string): string | null => {
  return sessionStorage.getItem(`rest-${key}`);
};

const parseHeaders = (headers: string, headersJsonMode: boolean) => {
  if (!headers.trim()) {
    return {};
  }

  if (headersJsonMode) {
    return JSON.parse(headers);
  }

  return Object.fromEntries(
    headers
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const index = line.indexOf(":");

        if (index === -1) {
          throw new Error(`Invalid header line: ${line}`);
        }

        return [
          line.substring(0, index).trim(),
          line.substring(index + 1).trim(),
        ];
      }),
  );
};

export const RestClientPage = () => {
  const [method, _setMethod] = useState<Method>(
    (load("method") as Method) ?? "GET",
  );
  const [url, _setUrl] = useState<string>(load("url") ?? "");
  const [headers, _setHeaders] = useState<string>(
    load("headers") ?? '{\n  "Accept": "application/json"\n}',
  );
  const [headersJsonMode, _setHeadersJsonMode] = useState<boolean>(
    load("header-json-mode") !== "false",
  );
  const [bodyType, _setBodyType] = useState<string>(
    load("body-type") ?? "application/json",
  );
  const [body, _setBody] = useState<string>(load("body") ?? "");
  const [response, _setResponse] = useState<string>(load("response") ?? "");
  const [responseHeaders, _setResponseHeaders] = useState<string>(
    load("response-headers") ?? "",
  );
  const [status, _setStatus] = useState<string>(load("response-status") ?? "");
  const [time, _setTime] = useState<string>(load("response-time") ?? "");
  const [error, _setError] = useState<string>(load("response-error") ?? "");
  const [wordWrap, _setWordWrap] = useState<boolean>(
    load("word-wrap") === "true",
  );

  const [debouncedSave, saveNow] = useDebouncedCallback(save, 300);

  const setMethod = (value: Method) => {
    save("method", value);
    _setMethod(value);
  };

  const setUrl = (value: string) => {
    debouncedSave("url", value);
    _setUrl(value);
  };

  const setHeaders = (value: string) => {
    debouncedSave("headers", value);
    _setHeaders(value);
  };

  const setHeadersJsonMode = (value: boolean) => {
    save("header-json-mode", String(value));
    _setHeadersJsonMode(value);
  };

  const setBodyType = (value: string) => {
    save("body-type", value);
    _setBodyType(value);
  };

  const setBody = (value: string) => {
    debouncedSave("body", value);
    _setBody(value);
  };

  const setResponse = (value: string, debounce = false) => {
    if (debounce) {
      debouncedSave("response", value);
    } else {
      saveNow("response", value);
    }
    _setResponse(value);
  };

  const setResponseHeaders = (value: string, debounce = false) => {
    if (debounce) {
      debouncedSave("response-headers", value);
    } else {
      saveNow("response-headers", value);
    }
    _setResponseHeaders(value);
  };

  const setStatus = (value: string) => {
    save("response-status", value);
    _setStatus(value);
  };

  const setTime = (value: string) => {
    save("response-time", value);
    _setTime(value);
  };

  const setError = (value: string) => {
    save("response-error", value);
    _setError(value);
  };

  const setWordWrap = (value: boolean) => {
    save("word-wrap", String(value));
    _setWordWrap(value);
  };

  const sendRequest = async () => {
    try {
      setError("");
      setResponse("");
      setResponseHeaders("");
      setStatus("");
      setTime("");

      const start = performance.now();

      const hasBody =
        method !== "GET" && method !== "DELETE" && body.length > 0;

      const parsedHeaders = {
        ...(hasBody ? { "Content-Type": bodyType } : {}),
        ...parseHeaders(headers, headersJsonMode),
      };

      const result = await fetch(url, {
        method,
        headers: parsedHeaders,
        body: hasBody ? body : undefined,
      });

      setTime(`${(performance.now() - start).toFixed(0)} ms`);

      setStatus(`${result.status} ${result.statusText}`);

      setResponseHeaders(
        [...result.headers.entries()].map(([k, v]) => `${k}: ${v}`).join("\n"),
      );

      const text = await result.text();

      try {
        setResponse(JSON.stringify(JSON.parse(text), null, 2));
      } catch {
        setResponse(text);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    }
  };

  const addHeader = (key: string, type: string) => {
    if (!type) {
      return;
    }

    if (!headersJsonMode) {
      setHeaders(`${headers}\n${key}: ${type}`.trim());
      return;
    }

    let cur = {};
    try {
      cur = JSON.parse(headers || "{}");
    } catch {}
    setHeaders(
      JSON.stringify(
        {
          ...cur,
          [key]: type,
        },
        null,
        2,
      ),
    );
  };

  return (
    <section className="flex flex-col gap-2 p-2 pb-64">
      <div className="flex flex-row justify-between">
        <h1 className="font-bold">REST Client</h1>

        <button
          className="px-4 text-c-red font-bold"
          onClick={() => {
            setUrl("");
            setHeaders("");
            setBody("");
            setResponse("");
            setResponseHeaders("");
            setError("");
          }}
        >
          Clear
        </button>
      </div>

      <div className="flex gap-2">
        <select
          value={method}
          onChange={(e) => {
            const value = (e.target as HTMLSelectElement).value as Method;

            setMethod(value);
          }}
        >
          <option>GET</option>
          <option>POST</option>
          <option>PUT</option>
          <option>PATCH</option>
          <option>DELETE</option>
        </select>

        <input
          className="flex-1"
          placeholder="https://api.example.com"
          value={url}
          onInput={(e) => {
            const value = (e.target as HTMLInputElement).value;

            setUrl(value);
          }}
        />
      </div>

      {error && <div className="text-c-red">{error}</div>}

      <div className="flex flex-wrap gap-4 items-center">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={headersJsonMode}
            onChange={(e) => {
              const value = (e.target as HTMLInputElement).checked;

              const nowHeaders = parseHeaders(headers, headersJsonMode);

              if (value) {
                setHeaders(JSON.stringify(nowHeaders, null, 2));
              } else {
                setHeaders(
                  Object.entries(nowHeaders)
                    .map(([key, val]) => `${key}: ${val}`)
                    .join("\n"),
                );
              }

              setHeadersJsonMode(value);
            }}
          />
          JSON Headers
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={wordWrap}
            onChange={(e) =>
              setWordWrap((e.target as HTMLInputElement).checked)
            }
          />
          Word wrap
        </label>

        <select
          className="min-w-0 max-w-full flex-1 truncate"
          onChange={(e) => {
            const n = Number((e.target as HTMLSelectElement).value);
            if (isNaN(n)) {
              return;
            }

            addHeader(commonHeaders[n][0], commonHeaders[n][1]);
          }}
        >
          <option value="">Add common header...</option>

          {commonHeaders.map((type, i) => (
            <option key={i} value={i}>
              {type[0]}: {type[1]}
            </option>
          ))}
        </select>
      </div>

      <h2 className="font-bold">Headers</h2>

      <textarea
        className={`font-mono h-32 ${wordWrap ? "" : "whitespace-pre overflow-x-auto"}`}
        wrap={wordWrap ? "soft" : "off"}
        spellcheck={false}
        value={headers}
        onInput={(e) => {
          const value = (e.target as HTMLTextAreaElement).value;

          setHeaders(value);
        }}
      />

      <h2 className="font-bold">Request Body</h2>
      <select
        className="w-fit"
        value={bodyType}
        onChange={(e) => {
          const value = (e.target as HTMLSelectElement).value;

          setBodyType(value);
        }}
      >
        {contentTypes.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>

      <textarea
        className={`font-mono h-48 ${wordWrap ? "" : "whitespace-pre overflow-x-auto"}`}
        wrap={wordWrap ? "soft" : "off"}
        value={body}
        spellcheck={false}
        placeholder="Request body..."
        onInput={(e) => {
          const value = (e.target as HTMLTextAreaElement).value;

          setBody(value);
        }}
      />

      <div className="flex gap-4">
        <button className="px-4" onClick={sendRequest}>
          Send
        </button>
        <span>Status: {status}</span>

        <span>Time: {time}</span>
      </div>

      <h2 className="font-bold">Response Headers</h2>

      <textarea
        className={`font-mono h-32 ${wordWrap ? "" : "whitespace-pre overflow-x-auto"}`}
        wrap={wordWrap ? "soft" : "off"}
        spellcheck={false}
        value={responseHeaders}
        onInput={(e) =>
          setResponseHeaders((e.target as HTMLTextAreaElement).value, true)
        }
      />

      <div className="flex justify-between items-center">
        <h2 className="font-bold">Response</h2>

        <button
          className="px-4"
          onClick={() => navigator.clipboard.writeText(response)}
        >
          Copy Response
        </button>
      </div>

      <textarea
        className={`font-mono h-64 ${wordWrap ? "" : "whitespace-pre overflow-x-auto"}`}
        wrap={wordWrap ? "soft" : "off"}
        spellcheck={false}
        value={response}
        onInput={(e) =>
          setResponse((e.target as HTMLTextAreaElement).value, true)
        }
      />
    </section>
  );
};
