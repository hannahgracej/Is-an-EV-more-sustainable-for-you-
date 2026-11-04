/*
  HTTP API (payload v2) entry point.

  Routes:
    GET  /health
    GET  /reference
    POST /analyses
    GET  /analyses?visitorId=
    GET  /analyses/{id}

  The AWS SDK is required only when TABLE_NAME is set. The Node.js 22 Lambda
  runtime provides it, so the deployment zip does not vendor node_modules.
*/

const { randomUUID } = require("crypto");
const { runComparison } = require("../../calc.js");
const { FACTORS_VERSION } = require("../../data.js");
const { HttpError, validateInputs, referenceCatalog } = require("./validate.js");
const store = require("./store.js");

const MAX_BODY_BYTES = 10_000;

function factorsVersion() {
  return process.env.FACTORS_VERSION || FACTORS_VERSION;
}

function json(statusCode, payload) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "GET,POST,OPTIONS",
    },
    body: statusCode === 204 ? "" : JSON.stringify(payload),
  };
}

function parseBody(event) {
  if (!event.body) throw new HttpError(400, "Request body is required.");
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;
  if (Buffer.byteLength(raw) > MAX_BODY_BYTES) {
    throw new HttpError(400, "Request body is too large.");
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, "Request body must be JSON.");
  }
}

function summaryOf(inputs, result) {
  return {
    evModel: inputs.evModel,
    curYear: inputs.curYear,
    curFuel: inputs.curFuel,
    curSize: inputs.curSize,
    gridMix: inputs.gridMix,
    comparisonYears: result.comparisonYears,
    carbonSavings: result.savings,
    costSavings: result.cost.savings,
    evIsBetter: result.evIsBetter,
    evCheaper: result.cost.evCheaper,
  };
}

function publicAnalysis(item) {
  return {
    id: item.id,
    createdAt: item.createdAt,
    factorsVersion: item.factorsVersion,
    inputs: item.inputs,
    result: item.result,
    summary: item.summary,
  };
}

async function createAnalysis(event) {
  const inputs = validateInputs(parseBody(event));
  const { visitorId, ...calcInputs } = inputs;
  let result;
  try {
    result = runComparison(calcInputs);
  } catch (err) {
    throw new HttpError(400, err.message || "The comparison could not be calculated.");
  }

  const item = {
    id: randomUUID(),
    visitorId,
    createdAt: new Date().toISOString(),
    factorsVersion: factorsVersion(),
    inputs: calcInputs,
    result,
    summary: summaryOf(calcInputs, result),
  };
  await store.putAnalysis(item);
  console.log(JSON.stringify({
    level: "info",
    route: "POST /analyses",
    analysisId: item.id,
    factorsVersion: item.factorsVersion,
    evModel: calcInputs.evModel,
    gridMix: calcInputs.gridMix,
  }));
  return json(201, publicAnalysis(item));
}

async function readAnalysis(id) {
  const item = await store.getAnalysis(id);
  if (!item) throw new HttpError(404, "Analysis not found.");
  return json(200, publicAnalysis(item));
}

async function listAnalyses(event) {
  const visitorId = event.queryStringParameters && event.queryStringParameters.visitorId;
  if (typeof visitorId !== "string" || !/^[A-Za-z0-9-]{8,64}$/.test(visitorId)) {
    throw new HttpError(400, "A visitorId query parameter is required.");
  }
  const items = await store.listByVisitor(visitorId, 20);
  return json(200, {
    analyses: items.map((item) => ({
      id: item.id,
      createdAt: item.createdAt,
      factorsVersion: item.factorsVersion,
      ...item.summary,
    })),
  });
}

async function handler(event) {
  const method = (event.requestContext && event.requestContext.http && event.requestContext.http.method) || "GET";
  let path = event.rawPath || "/";
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  if (path.startsWith("/api/")) path = path.slice(4);
  else if (path === "/api") path = "/";

  const started = Date.now();
  try {
    if (method === "OPTIONS") return json(204, {});
    if (method === "GET" && path === "/health") {
      return json(200, { ok: true, factorsVersion: factorsVersion() });
    }
    if (method === "GET" && path === "/reference") {
      return json(200, referenceCatalog());
    }
    if (method === "POST" && path === "/analyses") return await createAnalysis(event);
    if (method === "GET" && path === "/analyses") return await listAnalyses(event);

    const match = path.match(/^\/analyses\/([0-9a-f-]{36})$/i);
    if (method === "GET" && match) return await readAnalysis(match[1]);
    return json(404, { error: "Not found." });
  } catch (err) {
    if (err instanceof HttpError || err.statusCode) {
      return json(err.statusCode, { error: err.message, fields: err.fields });
    }
    console.log(JSON.stringify({
      level: "error",
      route: `${method} ${path}`,
      name: err.name,
      message: err.message,
    }));
    return json(500, { error: "Something went wrong while running the comparison." });
  } finally {
    console.log(JSON.stringify({
      level: "info",
      route: `${method} ${path}`,
      requestId: event.requestContext && event.requestContext.requestId,
      durationMs: Date.now() - started,
    }));
  }
}

module.exports = { handler, resetStoreForTests: store.resetStoreForTests };
