/*
  Vehicle and emissions reference data.
  Sources: EPA fuel economy data, Argonne GREET model, IEA, peer-reviewed LCA studies.
*/

const EV_MODELS = [
  { name: "Tesla Model 3 Standard Range Plus", battery: 60, range: 272, mfgCO2: 8.1, msrp: 38990 },
  { name: "Tesla Model 3 Long Range", battery: 82, range: 358, mfgCO2: 10.2, msrp: 45990 },
  { name: "Tesla Model Y Long Range", battery: 82, range: 330, mfgCO2: 10.8, msrp: 47990 },
  { name: "Tesla Model Y Standard Range", battery: 60, range: 260, mfgCO2: 8.5, msrp: 36490 },
  { name: "Tesla Model S Long Range", battery: 100, range: 405, mfgCO2: 13.0, msrp: 74990 },
  { name: "Tesla Model X Long Range", battery: 100, range: 348, mfgCO2: 14.0, msrp: 79990 },
  { name: "Chevrolet Bolt EV", battery: 66, range: 259, mfgCO2: 8.8, msrp: 27495 },
  { name: "Chevrolet Bolt EUV", battery: 66, range: 247, mfgCO2: 9.0, msrp: 28795 },
  { name: "Chevrolet Equinox EV", battery: 85, range: 319, mfgCO2: 11.0, msrp: 33900 },
  { name: "Ford Mustang Mach-E Standard", battery: 72, range: 250, mfgCO2: 9.5, msrp: 42995 },
  { name: "Ford Mustang Mach-E Extended", battery: 91, range: 312, mfgCO2: 11.5, msrp: 52995 },
  { name: "Ford F-150 Lightning Standard", battery: 98, range: 240, mfgCO2: 14.5, msrp: 49995 },
  { name: "Ford F-150 Lightning Extended", battery: 131, range: 320, mfgCO2: 17.0, msrp: 59995 },
  { name: "Hyundai Ioniq 5 Standard", battery: 58, range: 220, mfgCO2: 8.0, msrp: 41800 },
  { name: "Hyundai Ioniq 5 Long Range", battery: 77, range: 303, mfgCO2: 10.0, msrp: 46800 },
  { name: "Hyundai Ioniq 6 Long Range", battery: 77, range: 361, mfgCO2: 9.8, msrp: 42450 },
  { name: "Kia EV6 Standard", battery: 58, range: 232, mfgCO2: 8.2, msrp: 42600 },
  { name: "Kia EV6 Long Range", battery: 77, range: 310, mfgCO2: 10.1, msrp: 50600 },
  { name: "Kia EV9 Long Range", battery: 100, range: 304, mfgCO2: 13.5, msrp: 56395 },
  { name: "Nissan Leaf S", battery: 40, range: 149, mfgCO2: 6.5, msrp: 28140 },
  { name: "Nissan Leaf SV Plus", battery: 62, range: 212, mfgCO2: 8.5, msrp: 36190 },
  { name: "Nissan Ariya", battery: 87, range: 304, mfgCO2: 11.2, msrp: 43190 },
  { name: "Volkswagen ID.4 Standard", battery: 62, range: 209, mfgCO2: 8.5, msrp: 38995 },
  { name: "Volkswagen ID.4 Pro S", battery: 82, range: 275, mfgCO2: 10.5, msrp: 48995 },
  { name: "BMW iX xDrive50", battery: 112, range: 324, mfgCO2: 14.0, msrp: 87100 },
  { name: "BMW i4 eDrive40", battery: 84, range: 301, mfgCO2: 10.8, msrp: 52200 },
  { name: "Mercedes EQS 450+", battery: 108, range: 350, mfgCO2: 14.5, msrp: 104400 },
  { name: "Mercedes EQE 350+", battery: 91, range: 305, mfgCO2: 12.0, msrp: 74900 },
  { name: "Rivian R1S", battery: 135, range: 321, mfgCO2: 17.5, msrp: 75900 },
  { name: "Rivian R1T", battery: 135, range: 314, mfgCO2: 17.8, msrp: 73000 },
  { name: "Polestar 2 Standard", battery: 69, range: 270, mfgCO2: 9.2, msrp: 44900 },
  { name: "Polestar 2 Long Range", battery: 82, range: 320, mfgCO2: 10.5, msrp: 50900 },
  { name: "Audi Q4 e-tron", battery: 82, range: 265, mfgCO2: 11.0, msrp: 49800 },
  { name: "Audi e-tron GT", battery: 94, range: 238, mfgCO2: 12.5, msrp: 106395 },
  { name: "Subaru Solterra", battery: 72, range: 228, mfgCO2: 9.8, msrp: 44995 },
  { name: "Toyota bZ4X", battery: 72, range: 252, mfgCO2: 9.6, msrp: 42000 },
  { name: "Honda Prologue", battery: 85, range: 296, mfgCO2: 11.0, msrp: 47400 },
  { name: "Cadillac Lyriq", battery: 102, range: 314, mfgCO2: 13.0, msrp: 57195 },
  { name: "Lucid Air Pure", battery: 92, range: 419, mfgCO2: 12.0, msrp: 78900 },
  { name: "Lucid Air Grand Touring", battery: 118, range: 516, mfgCO2: 15.0, msrp: 138000 },
];

