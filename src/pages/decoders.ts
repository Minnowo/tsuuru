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
