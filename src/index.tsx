/* eslint-disable complexity */
if (import.meta.env.MODE === "development") {
  import("preact/debug");
}

import "./index.css";
import { render } from "preact";
import { useLayoutEffect, useState } from "preact/hooks";
import { Base64Page } from "./pages/base64";
import { StringDecodePage } from "./pages/string_decoder";
import { JsonFormatterPage } from "./pages/json_format";
import { RestClientPage } from "./pages/rest_client";
import { UrlEncoderPage } from "./pages/url_encoder";
import { TimestampPage } from "./pages/timestamp";
import { SqlFormatPage } from "./pages/sql_format";

export const App = () => {
  const [hashRoute, setHashRoute] = useState<string>(window.location.hash);

  useLayoutEffect(() => {
    const updateFunc = () => setHashRoute(window.location.hash);

    updateFunc();
    window.addEventListener("hashchange", updateFunc);

    return () => window.removeEventListener("hashchange", updateFunc);
  }, []);

  const nav = (
    <nav class="flex flex-wrap gap-x-4">
      <a href="#base64">Base64 Encode</a>
      <a href="#string">String Decoder</a>
      <a href="#json">JSON Formatter</a>
      <a href="#rest">REST Client</a>
      <a href="#url">URL Encoder / Decoder</a>
      <a href="#timestamp">Timestamp to ISO</a>
      <a href="#sql">SQL Formatter</a>
    </nav>
  );

  switch (hashRoute) {
    case "#sql":
      return (
        <>
          {nav}
          <hr className="my-2" />
          <SqlFormatPage />
        </>
      );
    case "#url":
      return (
        <>
          {nav}
          <hr className="my-2" />
          <UrlEncoderPage />
        </>
      );
    case "#timestamp":
      return (
        <>
          {nav}
          <hr className="my-2" />
          <TimestampPage />
        </>
      );
    case "#rest":
      return (
        <>
          {nav}
          <hr className="my-2" />
          <RestClientPage />
        </>
      );
    case "#json":
      return (
        <>
          {nav}
          <hr className="my-2" />
          <JsonFormatterPage />
        </>
      );
    case "#string":
      return (
        <>
          {nav}
          <hr className="my-2" />
          <StringDecodePage />
        </>
      );
    case "#base64":
      return (
        <>
          {nav}
          <hr className="my-2" />
          <Base64Page />
        </>
      );
    default:
      return nav;
  }
};

render(<App />, document.getElementById("app"));