// CO2 in kg per gallon of fuel burned (combustion only, tank-to-wheel)
const FUEL_CO2_PER_GALLON = {
  gasoline: 8.887,
  diesel: 10.180,
  hybrid: 8.887,
};

// Upstream (well-to-tank) adds ~25% for gasoline/diesel
const UPSTREAM_FACTOR = {
  gasoline: 1.25,
  diesel: 1.28,
  hybrid: 1.25,
};

// Manufacturing emissions for a conventional ICE car (tonnes CO2)
// These represent the embedded carbon already "spent" when the car was built.
const ICE_MFG_CO2 = {
  small: 6.0,
  midsize: 7.0,
  large: 8.5,
  suv: 9.5,
  truck: 11.0,
};

// Average MPG estimates by size class and fuel type, varying by era
// Used when user doesn't provide MPG manually.
function estimateMPG(size, fuel, year) {
  const baseMPG = {
    small:   { gasoline: 30, diesel: 35, hybrid: 45 },
    midsize: { gasoline: 27, diesel: 32, hybrid: 42 },
    large:   { gasoline: 23, diesel: 28, hybrid: 36 },
    suv:     { gasoline: 21, diesel: 25, hybrid: 30 },
    truck:   { gasoline: 17, diesel: 21, hybrid: 24 },
  };
  let mpg = (baseMPG[size] && baseMPG[size][fuel]) || 25;
  // Adjust for model year: older cars are less efficient
  const yearsFrom2024 = 2024 - year;
  if (yearsFrom2024 > 0) {
    mpg *= Math.max(0.6, 1 - yearsFrom2024 * 0.008);
  }
  return Math.round(mpg * 10) / 10;
}

// Grid carbon intensity in kg CO2 per kWh (generation + T&D losses)
const GRID_INTENSITY = {
  "us-avg":     0.390,
  "california":  0.210,
  "texas":       0.400,
  "northeast":   0.280,
  "midwest":     0.500,
  "southeast":   0.420,
  "northwest":   0.150,
  "eu-avg":      0.230,
  "uk":          0.200,
  "renewable":   0.020,
};

// Maintenance CO2 per year (tonnes) — tires, fluids, parts manufacture
const MAINTENANCE_CO2 = {
  ice: 0.3,
  ev: 0.15,
};

// ── Long-term financial cost data ──

// National-average fuel prices (USD per gallon)
const FUEL_PRICE_PER_GALLON = {
  gasoline: 3.50,
  diesel: 3.90,
  hybrid: 3.50,
};

