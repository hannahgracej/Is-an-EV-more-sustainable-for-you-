/*
  Reject anything the calculation engine does not know how to price.
  Allowlists come from data.js so a new model or grid region is accepted
  by the API as soon as it is added to the catalog.
*/

const {
  EV_MODELS,
  GRID_INTENSITY,
  STATE_EV_INCENTIVES,
} = require("../../data.js");

const FUELS = ["gasoline", "diesel", "hybrid"];
const SIZES = ["small", "midsize", "large", "suv", "truck"];
const MAX_YEAR = Math.max(2026, new Date().getFullYear());

class HttpError extends Error {
  constructor(statusCode, message, fields) {
    super(message);
    this.statusCode = statusCode;
    this.fields = fields;
  }
}

function validateInputs(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "Request body must be a JSON object.");
  }

  const fields = {};

  function choice(key, allowed) {
    const value = body[key];
    if (typeof value !== "string" || !allowed.includes(value)) {
      fields[key] = "is not a supported value";
      return "";
    }
    return value;
  }

  function whole(key, min, max) {
    const value = body[key];
    if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
      fields[key] = `must be a whole number from ${min} to ${max}`;
      return min;
    }
    return value;
  }

  // 0 means "use the catalog default" for optional prices and MPG.
  function optional(key, min, max) {
    const value = body[key];
    if (value === undefined || value === null || value === "" || value === 0) return 0;
    if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
      fields[key] = `must be between ${min} and ${max}`;
      return 0;
    }
    return value;
  }

  const visitorId = body.visitorId;
  if (typeof visitorId !== "string" || !/^[A-Za-z0-9-]{8,64}$/.test(visitorId)) {
    fields.visitorId = "must be 8–64 letters, numbers, or dashes";
  }

  const evModel = body.evModel;
  if (typeof evModel !== "string" || !EV_MODELS.some((model) => model.name === evModel)) {
    fields.evModel = "is not in the catalog";
  }

  const gridMix = body.gridMix;
  if (typeof gridMix !== "string" || !Object.prototype.hasOwnProperty.call(GRID_INTENSITY, gridMix)) {
    fields.gridMix = "is not a supported region";
  }

  const inputs = {
    visitorId: typeof visitorId === "string" ? visitorId : "",
    curFuel: choice("curFuel", FUELS),
    curYear: whole("curYear", 2000, MAX_YEAR),
    curSize: choice("curSize", SIZES),
    curMPG: optional("curMPG", 5, 80),
    curMilesPerYear: whole("curMilesPerYear", 500, 100000),
    curAgeOwned: whole("curAgeOwned", 0, 40),
    evModel: typeof evModel === "string" ? evModel : "",
    evMilesPerYear: whole("evMilesPerYear", 500, 100000),
    evYears: whole("evYears", 1, 30),
    gridMix: typeof gridMix === "string" ? gridMix : "",
    gasPrice: optional("gasPrice", 1, 10),
    evPrice: optional("evPrice", 15000, 300000),
    elecPrice: optional("elecPrice", 0.01, 1),
    tradeIn: optional("tradeIn", 0, 200000),
    federalCredit: optional("federalCredit", 0, 50000),
    stateCredit: optional("stateCredit", 0, 50000),
  };

  // optional() treats 0 as "absent", which is correct for prices, but a
  // trade-in or credit of 0 is a real answer and must still pass the type check.
  for (const key of ["tradeIn", "federalCredit", "stateCredit"]) {
    const value = body[key];
    if (value === undefined || value === null || value === "") {
      inputs[key] = 0;
      continue;
    }
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 200000) {
      fields[key] = "must be a number from 0 to 200000";
      inputs[key] = 0;
    } else if (key !== "tradeIn" && value > 50000) {
      fields[key] = "must be a number from 0 to 50000";
      inputs[key] = 0;
    } else {
      inputs[key] = value;
    }
  }

  if (body.state && body.state !== "none") {
    if (typeof body.state !== "string" || !STATE_EV_INCENTIVES[body.state]) {
      fields.state = "is not a supported state code";
    }
  }

  if (Object.keys(fields).length) {
    throw new HttpError(400, "Some fields are invalid.", fields);
  }

  return inputs;
}

function referenceCatalog() {
  const { FACTORS_VERSION, FEDERAL_EV_CREDIT } = require("../../data.js");
  return {
    factorsVersion: FACTORS_VERSION,
    models: EV_MODELS.map(({ name, battery, range, msrp }) => ({ name, battery, range, msrp })),
    fuels: FUELS,
    sizes: SIZES,
    grids: Object.keys(GRID_INTENSITY),
    states: STATE_EV_INCENTIVES,
    defaults: { federalCredit: FEDERAL_EV_CREDIT },
  };
}

module.exports = { HttpError, validateInputs, referenceCatalog };
