/*
  One process for local development: the static site and the API.

  The API calls the same handler Lambda will run. With TABLE_NAME unset,
  analyses are kept in memory and disappear when the process stops.
*/

const http = require("http");
const fs = require("fs");
const path = require("path");
const { handler } = require("./lambda/index.js");

const root = path.join(__dirname, "..");
const port = Number(process.env.PORT) || 3001;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

function staticFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split("?")[0]);
  if (clean.includes("\0") || clean.includes("..")) return null;
  const rel = clean === "/" ? "/index.html" : clean;
  const file = path.normalize(path.join(root, rel));
  if (path.dirname(file) !== root) return null;
  if (!TYPES[path.extname(file)]) return null;
  if (!fs.existsSync(file)) return null;
  return file;
}

function isApi(urlPath) {
  return urlPath === "/health"
    || urlPath === "/reference"
    || urlPath === "/analyses"
    || urlPath === "/suggestions"
    || urlPath.startsWith("/analyses/")
    || urlPath === "/api"
    || urlPath.startsWith("/api/");
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  const pathname = url.pathname.length > 1 && url.pathname.endsWith("/")
    ? url.pathname.slice(0, -1)
    : url.pathname;

  if (!isApi(pathname)) {
    const file = staticFile(pathname);
    if (!file) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "content-type": TYPES[path.extname(file)],
      "cache-control": "no-store",
    });
    fs.createReadStream(file).pipe(res);
    return;
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString("utf8");
  const result = await handler({
    rawPath: pathname,
    rawQueryString: url.search.slice(1),
    queryStringParameters: Object.fromEntries(url.searchParams),
    body: body || null,
    isBase64Encoded: false,
    requestContext: { http: { method: req.method }, requestId: "local" },
  });

  res.writeHead(result.statusCode, result.headers || {});
  res.end(result.body || "");
});

if (require.main === module) {
  server.listen(port, () => {
    console.log(`EV comparison site  http://localhost:${port}`);
    console.log(`API health          http://localhost:${port}/health`);
  });
}

module.exports = { server };