// Electricity price (USD per kWh) by grid region
const ELECTRICITY_PRICE = {
  "us-avg":     0.16,
  "california":  0.27,
  "texas":       0.13,
  "northeast":   0.22,
  "midwest":     0.14,
  "southeast":   0.13,
  "northwest":   0.11,
  "eu-avg":      0.25,
  "uk":          0.30,
  "renewable":   0.05,
};

// Annual maintenance cost (USD) — oil changes, brakes, filters vs EV simplicity
const MAINTENANCE_COST = {
  ice: 1200,
  ev: 600,
};

// Annual insurance cost (USD) — EVs tend to cost more to insure
const INSURANCE_COST = {
  ice: 1600,
  ev: 1900,
};

// ── Tax incentives ──

const FEDERAL_EV_CREDIT = 7500;

// State-level EV incentives (USD) — rebates, credits, or exemptions
// Values represent the most common direct purchase incentive per state.
const STATE_EV_INCENTIVES = {
  "none":  { label: "No state selected", credit: 0 },
  "AL":    { label: "Alabama", credit: 0 },
  "AK":    { label: "Alaska", credit: 0 },
  "AZ":    { label: "Arizona", credit: 0 },
  "AR":    { label: "Arkansas", credit: 0 },
  "CA":    { label: "California", credit: 7500 },
  "CO":    { label: "Colorado", credit: 5000 },
  "CT":    { label: "Connecticut", credit: 7500 },
  "DE":    { label: "Delaware", credit: 2500 },
  "FL":    { label: "Florida", credit: 0 },
  "GA":    { label: "Georgia", credit: 0 },
  "HI":    { label: "Hawaii", credit: 0 },
  "ID":    { label: "Idaho", credit: 0 },
  "IL":    { label: "Illinois", credit: 4000 },
  "IN":    { label: "Indiana", credit: 0 },
  "IA":    { label: "Iowa", credit: 0 },
  "KS":    { label: "Kansas", credit: 0 },
  "KY":    { label: "Kentucky", credit: 0 },
  "LA":    { label: "Louisiana", credit: 2500 },
  "ME":    { label: "Maine", credit: 2000 },
  "MD":    { label: "Maryland", credit: 3000 },
  "MA":    { label: "Massachusetts", credit: 3500 },
  "MI":    { label: "Michigan", credit: 2000 },
  "MN":    { label: "Minnesota", credit: 2500 },
  "MS":    { label: "Mississippi", credit: 0 },
  "MO":    { label: "Missouri", credit: 0 },
  "MT":    { label: "Montana", credit: 0 },
  "NE":    { label: "Nebraska", credit: 0 },
  "NV":    { label: "Nevada", credit: 2500 },
  "NH":    { label: "New Hampshire", credit: 0 },
  "NJ":    { label: "New Jersey", credit: 4000 },
  "NM":    { label: "New Mexico", credit: 2500 },
  "NY":    { label: "New York", credit: 2000 },
  "NC":    { label: "North Carolina", credit: 0 },
  "ND":    { label: "North Dakota", credit: 0 },
  "OH":    { label: "Ohio", credit: 0 },
  "OK":    { label: "Oklahoma", credit: 0 },
  "OR":    { label: "Oregon", credit: 7500 },
  "PA":    { label: "Pennsylvania", credit: 3000 },
  "RI":    { label: "Rhode Island", credit: 2500 },
  "SC":    { label: "South Carolina", credit: 0 },
  "SD":    { label: "South Dakota", credit: 0 },
  "TN":    { label: "Tennessee", credit: 0 },
  "TX":    { label: "Texas", credit: 2500 },
  "UT":    { label: "Utah", credit: 0 },
  "VT":    { label: "Vermont", credit: 4000 },
  "VA":    { label: "Virginia", credit: 2500 },
  "WA":    { label: "Washington", credit: 0 },
  "WV":    { label: "West Virginia", credit: 0 },
  "WI":    { label: "Wisconsin", credit: 0 },
  "WY":    { label: "Wyoming", credit: 0 },
  "DC":    { label: "Washington D.C.", credit: 4000 },
};
