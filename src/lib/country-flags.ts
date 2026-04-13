const WHITE_FLAG_EMOJI = String.fromCodePoint(0x1f3f3);
const DISPLAY_NAME_LOCALES = [
  "en",
  "pl",
  "de",
  "fr",
  "es",
  "it",
  "pt",
  "nl",
  "uk",
] as const;
const ALPHA2_EQUIVALENTS: Record<string, string> = {
  UK: "GB",
  FX: "FR",
  EL: "GR",
};

const COUNTRY_NAME_TO_CODE_ENTRIES: Array<[string, string]> = [
  ["Afghanistan", "AF"],
  ["Albania", "AL"],
  ["Algeria", "DZ"],
  ["Andorra", "AD"],
  ["Angola", "AO"],
  ["Antigua and Barbuda", "AG"],
  ["Argentina", "AR"],
  ["Armenia", "AM"],
  ["Australia", "AU"],
  ["Austria", "AT"],
  ["Azerbaijan", "AZ"],
  ["Bahamas", "BS"],
  ["Bahrain", "BH"],
  ["Bangladesh", "BD"],
  ["Barbados", "BB"],
  ["Belarus", "BY"],
  ["Belgium", "BE"],
  ["Belize", "BZ"],
  ["Benin", "BJ"],
  ["Bhutan", "BT"],
  ["Bolivia", "BO"],
  ["Bosnia and Herzegovina", "BA"],
  ["Botswana", "BW"],
  ["Brazil", "BR"],
  ["Brunei", "BN"],
  ["Bulgaria", "BG"],
  ["Burkina Faso", "BF"],
  ["Burundi", "BI"],
  ["Cambodia", "KH"],
  ["Cameroon", "CM"],
  ["Canada", "CA"],
  ["Cape Verde", "CV"],
  ["Central African Republic", "CF"],
  ["Chad", "TD"],
  ["Chile", "CL"],
  ["China", "CN"],
  ["Colombia", "CO"],
  ["Comoros", "KM"],
  ["Congo", "CG"],
  ["Democratic Republic of the Congo", "CD"],
  ["Costa Rica", "CR"],
  ["Cote d'Ivoire", "CI"],
  ["Croatia", "HR"],
  ["Cuba", "CU"],
  ["Cyprus", "CY"],
  ["Czechia", "CZ"],
  ["Denmark", "DK"],
  ["Djibouti", "DJ"],
  ["Dominica", "DM"],
  ["Dominican Republic", "DO"],
  ["Ecuador", "EC"],
  ["Egypt", "EG"],
  ["El Salvador", "SV"],
  ["Equatorial Guinea", "GQ"],
  ["Eritrea", "ER"],
  ["Estonia", "EE"],
  ["Eswatini", "SZ"],
  ["Ethiopia", "ET"],
  ["Fiji", "FJ"],
  ["Finland", "FI"],
  ["France", "FR"],
  ["Gabon", "GA"],
  ["Gambia", "GM"],
  ["Georgia", "GE"],
  ["Germany", "DE"],
  ["Ghana", "GH"],
  ["Greece", "GR"],
  ["Grenada", "GD"],
  ["Guatemala", "GT"],
  ["Guinea", "GN"],
  ["Guinea-Bissau", "GW"],
  ["Guyana", "GY"],
  ["Haiti", "HT"],
  ["Honduras", "HN"],
  ["Hungary", "HU"],
  ["Iceland", "IS"],
  ["India", "IN"],
  ["Indonesia", "ID"],
  ["Iran", "IR"],
  ["Iraq", "IQ"],
  ["Ireland", "IE"],
  ["Israel", "IL"],
  ["Italy", "IT"],
  ["Jamaica", "JM"],
  ["Japan", "JP"],
  ["Jordan", "JO"],
  ["Kazakhstan", "KZ"],
  ["Kenya", "KE"],
  ["Kiribati", "KI"],
  ["Kuwait", "KW"],
  ["Kyrgyzstan", "KG"],
  ["Laos", "LA"],
  ["Latvia", "LV"],
  ["Lebanon", "LB"],
  ["Lesotho", "LS"],
  ["Liberia", "LR"],
  ["Libya", "LY"],
  ["Liechtenstein", "LI"],
  ["Lithuania", "LT"],
  ["Luxembourg", "LU"],
  ["Madagascar", "MG"],
  ["Malawi", "MW"],
  ["Malaysia", "MY"],
  ["Maldives", "MV"],
  ["Mali", "ML"],
  ["Malta", "MT"],
  ["Marshall Islands", "MH"],
  ["Mauritania", "MR"],
  ["Mauritius", "MU"],
  ["Mexico", "MX"],
  ["Micronesia", "FM"],
  ["Moldova", "MD"],
  ["Monaco", "MC"],
  ["Mongolia", "MN"],
  ["Montenegro", "ME"],
  ["Morocco", "MA"],
  ["Mozambique", "MZ"],
  ["Myanmar", "MM"],
  ["Namibia", "NA"],
  ["Nauru", "NR"],
  ["Nepal", "NP"],
  ["Netherlands", "NL"],
  ["New Zealand", "NZ"],
  ["Nicaragua", "NI"],
  ["Niger", "NE"],
  ["Nigeria", "NG"],
  ["North Korea", "KP"],
  ["North Macedonia", "MK"],
  ["Norway", "NO"],
  ["Oman", "OM"],
  ["Pakistan", "PK"],
  ["Palau", "PW"],
  ["Palestine", "PS"],
  ["Panama", "PA"],
  ["Papua New Guinea", "PG"],
  ["Paraguay", "PY"],
  ["Peru", "PE"],
  ["Philippines", "PH"],
  ["Poland", "PL"],
  ["Portugal", "PT"],
  ["Qatar", "QA"],
  ["Romania", "RO"],
  ["Russia", "RU"],
  ["Rwanda", "RW"],
  ["Saint Kitts and Nevis", "KN"],
  ["Saint Lucia", "LC"],
  ["Saint Vincent and the Grenadines", "VC"],
  ["Samoa", "WS"],
  ["San Marino", "SM"],
  ["Sao Tome and Principe", "ST"],
  ["Saudi Arabia", "SA"],
  ["Senegal", "SN"],
  ["Serbia", "RS"],
  ["Seychelles", "SC"],
  ["Sierra Leone", "SL"],
  ["Singapore", "SG"],
  ["Slovakia", "SK"],
  ["Slovenia", "SI"],
  ["Solomon Islands", "SB"],
  ["Somalia", "SO"],
  ["South Africa", "ZA"],
  ["South Korea", "KR"],
  ["South Sudan", "SS"],
  ["Spain", "ES"],
  ["Sri Lanka", "LK"],
  ["Sudan", "SD"],
  ["Suriname", "SR"],
  ["Sweden", "SE"],
  ["Switzerland", "CH"],
  ["Syria", "SY"],
  ["Taiwan", "TW"],
  ["Tajikistan", "TJ"],
  ["Tanzania", "TZ"],
  ["Thailand", "TH"],
  ["Timor-Leste", "TL"],
  ["Togo", "TG"],
  ["Tonga", "TO"],
  ["Trinidad and Tobago", "TT"],
  ["Tunisia", "TN"],
  ["Turkey", "TR"],
  ["Turkmenistan", "TM"],
  ["Tuvalu", "TV"],
  ["Uganda", "UG"],
  ["Ukraine", "UA"],
  ["United Arab Emirates", "AE"],
  ["United Kingdom", "GB"],
  ["United States", "US"],
  ["Uruguay", "UY"],
  ["Uzbekistan", "UZ"],
  ["Vanuatu", "VU"],
  ["Vatican City", "VA"],
  ["Venezuela", "VE"],
  ["Vietnam", "VN"],
  ["Yemen", "YE"],
  ["Zambia", "ZM"],
  ["Zimbabwe", "ZW"],
];

