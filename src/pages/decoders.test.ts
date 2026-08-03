import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { decoders } from "./decoders";

const decode = (name: string, input: string) =>
  decoders.find((d) => d.name === name)!.decode(input);

describe("String Literal", () => {
  it("parses a JSON-quoted string", () => {
    assert.equal(decode("String Literal", '"hello\\nworld"'), "hello\nworld");
  });

  it("falls back to manual escape replacement when JSON.parse fails", () => {
    assert.equal(decode("String Literal", "hello\\nworld"), "hello\nworld");
    assert.equal(decode("String Literal", 'a\\"b'), 'a"b');
    assert.equal(decode("String Literal", "a\\\\b"), "a\\b");
  });
});

describe("URL Encoding", () => {
  it("decodes percent-encoded characters", () => {
    assert.equal(decode("URL Encoding", "hello%20world"), "hello world");
  });

  it("throws on malformed percent-encoding", () => {
    assert.throws(() => decode("URL Encoding", "%zz"));
  });
});

describe("Base64", () => {
  it("decodes standard base64", () => {
    assert.equal(decode("Base64", "aGVsbG8="), "hello");
  });

  it("trims whitespace before decoding", () => {
    assert.equal(decode("Base64", "  aGVsbG8=  "), "hello");
  });

  it("throws on invalid base64", () => {
    assert.throws(() => decode("Base64", "not valid base64!!"));
  });
});

describe("Base64 URL Safe", () => {
  it("decodes base64url by converting to standard alphabet", () => {
    // "hi??" -> base64 "aGk/Pw==" -> url-safe "aGk_Pw"
    assert.equal(decode("Base64 URL Safe", "aGk_Pw"), "hi??");
  });
});

describe("Binary String", () => {
  it("decodes 8-bit groups into characters", () => {
    assert.equal(decode("Binary String", "01101000 01101001"), "hi");
  });

  it("ignores separators like spaces, underscores, and dashes", () => {
    assert.equal(decode("Binary String", "01101000_01101001-"), "hi");
  });

  it("throws on non-binary characters", () => {
    assert.throws(() => decode("Binary String", "0110100x"), /Not binary/);
  });

  it("throws when length is not a multiple of 8", () => {
    assert.throws(
      () => decode("Binary String", "0110100"),
      /multiple of 8/,
    );
  });
});

describe("Hexadecimal String", () => {
  it("decodes hex pairs into characters", () => {
    assert.equal(decode("Hexadecimal String", "68 69"), "hi");
  });

  it("ignores non-hex-pair content", () => {
    assert.equal(decode("Hexadecimal String", "0x68 0x69"), "hi");
  });

  it("decodes multi-byte UTF-8 sequences", () => {
    assert.equal(decode("Hexadecimal String", "43 61 66 c3 a9"), "Café");
  });

  it("leaves the input unchanged when no hex pairs are found", () => {
    assert.equal(decode("Hexadecimal String", "zz"), "zz");
  });
});

describe("Quoted-printable", () => {
  it("decodes =XX escapes", () => {
    assert.equal(decode("Quoted-printable", "a=41b"), "aAb");
  });

  it("decodes multi-byte UTF-8 sequences", () => {
    assert.equal(decode("Quoted-printable", "Caf=C3=A9"), "Café");
  });

  it("treats soft line breaks as line continuations", () => {
    assert.equal(decode("Quoted-printable", "hello=\r\nworld"), "helloworld");
    assert.equal(decode("Quoted-printable", "hello=\nworld"), "helloworld");
  });

  it("leaves unescaped text untouched", () => {
    assert.equal(decode("Quoted-printable", "hello"), "hello");
  });
});

describe("Unicode Escape", () => {
  it("decodes \\uXXXX sequences", () => {
    assert.equal(decode("Unicode Escape", "\\u0068\\u0069"), "hi");
  });

  it("leaves text without escapes untouched", () => {
    assert.equal(decode("Unicode Escape", "hello"), "hello");
  });
});

describe("Unicode NFD / NFKD", () => {
  it("decomposes combined characters (NFD)", () => {
    const result = decode("Unicode NFD", "é");
    assert.equal(result, "é");
  });

  it("decomposes and normalizes compatibility characters (NFKD)", () => {
    const result = decode("Unicode NFKD", "Ａ");
    assert.equal(result, "A");
  });
});
