import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { format } from "./formatter";

describe("valid JSON", () => {
  it("pretty prints an object", () => {
    assert.equal(
      format('{"a":1,"b":[1,2,3]}'),
      '{\n  "a": 1,\n  "b": [\n    1,\n    2,\n    3\n  ]\n}',
    );
  });

  it("keeps empty objects and arrays compact", () => {
    assert.equal(format('{"a":{},"b":[]}'), '{\n  "a": {},\n  "b": []\n}');
  });

  it("minifies when pretty is false", () => {
    assert.equal(
      format('{"a": 1, "b": [1, 2]}', { pretty: false }),
      '{"a":1,"b":[1,2]}',
    );
  });
});

describe("best-effort formatting of invalid JSON", () => {
  it("quotes unquoted keys", () => {
    assert.equal(format("{foo: 1}"), '{\n  "foo": 1\n}');
  });

  it("converts single-quoted strings to double-quoted", () => {
    assert.equal(format("{'foo': 'bar'}"), '{\n  "foo": "bar"\n}');
  });

  it("drops trailing commas", () => {
    assert.equal(format('{"a": 1, "b": 2,}'), '{\n  "a": 1,\n  "b": 2\n}');
  });

  it("preserves comments", () => {
    assert.equal(
      format('{\n  // a comment\n  "a": 1\n}'),
      '{\n  // a comment\n  "a": 1\n}',
    );
  });

  it("handles unclosed brackets gracefully", () => {
    assert.equal(format('{"a": 1'), '{\n  "a": 1');
  });
});
