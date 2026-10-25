// Static server for the BUILT game (dist/), mounted under /<slug>/ exactly
// like GitHub Pages serves a project site. Tests run against this, so what
// we test is what we ship. Usage: node tools/serve.mjs [--port 4173]

import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");
const DIST = join(ROOT, "dist");
const { slug } = JSON.parse(readFileSync(join(ROOT, "game.config.json"), "utf8"));
const portArg = process.argv.indexOf("--port");
const port = Number(portArg > 0 ? process.argv[portArg + 1] : process.env.PORT ?? 4173);
const BASE = `/${slug}/`;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".glb": "model/gltf-binary",
  ".map": "application/json",
};

if (!existsSync(join(DIST, "index.html"))) {
  console.error("dist/ is missing: run `npm run build` first");
  process.exit(1);
}

createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (url.pathname === "/" || url.pathname === BASE.slice(0, -1)) {
    res.writeHead(302, { location: BASE });
    return res.end();
  }
  if (!url.pathname.startsWith(BASE)) {
    res.writeHead(404);
    return res.end("not under " + BASE);
  }
  let rel = decodeURIComponent(url.pathname.slice(BASE.length)) || "index.html";
  const file = normalize(join(DIST, rel));
  if (!file.startsWith(DIST)) {
    res.writeHead(403);
    return res.end();
  }
  if (!existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404);
    return res.end("not found");
  }
  res.writeHead(200, {
    "content-type": TYPES[extname(file)] ?? "application/octet-stream",
    "cache-control": "no-cache",
  });
  createReadStream(file).pipe(res);
}).listen(port, "127.0.0.1", () => console.log(`serving dist/ at http://127.0.0.1:${port}${BASE}`));
