import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const port = Number(process.env.PORT ?? 3002);
const apiOrigin = process.env.API_ORIGIN ?? "http://127.0.0.1:3001";

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "application/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".svg", "image/svg+xml"],
  [".ico", "image/x-icon"]
]);

function contentType(filePath) {
  return mimeTypes.get(path.extname(filePath).toLowerCase()) ?? "application/octet-stream";
}

async function readRequestBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

async function proxyApi(request, response) {
  const body = await readRequestBody(request);
  const upstream = await fetch(`${apiOrigin}${request.url}`, {
    method: request.method,
    headers: request.headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : body
  });

  const bytes = Buffer.from(await upstream.arrayBuffer());
  response.writeHead(upstream.status, Object.fromEntries(upstream.headers.entries()));
  response.end(bytes);
}

async function serveFile(response, filePath) {
  const bytes = await fs.readFile(filePath);
  response.writeHead(200, {
    "content-type": contentType(filePath),
    "cache-control": "no-store"
  });
  response.end(bytes);
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);

    if (url.pathname.startsWith("/api/")) {
      await proxyApi(request, response);
      return;
    }

    if (url.pathname.startsWith("/_next/static/")) {
      const assetPath = url.pathname.replace("/_next/static/", "");
      const filePath = path.resolve(root, ".next", "static", assetPath);
      const staticRoot = path.resolve(root, ".next", "static");

      if (!filePath.startsWith(staticRoot)) {
        response.writeHead(404).end("Not found");
        return;
      }

      await serveFile(response, filePath);
      return;
    }

    await serveFile(response, path.resolve(root, ".next", "server", "app", "index.html"));
  } catch {
    response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    response.end("Preview server error");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`ENIGMA preview: http://127.0.0.1:${port}/`);
  console.log(`API origin: ${apiOrigin}`);
});