const COUNTRY_ALIAS_ENTRIES: Array<[string, string]> = [
  ["UK", "GB"],
  ["Great Britain", "GB"],
  ["England", "GB"],
  ["Scotland", "GB"],
  ["Wales", "GB"],
  ["Northern Ireland", "GB"],
  ["USA", "US"],
  ["U.S.A.", "US"],
  ["United States of America", "US"],
  ["Czech Republic", "CZ"],
  ["Russian Federation", "RU"],
  ["Korea, South", "KR"],
  ["Korea, North", "KP"],
  ["Ivory Coast", "CI"],
  ["Cabo Verde", "CV"],
  ["Macedonia", "MK"],
  ["Republic of Moldova", "MD"],
  ["Viet Nam", "VN"],
  ["Bolivia, Plurinational State of", "BO"],
  ["Venezuela, Bolivarian Republic of", "VE"],
  ["Lao People's Democratic Republic", "LA"],
  ["Syrian Arab Republic", "SY"],
  ["United Republic of Tanzania", "TZ"],
  ["Taiwan, Province of China", "TW"],
  ["Brunei Darussalam", "BN"],
  ["Republic of Korea", "KR"],
  ["Democratic People's Republic of Korea", "KP"],
  ["Kosovo", "XK"],
];

const ALPHA3_TO_ALPHA2: Record<string, string> = {
  USA: "US",
  GBR: "GB",
  DEU: "DE",
  FRA: "FR",
  ITA: "IT",
  ESP: "ES",
  POL: "PL",
  NLD: "NL",
  BEL: "BE",
  CHE: "CH",
  AUT: "AT",
  CZE: "CZ",
  SVK: "SK",
  HUN: "HU",
  ROU: "RO",
  BGR: "BG",
  GRC: "GR",
  TUR: "TR",
  UKR: "UA",
  LTU: "LT",
  LVA: "LV",
  EST: "EE",
  SWE: "SE",
  NOR: "NO",
  FIN: "FI",
  DNK: "DK",
  PRT: "PT",
  IRL: "IE",
  ISL: "IS",
  CAN: "CA",
  MEX: "MX",
  BRA: "BR",
  ARG: "AR",
  CHL: "CL",
  COL: "CO",
  PER: "PE",
  ZAF: "ZA",
  EGY: "EG",
  MAR: "MA",
  NGA: "NG",
  KEN: "KE",
  ETH: "ET",
  SAU: "SA",
  ARE: "AE",
  ISR: "IL",
  IRN: "IR",
  QAT: "QA",
  KWT: "KW",
  IND: "IN",
  PAK: "PK",
  BGD: "BD",
  CHN: "CN",
  JPN: "JP",
  KOR: "KR",
  PRK: "KP",
  VNM: "VN",
  THA: "TH",
  IDN: "ID",
  MYS: "MY",
  SGP: "SG",
  AUS: "AU",
  NZL: "NZ",
};

