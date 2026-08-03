import { transform } from "esbuild";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export async function load(url, context, nextLoad) {
  if (url.endsWith(".ts") || url.endsWith(".tsx")) {
    const source = await readFile(fileURLToPath(url), "utf8");
    const { code } = await transform(source, {
      loader: url.endsWith(".tsx") ? "tsx" : "ts",
      format: "esm",
      sourcefile: url,
    });

    return { format: "module", source: code, shortCircuit: true };
  }

  return nextLoad(url, context);
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && !/\.[a-z]+$/.test(specifier)) {
    for (const ext of [".ts", ".tsx"]) {
      try {
        return await nextResolve(specifier + ext, context);
      } catch {}
    }
  }

  return nextResolve(specifier, context);
}
