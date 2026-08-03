export type DecoderResult = {
  name: string;
  output: string;
  error?: string;
};

export const decoders = [
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
    decode: (v: string) => {
      const cleaned = v.replace(/\s|0x/gi, "");
      const pairs = cleaned.match(/[0-9a-f]{2}/gi);

      if (!pairs) {
        return v;
      }

      const bytes = pairs.map((x) => parseInt(x, 16));

      return new TextDecoder().decode(new Uint8Array(bytes));
    },
  },
  {
    name: "Quoted-printable",
    decode: (v: string) => {
      const bytes: number[] = [];

      for (let i = 0; i < v.length; i++) {
        if (v[i] === "=") {
          // Soft line break: "=\r\n" or "=\n" is a line continuation, not a byte.
          if (v[i + 1] === "\r" && v[i + 2] === "\n") {
            i += 2;
            continue;
          }
          if (v[i + 1] === "\n") {
            i += 1;
            continue;
          }

          const hex = v.slice(i + 1, i + 3);
          if (/^[0-9A-F]{2}$/i.test(hex)) {
            bytes.push(parseInt(hex, 16));
            i += 2;
            continue;
          }
        }

        bytes.push(v.charCodeAt(i));
      }

      return new TextDecoder().decode(new Uint8Array(bytes));
    },
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