let lookupMap: Map<string, string> | null = null;

const REGION_CODES: string[] = Array.from(
  new Set<string>([
    ...COUNTRY_NAME_TO_CODE_ENTRIES.map(([, code]) => code),
    ...COUNTRY_ALIAS_ENTRIES.map(([, code]) => code),
    "XK",
  ]),
).map((code) => code.trim().toUpperCase());

function normalizeLookupKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,'`-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function addLocalizedDisplayNames(map: Map<string, string>, add: (name: string, code: string) => void): void {
  if (typeof Intl.DisplayNames !== "function") {
    return;
  }

  for (const locale of DISPLAY_NAME_LOCALES) {
    let displayNames: Intl.DisplayNames;
    try {
      displayNames = new Intl.DisplayNames([locale], { type: "region" });
    } catch {
      continue;
    }

    for (const code of REGION_CODES) {
      const localizedName = displayNames.of(code);
      if (!localizedName || localizedName === code) {
        continue;
      }
      add(localizedName, code);
    }
  }
}

function buildLookupMap(): Map<string, string> {
  const map = new Map<string, string>();
  const add = (name: string, code: string) => {
    map.set(normalizeLookupKey(name), canonicalizeAlpha2Code(code));
  };

  for (const [name, code] of COUNTRY_NAME_TO_CODE_ENTRIES) {
    add(name, code);
  }
  for (const [name, code] of COUNTRY_ALIAS_ENTRIES) {
    add(name, code);
  }
  addLocalizedDisplayNames(map, add);

  return map;
}

function getLookupMap(): Map<string, string> {
  if (!lookupMap) {
    lookupMap = buildLookupMap();
  }
  return lookupMap;
}

function canonicalizeAlpha2Code(input: string): string {
  const upper = input.trim().toUpperCase();
  return ALPHA2_EQUIVALENTS[upper] ?? upper;
}

function getMaxAllowedFuzzyDistance(length: number): number {
  if (length <= 4) {
    return 1;
  }
  if (length <= 9) {
    return 4;
  }
  if (length <= 12) {
    return 3;
  }
  return 4;
}

function levenshteinDistance(source: string, target: string): number {
  if (source === target) {
    return 0;
  }
  if (source.length === 0) {
    return target.length;
  }
  if (target.length === 0) {
    return source.length;
  }

  const previousRow = new Array<number>(target.length + 1);
  const currentRow = new Array<number>(target.length + 1);

  for (let j = 0; j <= target.length; j += 1) {
    previousRow[j] = j;
  }

  for (let i = 1; i <= source.length; i += 1) {
    currentRow[0] = i;
    for (let j = 1; j <= target.length; j += 1) {
      const substitutionCost = source[i - 1] === target[j - 1] ? 0 : 1;
      currentRow[j] = Math.min(
        previousRow[j] + 1,
        currentRow[j - 1] + 1,
        previousRow[j - 1] + substitutionCost,
      );
    }
    for (let j = 0; j <= target.length; j += 1) {
      previousRow[j] = currentRow[j];
    }
  }

  return previousRow[target.length];
}

export function resolveCountryCodeFromInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  if (/^[A-Za-z]{2}$/.test(trimmed)) {
    return canonicalizeAlpha2Code(trimmed);
  }

  if (/^[A-Za-z]{3}$/.test(trimmed)) {
    const resolved = ALPHA3_TO_ALPHA2[trimmed.toUpperCase()];
    if (resolved) {
      return resolved;
    }
  }

  const mapped = getLookupMap().get(normalizeLookupKey(trimmed));
  return mapped ? canonicalizeAlpha2Code(mapped) : null;
}

export function resolveCountryCodeFromInputApprox(input: string): string | null {
  const directMatch = resolveCountryCodeFromInput(input);
  if (directMatch) {
    return directMatch;
  }

  const normalizedInput = normalizeLookupKey(input);
  if (!normalizedInput || normalizedInput.length < 4) {
    return null;
  }

  const maxAllowedDistance = getMaxAllowedFuzzyDistance(normalizedInput.length);
  let bestCode: string | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  let hasAmbiguousBestMatch = false;

  for (const [candidateKey, code] of getLookupMap()) {
    if (Math.abs(candidateKey.length - normalizedInput.length) > maxAllowedDistance) {
      continue;
    }

    const distance = levenshteinDistance(normalizedInput, candidateKey);
    if (distance > maxAllowedDistance) {
      continue;
    }

    if (distance < bestDistance) {
      bestDistance = distance;
      bestCode = code;
      hasAmbiguousBestMatch = false;
      continue;
    }

    if (distance === bestDistance && bestCode && bestCode !== code) {
      hasAmbiguousBestMatch = true;
    }
  }

  if (!bestCode || hasAmbiguousBestMatch) {
    return null;
  }

  return canonicalizeAlpha2Code(bestCode);
}

export function countryCodeToFlagEmoji(countryCode: string): string {
  const normalized = canonicalizeAlpha2Code(countryCode);
  if (!/^[A-Z]{2}$/.test(normalized)) {
    return WHITE_FLAG_EMOJI;
  }

  const characters = normalized
    .split("")
    .map((char) => String.fromCodePoint(char.charCodeAt(0) + 127397))
    .join("");

  return characters || WHITE_FLAG_EMOJI;
}

export function getCountryFlagEmoji(countryNameOrCode: string | null | undefined): string {
  const value = countryNameOrCode?.trim();
  if (!value) {
    return WHITE_FLAG_EMOJI;
  }

  const countryCode = resolveCountryCodeFromInput(value);
  if (!countryCode) {
    return WHITE_FLAG_EMOJI;
  }

  return countryCodeToFlagEmoji(countryCode);
}

export function getCountryFlagSvgUrl(countryNameOrCode: string | null | undefined): string | null {
  const value = countryNameOrCode?.trim();
  if (!value) {
    return null;
  }

  const countryCode = resolveCountryCodeFromInput(value);
  if (!countryCode) {
    return null;
  }

  const canonicalCode = canonicalizeAlpha2Code(countryCode);
  return `/api/flags/${canonicalCode.toLowerCase()}`;
}
