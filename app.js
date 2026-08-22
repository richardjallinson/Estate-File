/* Estate File. An executor's private record of settling an estate.
   Everything is on the device. Nothing is sent anywhere, there is no account
   and no server. This app is not affiliated with any government department and
   does not give legal, tax or financial advice; it keeps the executor's own record. */

const { useState, useMemo, useEffect, useRef } = React;
const h = React.createElement;

const APP_VERSION = "v1K";

// ---- Day and night.
//
// Two palettes, one shape, and T is a live binding the way LANG and
// TEXT_SCALE are: hundreds of style objects read it during a render, and the
// switch is a reassignment plus a re-render.
//
// Night is not an inversion filter. The identity survives - navy chrome,
// gold accents, the flag-red leaf - but every pairing was chosen again for a
// dark ground. Text colours got lighter, button faces got darker, and the
// accent colours split from their button duties (see onAccent below),
// because a red that reads as a warning on cream and a red that carries
// white button text on near-black cannot be the same red.
//
// Night mode also matters during long sessions reviewing estate paperwork,
// especially when the app is being used in low light.
const PALETTES = {
  light: {
  navy: "#141A33",
  cream: "#FBF8F0",
  card: "#FFFFFF",
  gold: "#B8912F",
  goldSoft: "#F3E9CE",
  line: "#E4DFD0",
  ink: "#1E2233",
  inkSoft: "#6B6F7E",
  green: "#3F7A5A",
  red: "#A94438",
  // Flag red, used only for the maple leaf mark. Deliberately a separate
  // token from T.red: the muted red carries warnings and the crisis panel,
  // and the national symbol should not share a colour with an error state.
  maple: "#C8102E",
  amber: "#9A6B1F",
  blue: "#4166AB",
  blueSoft: "#EFF2F8",
  tabIdle: "#C9CFDE",
    // Semantic tokens, split out so day and night can disagree.
    heading: "#141A33",   // display headings; navy by day, near-cream by night
    header: "#141A33",    // the chrome: header bar, lock screen, intro
    primary: "#141A33",   // primary button faces, white text in both themes
    btn2: "#FFFFFF",      // secondary button faces
    field: "#FFFFFF",     // inputs
    onAccent: "#FFFFFF"   // text on gold, blue, red and green button faces
  },
  dark: {
    navy: "#141A33",
    cream: "#FBF8F0",
    card: "#1A2140",
    gold: "#D4AC55",
    goldSoft: "#2B2412",
    line: "#2E3554",
    ink: "#EAE7DC",
    inkSoft: "#A8AEC4",
    green: "#7CBB95",
    red: "#E08A7C",
    maple: "#E23A4B",
    amber: "#D2A254",
    blue: "#8FABE0",
    blueSoft: "#1B2542",
    tabIdle: "#6A7291",
    heading: "#F0EDE2",
    header: "#0C1020",
    primary: "#3D4A7E",
    btn2: "#232A4C",
    field: "#151B36",
    onAccent: "#10142A",
    bg: "#101528"
  }
};
PALETTES.light.bg = "#FBF8F0";
let T = PALETTES.light;
const THEMES = [
  { id: "auto", label: "Follow the phone" },
  { id: "light", label: "Day" },
  { id: "dark", label: "Night" }
];
function systemPrefersDark() {
  try { return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches); } catch { return false; }
}
function resolveTheme(id) { return id === "dark" || (id === "auto" && systemPrefersDark()) ? "dark" : "light"; }
function setThemeTokens(id) {
  T = PALETTES[resolveTheme(id)];
  // The parts of the page the app does not draw itself: the body behind the
  // scroll, the status bar tint, and the browser's own form controls.
  try {
    document.body.style.background = T.bg;
    document.documentElement.style.colorScheme = resolveTheme(id);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", T.header);
  } catch {}
}
const font = {
  display: "'Iowan Old Style','Palatino Linotype',Georgia,serif",
  body: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
};

// The maple leaf mark. This is the leaf outline from the National Flag of
// Canada as published in Wikimedia's public-domain Flag_of_Canada.svg: the
// 1965 design's Crown copyright has expired and the file is tagged
// ineligible for copyright. Earlier versions hand-drew an approximation; a
// shape this famous has no margin for approximation. The app uses the leaf
// alone, respectfully, and none of the government's identity marks: no flag
// composition, no wordmark, no government insignia, and the About text states the
// non-affiliation plainly. tools/leaf.py renders the app icons from this
// same path, so the home-screen icon and this mark are literally the same
// shape. Decorative, so hidden from screen readers; the wordmark beside it
// carries the name.
// ---- Text size.
//
// Every font size in this app goes through fs(). The scale is a module-level
// value rather than React state for the same reason t() is: it is read inside
// hundreds of style objects during a render, and threading a prop through all
// of them would be noise.
//
// This exists because executors may be older, visually impaired, or simply
// working through dense material. iOS Dynamic Type does not reach text sized
// in px inside a web app.
// Without this the only recourse is pinch-zoom, which breaks the layout and
// has to be redone on every screen.
let TEXT_SCALE = 1;
const TEXT_SIZES = [
  { id: "normal", scale: 1, label: "Normal" },
  { id: "large", scale: 1.15, label: "Large" },
  { id: "larger", scale: 1.3, label: "Larger" },
  { id: "largest", scale: 1.5, label: "Largest" }
];
function setTextScale(s) { TEXT_SCALE = Number(s) || 1; }
function getTextScale() { return TEXT_SCALE; }
// Rounded to a tenth: sub-pixel font sizes make text render soft on some
// devices, and there is no visual gain from the extra precision.
const fs = (n) => Math.round(n * TEXT_SCALE * 10) / 10;

// Small display helpers shared by screens. Keeping these as named functions
// lets the test harness exercise them directly, so a missing helper cannot
// turn a whole sheet or tab into a blank screen.
function telHref(value) {
  const digits = String(value || "").replace(/[^0-9+*#]/g, "");
  return digits ? "tel:" + digits : "#";
}
function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return getLang() === "fr" ? "0 $" : "$0";
  const rounded = Math.round(n);
  return getLang() === "fr"
    ? rounded.toLocaleString("fr-CA") + " $"
    : "$" + rounded.toLocaleString("en-CA");
}
function moneyCents(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return getLang() === "fr" ? "0,00 $" : "$0.00";
  const formatted = n.toLocaleString(getLang() === "fr" ? "fr-CA" : "en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return getLang() === "fr" ? formatted + " $" : "$" + formatted;
}
function statementDef(id) {
  return STATEMENTS.find((s) => s.id === id) || STATEMENTS[0];
}
function wordCount(value) {
  const text = String(value || "").trim();
  return text ? text.split(/\s+/).length : 0;
}

const LEAF_VIEWBOX = "148 115 108 115";
const LEAF_PATH = "m201.9 116.1-9.1 17.4c-1 1.8-2.9 1.7-4.7.7l-6.6-3.4 4.9 26c1 4.8-2.3 4.8-4 2.7l-11.5-12.9-1.9 6.5c-.2.9-1.2 1.8-2.6 1.6l-14.5-3 3.8 13.9c.8 3.1 1.4 4.3-.8 5.1l-5.2 2.4 25 20.3c1 .8 1.5 2.2 1.1 3.5l-2.2 7.2c8.6-1 16.3-2.5 24.9-3.4.8-.1 2 1.2 2 2.1l-1.1 26.3h4.2l-.7-26.2c0-.9 1.1-2.3 1.9-2.2 8.6.9 16.3 2.4 24.9 3.4l-2.2-7.2c-.4-1.3.1-2.7 1.1-3.5l25-20.3-5.2-2.4c-2.2-.8-1.6-2-.8-5.1l3.8-13.9-14.5 3c-1.4.2-2.4-.7-2.6-1.6l-1.9-6.5-11.5 12.9c-1.7 2.1-5 2.1-4-2.7l4.9-26-6.6 3.4c-1.8 1-3.7 1.1-4.7-.7z";
const MapleLeaf = (props) => h("svg", {
  viewBox: LEAF_VIEWBOX,
  width: props.size || 28, height: props.size || 28,
  "aria-hidden": "true", focusable: "false",
  style: { display: "block", flex: "0 0 auto", ...(props.style || {}) }
}, h("path", { d: LEAF_PATH, fill: props.color || T.maple }));
// ============================================================================
// THE DOMAIN.
//
// Every fact below was checked against the government's own published pages
// during the build: if it could not be sourced, it is not here. The sources
// are named in READ-THIS-FIRST.txt with
// the date they were read, because these figures move.
//
// The line this app does not cross: it organises, it never advises. Probate
// and estate law are a lawyer's work, tax is an accountant's, and eligibility
// is decided by the CRA or Service Canada. This app keeps the executor's own
// record of the estate-settlement process without replacing professional advice.
// ============================================================================

// ---- What a survivor or an estate may be able to claim.
//
// A directory, not a screening tool. It does not ask questions and then tell
// somebody what they qualify for; Service Canada and the CRA decide that.
// What it fixes is the real problem: nobody tells a grieving family what
// exists, and benefits do not come looking for people.
const PROVINCES = [
  { id: "ON", label: "Ontario", short: "ON" },
  { id: "BC", label: "British Columbia", short: "B.C." },
  { id: "AB", label: "Alberta", short: "AB" },
  { id: "SK", label: "Saskatchewan", short: "SK" },
  { id: "MB", label: "Manitoba", short: "MB" },
  { id: "NS", label: "Nova Scotia", short: "N.S." },
  { id: "NB", label: "New Brunswick", short: "N.B." },
  { id: "NL", label: "Newfoundland and Labrador", short: "N.L." },
  { id: "PE", label: "Prince Edward Island", short: "P.E.I." },
  { id: "QC", label: "Quebec", short: "QC" },
  { id: "YT", label: "Yukon", short: "YT" },
  { id: "NT", label: "Northwest Territories", short: "NWT" },
  { id: "NU", label: "Nunavut", short: "NU" }
];
const normaliseProvinceId = (id) => {
  const key = String(id || "ON").trim().toUpperCase();
  return PROVINCES.some((p) => p.id === key) ? key : "ON";
};
const provinceDef = (id) => PROVINCES.find((p) => p.id === normaliseProvinceId(id)) || PROVINCES[0];

const BENEFIT_CATEGORIES = [
  { id: "cpp", label: "From the Canada Pension Plan" },
  { id: "other", label: "Other federal support" },
  { id: "prov", label: "Provincial / territorial estate information" }
];
function benefitCategories(province) {
  const p = provinceDef(province);
  return BENEFIT_CATEGORIES.map((c) => {
    if (c.id === "cpp" && p.id === "QC") return { ...c, label: "From the Québec Pension Plan" };
    if (c.id === "prov") return { ...c, label: p.label + " estate information", note: "Estate rules differ across Canada. This section follows the estate province or territory selected in the app." };
    return c;
  });
}

// Figures are the published 2026 amounts. Provincial court fees and filing
// rules below were checked against the official Ontario, B.C., Alberta,
// Saskatchewan, Manitoba, Nova Scotia, New Brunswick, Newfoundland and Labrador, Prince Edward Island, Quebec, Yukon, Northwest Territories and Nunavut sources in August 2026. They remain reference
// information, not legal advice.
const RATES_READ = "August 2026";

function ratesAreStale() {
  const m = RATES_READ.match(/(\d{4})/);
  if (!m) return true;
  return new Date().getFullYear() > Number(m[1]);
}

function benefitLinkText(url) {
  const info = frUrl(url);
  let label = "Open official page";
  if (/canada\.ca/i.test(url)) label = "Open official Canada.ca page";
  else if (/ontario\.ca/i.test(url)) label = "Open official Ontario.ca page";
  else if (/bclaws\.gov\.bc\.ca|gov\.bc\.ca/i.test(url)) label = "Open official B.C. page";
  else if (/alberta\.ca|surrogate\.alberta\.ca/i.test(url)) label = "Open official Alberta page";
  else if (/saskatchewan\.ca|sasklawcourts\.ca|ehealthsask\.ca/i.test(url)) label = "Open official Saskatchewan page";
  else if (/gov\.mb\.ca|manitobacourts\.mb\.ca|web2\.gov\.mb\.ca|vitalstats\.gov\.mb\.ca/i.test(url)) label = "Open official Manitoba page";
  else if (/novascotia\.ca|courts\.ns\.ca/i.test(url)) label = "Open official Nova Scotia page";
  else if (/gnb\.ca|laws\.gnb\.ca/i.test(url)) label = "Open official New Brunswick page";
  else if (/court\.nl\.ca|gov\.nl\.ca|assembly\.nl\.ca/i.test(url)) label = "Open official Newfoundland and Labrador page";
  else if (/princeedwardisland\.ca|courts\.pe\.ca/i.test(url)) label = "Open official Prince Edward Island page";
  else if (/quebec\.ca|etatcivil\.gouv\.qc\.ca|revenuquebec\.ca|retraitequebec\.gouv\.qc\.ca/i.test(url)) label = "Open official Quebec page";
  else if (/yukon\.ca|yukoncourts\.ca/i.test(url)) label = "Open official Yukon page";
  else if (/gov\.nt\.ca|justice\.gov\.nt\.ca|nwtcourts\.ca|hss\.gov\.nt\.ca/i.test(url)) label = "Open official Northwest Territories page";
  else if (/gov\.nu\.ca|nunavutcourts\.ca|nunavutlegislation\.ca|livehealthy\.gov\.nu\.ca/i.test(url)) label = "Open official Nunavut page";
  else if (/publiclegalinfo\.com/i.test(url)) label = "Open Public Legal Information page";
  else if (/legalinfopei\.ca/i.test(url)) label = "Open Community Legal Information page";
  return t(label) + (info.english ? t(" (page in English)") : "");
}

const FEDERAL_BENEFITS = [
  { id: "death", cat: "cpp", name: "CPP death benefit",
    what: "A one-time payment to the estate, or to certain people if there is no estate. Apply on form ISP1200. Service Canada suggests applying within 60 days of the death.",
    rate: "$2,500. A further $2,500 only if the person died before ever collecting a CPP retirement or disability pension AND left no surviving spouse or common-law partner.",
    url: "https://www.canada.ca/en/services/benefits/publicpensions/cpp/payment-amounts.html" },
  { id: "survivor", cat: "cpp", name: "CPP survivor's pension",
    what: "A monthly pension to a surviving spouse or common-law partner. Shares one form, ISP1300, with the children's benefit. CPP back-pays a maximum of 12 months, so applying late costs money.",
    rate: "Maximum $803.54 a month under 65, $904.59 at 65 and over. The amount depends on the deceased's contributions and your own age.",
    url: "https://www.canada.ca/en/services/benefits/publicpensions/cpp/payment-amounts.html" },
  { id: "children", cat: "cpp", name: "CPP children's benefit",
    what: "A monthly payment for a dependent child of the person who died. Same form as the survivor's pension.",
    rate: "$307.81 a month under 18, or 18 to 25 in full-time study. $153.91 part-time.",
    url: "https://www.canada.ca/en/services/benefits/publicpensions/cpp/payment-amounts.html" },
  { id: "oascancel", cat: "other", name: "Cancelling CPP and OAS",
    what: "Not a benefit, but the first call that saves money. Benefits are payable for the month of the death and no further. Anything paid after that has to be repaid, and Service Canada does catch it, often months later, with the demand landing on the executor.",
    rate: "The number is under Help, at the top of any screen.",
    url: "https://www.canada.ca/en/services/life-events/death/notify.html" },
  { id: "gis", cat: "other", name: "A survivor's own benefits, recalculated",
    what: "Once the CRA knows about the death, income-tested benefits are recalculated on the survivor's income alone. A surviving spouse may qualify for more GST/HST credit, or for the Guaranteed Income Supplement, than before. This only happens if the CRA is told.",
    rate: "Varies with income.",
    url: "https://www.canada.ca/en/revenue-agency/services/tax/individuals/life-events/what-when-someone-died.html" },
  { id: "ei", cat: "other", name: "Employment Insurance",
    what: "If the person was receiving, or might have been eligible for, EI benefits, Service Canada can say what happens next and what they need.",
    rate: "The number is under Help, at the top of any screen.",
    url: "https://www.canada.ca/en/services/life-events/death/notify.html" }
];

const QUEBEC_PENSION_BENEFITS = [
  { id: "qppdeath", cat: "cpp", name: "QPP death benefit",
    what: "A one-time benefit where the deceased contributed sufficiently to the Québec Pension Plan. During the first 60 days after death, priority can go to the person or charity that paid the funeral expenses and provides proof of payment; after that, heirs can qualify under the published rules.",
    rate: "Maximum $2,500. The application can be filed up to 5 years after death, but the first 60 days affect payment priority.",
    url: "https://www.retraitequebec.gouv.qc.ca/en/citizens/death/death-benefit-quebec-pension-plan" },
  { id: "qppsurvivor", cat: "cpp", name: "QPP surviving spouse's pension",
    what: "A taxable monthly pension for a qualifying surviving spouse where the deceased contributed sufficiently to the Québec Pension Plan. The amount depends on the deceased's contributions, the survivor's age and circumstances, and any retirement or disability pension already being received.",
    rate: "2026 maximums vary by situation; the published maximum reaches $1,173.58 a month for several under-65 categories.",
    url: "https://www.retraitequebec.gouv.qc.ca/en/citizens/death/surviving-spouse-pension" },
  { id: "qpporphan", cat: "cpp", name: "QPP orphan's pension",
    what: "A taxable monthly pension paid to the person who supports an eligible child of a deceased contributor. Under the QPP, the child must be under 18.",
    rate: "$307.81 a month per eligible child in 2026. Apply promptly; retroactive payment is normally limited to 12 months.",
    url: "https://www.retraitequebec.gouv.qc.ca/en/citizens/death/orphan-pension" },
  { id: "qppcoord", cat: "cpp", name: "QPP and CPP contributions can interact",
    what: "If the deceased also contributed to the Canada Pension Plan, Retraite Québec says those contributions are taken into account when determining whether a QPP pension or benefit may be payable and its amount. Use Retraite Québec or Service Canada for the person's actual contribution history.",
    rate: "Do not assume that a Quebec death means only one plan matters; contribution history controls.",
    url: "https://www.retraitequebec.gouv.qc.ca/en/programs/quebec-pension-plan" }
];

const PROVINCIAL_BENEFITS = {
  ON: [
    { id: "eat", cat: "prov", name: "Estate Administration Tax",
      what: "Ontario's probate tax, paid to the court when you apply for an estate certificate. The Probate tab works out the figure from an estate value you enter.",
      rate: "Nothing on the first $50,000. $15 for every $1,000 or part of $1,000 above it.",
      url: "https://www.ontario.ca/page/estate-administration-tax" },
    { id: "eir", cat: "prov", name: "Estate Information Return",
      what: "A separate filing to the Ministry of Finance listing the estate information required by Ontario. It is generally required after an estate certificate is issued even when no Estate Administration Tax was payable.",
      rate: "Due within 180 calendar days after the estate certificate is issued.",
      url: "https://www.ontario.ca/page/estate-administration-tax" }
  ],
  BC: [
    { id: "bcfees", cat: "prov", name: "Probate fee and court filing fee",
      what: "B.C. charges a Probate Fee Act fee before a grant issues, plus a separate Supreme Court fee to commence the proceeding when the estate exceeds $25,000. The Probate tab calculates both from the value you enter.",
      rate: "No Probate Fee Act fee at $25,000 or less. Above that: $6 per $1,000 or part from $25,000 to $50,000, then $14 per $1,000 or part above $50,000. The separate court commencement fee is $200 when the estate exceeds $25,000.",
      url: "https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/00_99004_01",
      moreUrl: "https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/168_2009_06",
      moreLabel: "Open official B.C. Supreme Court fees" },
    { id: "bcwills", cat: "prov", name: "Wills search and P1 notice",
      what: "A wills-notice search is part of the B.C. grant process even if you believe you have the original will. Before applying, the intended applicant gives the required Form P1 notice and applicable materials.",
      rate: "The application cannot normally be made until at least 21 days after the required notice is delivered. A wills search is $20 for one name; alias and handling fees can also apply.",
      url: "https://www2.gov.bc.ca/gov/content/life-events/death/after-death/wills-estates" },
    { id: "bcforms", cat: "prov", name: "B.C. probate forms",
      what: "B.C. uses the Supreme Court Civil Rules P-series probate forms. Form P2 is the Submission for Estate Grant; the other forms depend on the circumstances.",
      rate: "Common forms include P1, P2, P3/P4 or P5, P9 and P10.",
      url: "https://www2.gov.bc.ca/gov/content/justice/courthouse-services/documents-forms-records/court-forms/probate-forms" }
  ],
  AB: [
    { id: "abfees", cat: "prov", name: "Alberta surrogate court fee",
      what: "Alberta uses a fixed Court of King's Bench fee for issuing a grant of probate or administration, based on the net value of property in Alberta. The Probate tab works out the fee band.",
      rate: "$35 up to $10,000; $135 over $10,000 to $25,000; $275 over $25,000 to $125,000; $400 over $125,000 to $250,000; $525 over $250,000.",
      url: "https://www.alberta.ca/court-fees" },
    { id: "absds", cat: "prov", name: "Surrogate Digital Service",
      what: "The Court of King's Bench Surrogate Digital Service can be used for most non-contentious estate grant applications. A paper application using the GA forms remains available.",
      rate: "Self-represented online applicants must meet the SDS requirements, including Alberta residency and being one of the applicants.",
      url: "https://surrogate.alberta.ca/" },
    { id: "abwill", cat: "prov", name: "Locating the will",
      what: "Alberta does not have a general will registry. The executor may need to search the deceased's records, safe-deposit box, lawyer or other likely storage locations.",
      rate: "No Alberta will-registry search is available for an ordinary will.",
      url: "https://www.alberta.ca/deceased-persons-estates" }
  ],
  SK: [
    { id: "skfees", cat: "prov", name: "Saskatchewan probate levy and filing fee",
      what: "A standard application for Letters Probate or Letters of Administration has a $200 Local Registrar filing fee plus a probate levy. Saskatchewan describes the levy as $7 on every $1,000 of value passing through the estate; the government application guidance calculates it from Total Part 1 Assets on the Statement of Property. The Probate tab calculates the standard filing fee and levy from the value you enter.",
      rate: "$7 for every $1,000 or portion of $1,000, plus the $200 filing fee. A Certificate of No Infants, when requested, is a separate $25 fee.",
      url: "https://sasklawcourts.ca/kings-bench/wills-and-estates/probating-an-estate/" },
    { id: "skforms", cat: "prov", name: "Saskatchewan probate application package",
      what: "The Court of King's Bench publishes a self-represented Letters Probate package for the straightforward situation where there is a will, the named executor is applying, and the will has two witnesses.",
      rate: "The package includes an Application for Grant of Probate, affidavits, Statement of Property and proof of death. Different circumstances can require administration forms or other material.",
      url: "https://sasklawcourts.ca/kings-bench/wills-and-estates/application-for-probate/" },
    { id: "skregistry", cat: "prov", name: "Wills and Estates Registry",
      what: "Saskatchewan's Wills and Estates Registry records estate applications filed in court. It can help identify whether an estate court file exists and where it is located; it is not a registry of every will made in Saskatchewan.",
      rate: "Registry records go back to 1883. The Law Society also provides a Lost Wills List process for lawyers who are trying to locate a will.",
      url: "https://sasklawcourts.ca/resources/common-questions/" },
    { id: "sksmall", cat: "prov", name: "Saskatchewan small-estate order",
      what: "If the deceased's personal property is $25,000 or less and no Saskatchewan real property will pass through the estate, the Court of King's Bench can make a small-estate order instead of issuing Letters Probate or Letters of Administration.",
      rate: "Form 16-36. The Local Registrar fee for this small-estate order is $100. A separate registrar-assisted grant process exists for qualifying estates of $15,000 or less and uses different fees.",
      url: "https://www.saskatchewan.ca/residents/births-deaths-marriages-and-divorces/dealing-with-death/administering-the-estate-of-someone-whos-died/estates-not-exceeding-25000" }
  ],
  MB: [
    { id: "mbfees", cat: "prov", name: "Manitoba probate application charge",
      what: "Manitoba eliminated charges relating to applications for probate or administration effective November 6, 2020. The current Court Services Fees Regulation lists other probate-service fees but no value-based charge for filing a probate or administration request. The Probate calculator therefore shows $0 for the application charge.",
      rate: "No value-based probate application charge. Separate court services can still have fees, including caveats, searches and certified documents.",
      url: "https://web2.gov.mb.ca/laws/regs/current/150-2021.php",
      moreUrl: "https://www.manitobacourts.mb.ca/site/assets/files/1152/2020-11-06_notice_-_elimination_of_probate_charges.pdf",
      moreLabel: "Open Manitoba court notice eliminating probate charges" },
    { id: "mbforms", cat: "prov", name: "Manitoba Rule 74 probate forms",
      what: "Manitoba Court of King's Bench probate work uses Rule 74 forms. Form 74A is the Request for Probate and Form 74B is the Inventory and Valuation of the Property of the Deceased.",
      rate: "Administration and other situations use different Rule 74 forms, including 74C and 74L. Use the current prescribed forms for the estate's circumstances.",
      url: "https://web2.gov.mb.ca/laws/rules/forms_e.php" },
    { id: "mbregistry", cat: "prov", name: "Probate Registry and estate-file search",
      what: "The Court of King's Bench Probate Division in Winnipeg is the central registry for Manitoba probate matters. Court and Archives searches locate estate files and wills that were filed as part of probate proceedings; that is not the same thing as a universal registry of every will made in Manitoba.",
      rate: "Computerized probate records from 1984 onward can be searched through the Court Registry System. Older estate files can be searched through the Archives of Manitoba.",
      url: "https://www.manitobacourts.mb.ca/court-of-queens-bench/frequently-asked-questions/probate-division/",
      moreUrl: "https://www.gov.mb.ca/chc/archives/estate/index.html",
      moreLabel: "Open Archives of Manitoba estate-file search" },
    { id: "mbsmall", cat: "prov", name: "Manitoba summary administration for a small estate",
      what: "Section 47 of The Court of King's Bench Surrogate Practice Act allows the court, where the total value of all of the deceased's property does not exceed $10,000, to make a summary administration order without a grant of probate or administration.",
      rate: "The current Rule 74 form list includes Form 74FF, Request for Order under Section 47. The court decides whether the summary procedure applies.",
      url: "https://web2.gov.mb.ca/laws/statutes/ccsm/c290.php?lang=en",
      moreUrl: "https://web2.gov.mb.ca/laws/rules/forms_e.php",
      moreLabel: "Open current Manitoba Rule 74 forms" }
  ],
  NS: [
    { id: "nsfees", cat: "prov", name: "Nova Scotia probate tax",
      what: "Nova Scotia charges probate tax by estate-value band when a grant is issued. The Probate tab calculates the published tax from the value you enter.",
      rate: "$85.60 up to $10,000; $215.20 over $10,000 to $25,000; $358.15 over $25,000 to $50,000; $1,002.65 over $50,000 to $100,000; above $100,000, $1,002.65 plus $16.95 for every $1,000 or part over $100,000.",
      url: "https://www.courts.ns.ca/resources/public/costs-fees" },
    { id: "nsforms", cat: "prov", name: "Nova Scotia probate forms and original will",
      what: "Nova Scotia Probate Court applications use the forms in the Probate Court Practice, Procedure and Forms Regulations. A probate application uses Form 8; administration uses other forms depending on the circumstances. For probate filings, the original will is included as an exhibit to the required affidavit.",
      rate: "Use the current Probate Court forms and requirements for the estate's circumstances.",
      url: "https://www.courts.ns.ca/courts/probate-court" },
    { id: "nspostgrant", cat: "prov", name: "Nova Scotia inventory and Royal Gazette notice",
      what: "After a grant, the personal representative must file the estate inventory in Form 29 within 3 months. Estate notices are advertised in the Royal Gazette for 6 months before the estate proceeds to settlement and distribution.",
      rate: "The current Royal Gazette Estate Notice advertising fee is $68.15 including HST. It is separate from the probate-tax estimate.",
      url: "https://novascotia.ca/just/regulations/regs/probregs.htm",
      moreUrl: "https://novascotia.ca/Just/Regulations/advertising.htm",
      moreLabel: "Open Nova Scotia Royal Gazette estate-notice fees" }
  ],
  NB: [
    { id: "nbfees", cat: "prov", name: "New Brunswick probate tax",
      what: "New Brunswick charges probate tax on a grant of common probate or letters of administration. The rates changed for applications filed on or after June 12, 2026. The Probate tab calculates the current tax from the estate value you enter.",
      rate: "$200 up to $20,000; from over $20,000 to $100,000, $200 plus $5 per $1,000 or part over $20,000; above $100,000, $600 plus $15 per $1,000 or part over $100,000.",
      url: "https://www.gnb.ca/content/cour/en/probate-court.html",
      moreUrl: "https://laws.gnb.ca/en/document/cs/P-17.1/",
      moreLabel: "Open New Brunswick Probate Court Act" },
    { id: "nbforms", cat: "prov", name: "New Brunswick probate forms and waiting periods",
      what: "Letters Probate use Form 2A or 2B; administration with the will annexed uses Form 2C or 2D; administration without a will uses Form 2E or 2F. The current rules require 7 days to lapse after death before probate or administration with will annexed can be granted, and 14 days for administration of an intestate estate.",
      rate: "A copy of the death certificate is accepted for the basic application; the original is not required. The court's current checklist also calls for detailed estate-value information.",
      url: "https://www.gnb.ca/content/dam/courts/pdf/probate-court-cour-des-successions/general-check-list-for-probate-applications.pdf" },
    { id: "nbcourt", cat: "prov", name: "New Brunswick Probate Court filing",
      what: "An application can be presented to the Probate Office in the judicial district where the deceased lived at death or where the deceased had property. The Probate Court publishes locations, forms, a checklist and current filing information.",
      rate: "Separate sundry court fees can apply in addition to probate tax; the basic calculator does not add case-specific fees.",
      url: "https://www.gnb.ca/content/cour/en/probate-court.html" }
  ],
  NL: [
    { id: "nlfees", cat: "prov", name: "Newfoundland and Labrador probate / administration court charge",
      what: "A charge is payable when Letters of Probate or Administration, or a resealed foreign grant, is issued. The Probate tab calculates the published amount from the estate value entered from the inventory and valuation.",
      rate: "$60 where the estate value does not exceed $1,000; above $1,000, $60 plus 0.6% of the portion over $1,000 ($0.60 per additional $100).",
      url: "https://www.court.nl.ca/supreme/schedule-of-fees/",
      moreUrl: "https://www.assembly.nl.ca/legislation/sr/statutes/s13-2.htm",
      moreLabel: "Open Newfoundland and Labrador Services Charges Act" },
    { id: "nlnnotice", cat: "prov", name: "Notice of Application and 5-day wait",
      what: "The first step for Probate, Administration and Administration C.T.A. is to post a Notice of Application with the Supreme Court Registry. If the 5-day notice period passes with no caveat or previous grant, the applicant can proceed with the petition.",
      rate: "The court directs applicants to confirm with the Registry after the 5-day notice period before proceeding.",
      url: "https://www.court.nl.ca/supreme/rules-practice-notes-and-forms/civil-proceedings/probate-and-admin/" },
    { id: "nlforms", cat: "prov", name: "Rule 56 forms, inventory and valuation",
      what: "Newfoundland and Labrador uses Rule 56 estate forms. The petition is accompanied by an inventory and valuation listing property and assets of the deceased located in Newfoundland and Labrador; the inventory value is used to set the court charge.",
      rate: "Common forms include 56.04A Notice of Application, 56.05A Petition and 56.10A Inventory and Valuation. Probate applications also include the will and Proof of Will.",
      url: "https://www.court.nl.ca/supreme/rules-practice-notes-and-forms/civil-proceedings/probate-and-admin/" }
  ],
  PE: [
    { id: "pefees", cat: "prov", name: "Prince Edward Island probate petition fee",
      what: "P.E.I.'s Probate Act sets petition fees by the probate value of the estate. The Probate tab calculates the standard petition fee for probate or administration from the value entered.",
      rate: "$50 up to $10,000; $100 from $10,001 to $25,000; $200 from $25,001 to $50,000; $400 from $50,001 to $100,000; above $100,000, $400 plus $4 per $1,000 or fraction over $100,000.",
      url: "https://www.princeedwardisland.ca/en/legislation/probate-act" },
    { id: "peforms", cat: "prov", name: "P.E.I. Rule 65 estate forms",
      what: "Applications for Letters Probate or Letters of Administration are made by petition in the Supreme Court of Prince Edward Island, Estates Section. Rule 65 prescribes the forms used for the application.",
      rate: "Form 65A is Petition for Probate, 65B is Administration with Will Annexed, 65C is Administration, 65E is Inventory of Estate and 65F is Proof of Will.",
      url: "https://www.courts.pe.ca/forms" },
    { id: "penotice", cat: "prov", name: "P.E.I. inventory, estate notice and beneficiary notice",
      what: "The Probate Act requires an inventory before the grant. After probate or administration is granted, the Registrar publishes an estate notice in the Gazette calling for demands within six months, and the personal representative has beneficiary-notice duties.",
      rate: "Where a beneficiary's address is known, notice of the grant is served within one month from the time the address is or becomes known. Special service rules apply in other situations.",
      url: "https://www.princeedwardisland.ca/en/legislation/probate-act" }
  ],
  QC: [
    { id: "qcwillsearch", cat: "prov", name: "Mandatory Quebec will search",
      what: "A will search is mandatory when settling a Quebec succession. The single portal sends the request to both the Barreau du Québec and the Chambre des notaires du Québec, and two search certificates are produced.",
      rate: "Do the search even when the family believes it already has the latest will. A handwritten or witnessed will may also need to be located outside the registries.",
      url: "https://www.quebec.ca/en/justice-et-etat-civil/testament-succession/succession/to-do/will-search" },
    { id: "qcprobate", cat: "prov", name: "Quebec will verification",
      what: "Quebec uses civil-law succession rules. A notarial will is an authentic act and does not need probate. A holograph will or a will made before witnesses must be probated after death by a notary or the Superior Court.",
      rate: "There is no estate-value probate tax. Court or notary costs depend on the route used to verify a non-notarial will.",
      url: "https://www.quebec.ca/en/justice-et-etat-civil/testament-succession/succession/settlement/succession-will/probating" },
    { id: "qcliquidator", cat: "prov", name: "Liquidator designation and inventory",
      what: "The person settling a Quebec succession is the liquidator. The liquidator's designation must be registered in the RDPRM. The liquidator must make an inventory and publish a notice of closure in the RDPRM and in a local newspaper.",
      rate: "The Quebec government currently lists a $59 RDPRM fee for registering the liquidator designation and a separate $59 fee for the notice of closure of inventory.",
      url: "https://www.quebec.ca/en/justice-et-etat-civil/testament-succession/succession/to-do/liquidator/appointment",
      moreUrl: "https://www.quebec.ca/en/justice-et-etat-civil/testament-succession/succession/settlement/notice-closure",
      moreLabel: "Open Quebec inventory-notice page" },
    { id: "qcrenounce", cat: "prov", name: "Accepting or renouncing the succession",
      what: "A successor generally has six months from the date of death to accept or renounce a Quebec succession. The period can be extended so the person has at least 60 days after closure of the inventory.",
      rate: "Wait for the inventory information before making a decision where possible; actions can have legal consequences.",
      url: "https://www.quebec.ca/en/justice-et-etat-civil/testament-succession/succession/to-do/accepting-renouncing-succession" },
    { id: "qcclearance", cat: "prov", name: "Revenu Québec authorization before distribution",
      what: "Before distributing property owned by the deceased or post-death income of the succession, the liquidator must use Revenu Québec's process to obtain the certificate authorizing distribution. Federal CRA clearance remains a separate step.",
      rate: "Form MR-14.A-V is the published notice used to request the Quebec distribution certificate.",
      url: "https://www.revenuquebec.ca/en/online-services/forms-and-publications/current-details/mr-14-a-v/" }
  ],
  YT: [
    { id: "ytfees", cat: "prov", name: "Yukon estate grant fee",
      what: "The Supreme Court of Yukon charges a fixed fee for a grant or ancillary grant of probate or administration, or for resealing an extra-territorial grant. The Probate tab applies the published estate-value threshold.",
      rate: "$0 where the estate does not exceed $25,000; $140 where the estate exceeds $25,000. The fee exemption does not itself decide whether a grant is required.",
      url: "https://www.yukoncourts.ca/sites/default/files/2023-12/Appendix%20C.pdf" },
    { id: "ytrule64", cat: "prov", name: "Yukon Rule 64 notice and grant process",
      what: "For a non-contentious estate, current Supreme Court Rule 64 sets the application requirements, proof of death and notice process. The Court will not issue a grant until 21 days have elapsed from the mailing or delivery date shown in the Affidavit of Notice of Application.",
      rate: "Common forms include Form 4A plus the applicable executor or administrator affidavit and grant form. Use the current Rules and Forms page for the exact package.",
      url: "https://www.yukoncourts.ca/en/supreme-court/rules-forms" },
    { id: "ytfirstnation", cat: "prov", name: "Yukon First Nation / Indian Act estate check",
      what: "Rule 64 requires an applicant to inquire whether a deceased Yukon First Nation member with a Final Agreement and Self-Government Agreement is subject to First Nation inheritance, wills, intestacy or estate-administration laws. If the deceased was subject to the Indian Act, the rule requires the applicable ministerial consent under section 44 to be filed.",
      rate: "This can change which law and documents govern the estate. Get legal advice where either rule may apply.",
      url: "https://www.yukoncourts.ca/sites/default/files/2022-12/2022%20Rule%2064%20-%20ADMINISTRATION%20OF%20ESTATES%20%28NON%20CONTENTIOUS%29.pdf" }
  ],
  NT: [
    { id: "ntfees", cat: "prov", name: "Northwest Territories estate administration court fee",
      what: "The NWT Court Services Fees Regulations use fixed bands for probate, administration, resealing and ancillary-grant court services. The value is property in the Northwest Territories after deducting debts and liabilities against that property.",
      rate: "$30 up to $10,000; $110 over $10,000 to $25,000; $215 over $25,000 to $125,000; $325 over $125,000 to $250,000; $435 over $250,000.",
      url: "https://www.justice.gov.nt.ca/en/legislation/" },
    { id: "ntsmall", cat: "prov", name: "NWT small-estate declaration",
      what: "Under Rule 10 of the Estate Administration Rules, an estate whose net value reasonably appears to be less than $35,000 is a small estate. A person other than the Public Trustee can apply for a declaration of small estate instead of a grant.",
      rate: "The published route uses Form 2, Application for Declaration of Small Estate, and Form 3, Memorandum and Affidavit in Support. The Court decides whether the route applies.",
      url: "https://www.justice.gov.nt.ca/en/files/court-rules/Judicature%20Act/Estate%20Administration%20Rules/Estate%20Administration%20Rules.pdf" },
    { id: "ntwillsearch", cat: "prov", name: "NWT estate administration and will-search resources",
      what: "The Government of the Northwest Territories publishes estate-administration information and a Will Search Form through the Department of Justice. The Supreme Court's Estate Administration Rules govern the court process.",
      rate: "Use the current rules and registry information for the estate's actual application; court staff can provide procedural information but not legal advice.",
      url: "https://www.justice.gov.nt.ca/en/estate-administration/" }
  ],
  NU: [
    { id: "nufees", cat: "prov", name: "Nunavut probate and administration court fee",
      what: "Nunavut's Court Fees Regulations use fixed bands for probate, administration, resealing and ancillary letters. The value is property in Nunavut after deducting debts and liabilities against that property.",
      rate: "$30 up to $10,000; $110 over $10,000 to $25,000; $215 over $25,000 to $125,000; $325 over $125,000 to $250,000; $425 over $250,000.",
      url: "https://www.nunavutcourts.ca/nunavut-court-justice/rules-policies-directives-announcements/court-policies-and-fees" },
    { id: "nuforms", cat: "prov", name: "Nunavut probate and administration rules and forms",
      what: "The Nunavut Court of Justice publishes the current Probate and Administration Rules and prescribed forms. Form 1 is the application for probate or administration; the supporting forms depend on whether there is a will and on the particular application.",
      rate: "Use the current Court Rules page and Registry for the exact filing package. The Registry's toll-free number is 1-866-286-0546.",
      url: "https://www.nunavutcourts.ca/nunavut-court-justice/rules-policies-directives-announcements/rules-court" },
    { id: "nuregistry", cat: "prov", name: "Nunavut Court Registry",
      what: "The Nunavut Court of Justice Registry handles probate and administration filings and publishes the legislated fee structure and court rules.",
      rate: "Registry: 867-975-6100 or toll-free 1-866-286-0546. Separate fees can apply for certified copies, caveats and other court services.",
      url: "https://www.nunavutcourts.ca/nunavut-court-justice/rules-policies-directives-announcements/court-policies-and-fees" }
  ]
};
function benefitsForProvince(province) {
  const p = normaliseProvinceId(province);
  if (p === "QC") {
    return QUEBEC_PENSION_BENEFITS
      .concat(FEDERAL_BENEFITS.filter((b) => b.cat !== "cpp"))
      .concat(PROVINCIAL_BENEFITS.QC);
  }
  return FEDERAL_BENEFITS.concat(PROVINCIAL_BENEFITS[p] || []);
}
// Kept as a complete directory for exports/tests; the screen filters to the selected province.
const BENEFITS = FEDERAL_BENEFITS.concat(QUEBEC_PENSION_BENEFITS, PROVINCIAL_BENEFITS.ON, PROVINCIAL_BENEFITS.BC, PROVINCIAL_BENEFITS.AB, PROVINCIAL_BENEFITS.SK, PROVINCIAL_BENEFITS.MB, PROVINCIAL_BENEFITS.NS, PROVINCIAL_BENEFITS.NB, PROVINCIAL_BENEFITS.NL, PROVINCIAL_BENEFITS.PE, PROVINCIAL_BENEFITS.QC, PROVINCIAL_BENEFITS.YT, PROVINCIAL_BENEFITS.NT, PROVINCIAL_BENEFITS.NU);

function calculateProbateFees(province, value) {
  const p = normaliseProvinceId(province);
  const raw = Number(value);
  if (!Number.isFinite(raw) || raw < 0) return null;
  if (p === "ON") {
    const rounded = Math.ceil(raw / 1000) * 1000;
    const taxable = Math.max(0, rounded - 50000);
    const tax = (taxable / 1000) * 15;
    return { province: p, value: raw, rounded, taxable, tax, total: tax };
  }
  if (p === "BC") {
    const firstBand = Math.min(Math.max(raw - 25000, 0), 25000);
    const secondBand = Math.max(raw - 50000, 0);
    const probateFee = Math.ceil(firstBand / 1000) * 6 + Math.ceil(secondBand / 1000) * 14;
    const courtFee = raw > 25000 ? 200 : 0;
    return { province: p, value: raw, probateFee, courtFee, total: probateFee + courtFee };
  }
  if (p === "AB") {
    let courtFee = 35;
    if (raw > 250000) courtFee = 525;
    else if (raw > 125000) courtFee = 400;
    else if (raw > 25000) courtFee = 275;
    else if (raw > 10000) courtFee = 135;
    return { province: p, value: raw, courtFee, total: courtFee };
  }
  if (p === "SK") {
    const probateLevy = Math.ceil(raw / 1000) * 7;
    const courtFee = 200;
    return { province: p, value: raw, probateLevy, courtFee, total: probateLevy + courtFee };
  }
  if (p === "MB") {
    return { province: p, value: raw, probateCharge: 0, total: 0 };
  }
  if (p === "NS") {
    let probateTax = 85.60;
    if (raw > 100000) probateTax = 1002.65 + Math.ceil((raw - 100000) / 1000) * 16.95;
    else if (raw > 50000) probateTax = 1002.65;
    else if (raw > 25000) probateTax = 358.15;
    else if (raw > 10000) probateTax = 215.20;
    return { province: p, value: raw, probateTax, total: probateTax };
  }
  if (p === "NB") {
    let probateTax = 200;
    if (raw > 100000) probateTax = 600 + Math.ceil((raw - 100000) / 1000) * 15;
    else if (raw > 20000) probateTax = 200 + Math.ceil((raw - 20000) / 1000) * 5;
    return { province: p, value: raw, probateTax, total: probateTax };
  }
  if (p === "NL") {
    const courtCharge = raw <= 1000 ? 60 : 60 + ((raw - 1000) * 0.006);
    return { province: p, value: raw, courtCharge, total: courtCharge };
  }
  if (p === "PE") {
    let petitionFee = 50;
    if (raw > 100000) petitionFee = 400 + Math.ceil((raw - 100000) / 1000) * 4;
    else if (raw > 50000) petitionFee = 400;
    else if (raw > 25000) petitionFee = 200;
    else if (raw > 10000) petitionFee = 100;
    return { province: p, value: raw, petitionFee, total: petitionFee };
  }
  if (p === "QC") return { province: p, value: raw, valueBasedFee: null, total: null };
  if (p === "YT") {
    const grantFee = raw <= 25000 ? 0 : 140;
    return { province: p, value: raw, grantFee, total: grantFee };
  }
  if (p === "NT") {
    let courtFee = 30;
    if (raw > 250000) courtFee = 435;
    else if (raw > 125000) courtFee = 325;
    else if (raw > 25000) courtFee = 215;
    else if (raw > 10000) courtFee = 110;
    return { province: p, value: raw, courtFee, total: courtFee };
  }
  if (p === "NU") {
    let courtFee = 30;
    if (raw > 250000) courtFee = 425;
    else if (raw > 125000) courtFee = 325;
    else if (raw > 25000) courtFee = 215;
    else if (raw > 10000) courtFee = 110;
    return { province: p, value: raw, courtFee, total: courtFee };
  }
  return null;
}

// ---- The steps.
//
// Each is a real notification or filing an executor has to make. They are
// tracked, not prescribed: the app does not decide which apply, because that
// depends on the person's affairs, the will, and the province.
const BENEFIT_TYPES = [
  "Notification",
  "Government",
  "Bank or money",
  "Insurance",
  "Property",
  "Tax filing",
  "Probate",
  "Other"
];

// The stages a step passes through. Deliberately plain: most of these are a
// phone call or a letter, and the useful question is only ever "have they
// actually confirmed it".
const STAGES = [
  { id: "todo", label: "Not started",
    blurb: "On the list, nothing done yet." },
  { id: "gathering", label: "Gathering what they need",
    blurb: "Waiting on a document, a certificate, or a value before this can go in." },
  { id: "sent", label: "Sent or called",
    blurb: "It has gone in. Log the date and who you spoke to." },
  { id: "waiting", label: "Waiting on them",
    blurb: "They have it and have not come back yet." },
  { id: "done", label: "Confirmed done",
    blurb: "They have confirmed it in writing, or you have the certificate in hand." }
];

// ---- The estate inventory.
//
// This is the estate inventory. It exists because substantially the same asset
// information is needed at several points in the process:
// by the court on the probate application, by the Ministry of Finance on the
// Estate Information Return, and by the CRA on the clearance certificate
// request. Building it once, properly, saves doing it three times from memory.
const BODY_AREAS = [
  { id: "bank", label: "Bank accounts" },
  { id: "invest", label: "Investments and registered plans" },
  { id: "property", label: "Real property" },
  { id: "vehicle", label: "Vehicles" },
  { id: "insurance", label: "Life insurance and annuities" },
  { id: "pension", label: "Pensions and workplace benefits" },
  { id: "business", label: "Business interests" },
  { id: "personal", label: "Personal property and valuables" },
  { id: "digital", label: "Digital accounts and subscriptions" },
  { id: "debt", label: "Debts owed by the estate" },
  { id: "other", label: "Anything else" }
];

// How an asset passes matters more than what it is worth: whether it goes
// through the estate at all decides whether it counts for probate tax.
// The app records what the person has been told. It does not rule on it.
const CONDITION_STATUSES = [
  { id: "estate", label: "Passes through the estate", tone: "amber" },
  { id: "joint", label: "Held jointly", tone: "green" },
  { id: "beneficiary", label: "Has a named beneficiary", tone: "green" },
  { id: "unsure", label: "Not sure yet", tone: "grey" },
  { id: "closed", label: "Dealt with", tone: "green" }
];

// ---- Probate, as a tracked sequence.
const PROBATE_LEVELS = {
  ON: [
    { id: "prep", short: "Preparation", label: "Getting the application ready",
      blurb: "The will, proof of death, asset values and court forms are being assembled." },
    { id: "filed", short: "Filed", label: "Application filed with the court",
      blurb: "Submitted to the Superior Court of Justice with any Estate Administration Tax payable." },
    { id: "certificate", short: "Certificate", label: "Estate certificate issued",
      blurb: "Record the issue date. Ontario's Estate Information Return clock runs from this date." },
    { id: "provincial", short: "Return filed", label: "Estate Information Return filed",
      blurb: "Ontario filing made to the Ministry of Finance, generally due within 180 calendar days after the estate certificate is issued." },
    { id: "clearance", short: "Clearance", label: "CRA clearance certificate requested",
      blurb: "Form TX19, after every required return is filed and assessed. Early distribution can create personal liability." }
  ],
  BC: [
    { id: "prep", short: "Preparation", label: "Wills search and application preparation",
      blurb: "Locate the will, obtain proof of death, complete the wills-notice search and assemble the required P-series forms and asset information." },
    { id: "notice", short: "Notice", label: "Form P1 notice delivered",
      blurb: "Deliver the required notice and applicable materials. The application normally cannot be made until at least 21 days later." },
    { id: "filed", short: "Filed", label: "Estate grant application filed",
      blurb: "The B.C. Supreme Court application has been submitted with the required probate materials and fees." },
    { id: "certificate", short: "Grant", label: "Estate / representation grant issued",
      blurb: "The Supreme Court has issued the grant establishing the personal representative's court authority." },
    { id: "clearance", short: "Clearance", label: "CRA clearance certificate requested",
      blurb: "Form TX19, after every required return is filed and assessed. Early distribution can create personal liability." }
  ],
  AB: [
    { id: "prep", short: "Preparation", label: "Getting the grant application ready",
      blurb: "Gather proof of death, the will if there is one, the estate inventory and the SDS or GA-form information." },
    { id: "filed", short: "Filed", label: "Application submitted to the Court of King's Bench",
      blurb: "Submitted online through the Surrogate Digital Service or by paper GA forms, depending on the application." },
    { id: "notice", short: "Notice", label: "Required notices / service recorded",
      blurb: "Record notices to beneficiaries, potential claimants and other interested parties as required for the application." },
    { id: "certificate", short: "Grant", label: "Grant of probate or administration issued",
      blurb: "The Court of King's Bench has issued the grant. SDS grants are issued digitally." },
    { id: "clearance", short: "Clearance", label: "CRA clearance certificate requested",
      blurb: "Form TX19, after every required return is filed and assessed. Early distribution can create personal liability." }
  ],
  SK: [
    { id: "prep", short: "Preparation", label: "Getting the probate / administration application ready",
      blurb: "Gather the original will if there is one, proof of death, the Statement of Property, affidavits and any other required Court of King's Bench forms." },
    { id: "filed", short: "Filed", label: "Application filed with the Court of King's Bench",
      blurb: "Record the filing date and the standard Local Registrar filing fee and probate levy paid for the application." },
    { id: "notice", short: "Notices", label: "Required notices / certificates recorded",
      blurb: "Record any notices to the Public Guardian and Trustee and any Certificate of No Infants requested for the estate." },
    { id: "certificate", short: "Grant", label: "Letters Probate or Letters of Administration issued",
      blurb: "The Court of King's Bench has issued the grant establishing the personal representative's court authority." },
    { id: "clearance", short: "Clearance", label: "CRA clearance certificate requested",
      blurb: "Form TX19, after every required return is filed and assessed. Early distribution can create personal liability." }
  ],
  MB: [
    { id: "prep", short: "Preparation", label: "Getting the Rule 74 materials ready",
      blurb: "Gather the original will if there is one, proof of death, Form 74A or the applicable administration request, Form 74B inventory and supporting affidavits." },
    { id: "filed", short: "Filed", label: "Request filed with the Probate Division",
      blurb: "The required Rule 74 materials have been filed with the Court of King's Bench Probate Division." },
    { id: "notice", short: "Follow-up", label: "Court follow-up or additional material recorded",
      blurb: "Record any request from the Probate Division for corrections, affidavits, bonds or other estate-specific material." },
    { id: "certificate", short: "Grant", label: "Grant of Probate or Letters of Administration issued",
      blurb: "The Court of King's Bench has issued the grant establishing the personal representative's court authority." },
    { id: "clearance", short: "Clearance", label: "CRA clearance certificate requested",
      blurb: "Form TX19, after every required return is filed and assessed. Early distribution can create personal liability." }
  ],
  NS: [
    { id: "prep", short: "Preparation", label: "Getting the Probate Court application ready",
      blurb: "Gather proof of death, estate values, the current Probate Court forms and the original will if applying for probate." },
    { id: "filed", short: "Filed", label: "Application filed with the Nova Scotia Probate Court",
      blurb: "Record the filing date, probate tax paid and any additional material requested by the registrar." },
    { id: "certificate", short: "Grant", label: "Grant of Probate or Administration issued",
      blurb: "The Probate Court has issued the grant establishing the personal representative's court authority." },
    { id: "provincial", short: "Post-grant", label: "Inventory, notices and Royal Gazette work recorded",
      blurb: "File Form 29 inventory within 3 months after the grant and record the required post-grant notices, including the Royal Gazette estate notice." },
    { id: "clearance", short: "Clearance", label: "CRA clearance certificate requested",
      blurb: "Form TX19, after every required return is filed and assessed. Early distribution can create personal liability." }
  ],
  NB: [
    { id: "prep", short: "Preparation", label: "Getting the New Brunswick application ready",
      blurb: "Choose the applicable 2A–2F application form, gather the will if there is one, proof of death and detailed estate-value information, and account for the 7-day or 14-day minimum before a grant can issue." },
    { id: "filed", short: "Filed", label: "Application filed with the Probate Court",
      blurb: "File in the judicial district where the deceased resided at death or where the deceased had property, with the applicable probate tax." },
    { id: "notice", short: "Follow-up", label: "Court follow-up or additional material recorded",
      blurb: "Record any affidavits, witness proof, inventory details, corrections or other material requested for the application." },
    { id: "certificate", short: "Grant", label: "Letters Probate or Letters of Administration issued",
      blurb: "The Probate Court has issued the grant establishing the personal representative's court authority." },
    { id: "clearance", short: "Clearance", label: "CRA clearance certificate requested",
      blurb: "Form TX19, after every required return is filed and assessed. Early distribution can create personal liability." }
  ],
  NL: [
    { id: "prep", short: "Preparation", label: "Getting the Rule 56 estate materials ready",
      blurb: "Gather proof of death, the will and Proof of Will where applicable, Form 56.10A inventory and valuation, affidavits and the applicable petition materials." },
    { id: "notice", short: "Notice", label: "Notice of Application posted",
      blurb: "Post Form 56.04A with the Supreme Court Registry. After the 5-day notice period, confirm no caveat and no previous grant before proceeding." },
    { id: "filed", short: "Filed", label: "Petition filed with the Supreme Court",
      blurb: "File the applicable Rule 56 petition and inventory/valuation with the Registry, together with the will and proof materials where required." },
    { id: "certificate", short: "Grant", label: "Letters of Probate or Administration issued",
      blurb: "The Supreme Court has issued the grant. The estate-value court charge is based on the inventory and valuation filed with the application." },
    { id: "clearance", short: "Clearance", label: "CRA clearance certificate requested",
      blurb: "Form TX19, after every required return is filed and assessed. Early distribution can create personal liability." }
  ],
  PE: [
    { id: "prep", short: "Preparation", label: "Getting the Rule 65 petition ready",
      blurb: "Gather proof of death, the original will and proof where applicable, the inventory, and the Rule 65 petition and oath materials for the estate." },
    { id: "filed", short: "Filed", label: "Petition filed with the Supreme Court Estates Section",
      blurb: "File the applicable petition, including Form 65A for probate or the applicable administration form, with the inventory and standard petition fee." },
    { id: "certificate", short: "Grant", label: "Letters Probate or Administration issued",
      blurb: "The Supreme Court Estates Section has issued the grant establishing the personal representative's court authority." },
    { id: "provincial", short: "Post-grant", label: "Estate and beneficiary notices recorded",
      blurb: "The Registrar publishes the estate notice calling for demands within six months. Record the personal representative's beneficiary-notice service and dates as applicable." },
    { id: "clearance", short: "Clearance", label: "CRA clearance certificate requested",
      blurb: "Form TX19, after every required return is filed and assessed. Early distribution can create personal liability." }
  ],
  QC: [
    { id: "prep", short: "Search", label: "Official proof of death and mandatory will search gathered",
      blurb: "Obtain the civil-status document needed for the file and the two will-search certificates from the Barreau du Québec and Chambre des notaires registries." },
    { id: "notice", short: "Will", label: "Will type and verification requirement confirmed",
      blurb: "A notarial will does not need probate. A holograph or witnessed will must be probated by a notary or the Superior Court, with notice to successors unless an exemption applies." },
    { id: "certificate", short: "Authority", label: "Liquidator authority established",
      blurb: "Record the notarial will or completed verification of a non-notarial will and the document establishing who is acting as liquidator." },
    { id: "provincial", short: "Inventory", label: "Liquidator designation and inventory notices completed",
      blurb: "Register the liquidator in the RDPRM, complete the succession inventory, and record the RDPRM and newspaper notice of closure of inventory." },
    { id: "clearance", short: "Clearance", label: "Quebec and federal clearance recorded before final distribution",
      blurb: "Obtain Revenu Québec authorization before distributing succession property and the CRA clearance certificate before final distribution; then retain the final account and closure records." }
  ],
  YT: [
    { id: "prep", short: "Preparation", label: "Getting the Yukon estate application ready",
      blurb: "Gather proof of death, the will if there is one, estate information and the applicable Rule 64 forms. Check the special First Nation / Indian Act rules where relevant." },
    { id: "notice", short: "Notice", label: "Notice of Application delivered",
      blurb: "Record mailing or delivery of the Notice of Application. Current Rule 64 requires 21 days to elapse before the Court will issue a grant." },
    { id: "filed", short: "Filed", label: "Application filed with the Supreme Court of Yukon",
      blurb: "File Form 4A, the applicable executor or administrator affidavit, proof of death and other required materials with the Court Registry." },
    { id: "certificate", short: "Grant", label: "Grant of Probate or Letters of Administration issued",
      blurb: "The Supreme Court of Yukon has issued the grant establishing the personal representative's court authority." },
    { id: "clearance", short: "Clearance", label: "CRA clearance certificate requested",
      blurb: "Form TX19, after every required return is filed and assessed. Early distribution can create personal liability." }
  ],
  NT: [
    { id: "prep", short: "Preparation", label: "Choosing the NWT estate route",
      blurb: "Gather proof of death, the will if there is one and estate values. An estate reasonably appearing to be under $35,000 may have the Rule 10 small-estate declaration route." },
    { id: "notice", short: "Notices", label: "Required notices and supporting material recorded",
      blurb: "Record the notices, affidavits and supporting documents required by the NWT Estate Administration Rules for the chosen route." },
    { id: "filed", short: "Filed", label: "Application filed with the Supreme Court of the Northwest Territories",
      blurb: "File the applicable probate, administration, resealing or small-estate materials with the Court Registry." },
    { id: "certificate", short: "Authority", label: "Grant or small-estate declaration issued",
      blurb: "Record the court document establishing authority to administer the estate." },
    { id: "clearance", short: "Clearance", label: "CRA clearance certificate requested",
      blurb: "Form TX19, after every required return is filed and assessed. Early distribution can create personal liability." }
  ],
  NU: [
    { id: "prep", short: "Preparation", label: "Getting the Nunavut estate application ready",
      blurb: "Gather proof of death, the will if there is one, Nunavut property values and the forms required by the Probate and Administration Rules." },
    { id: "filed", short: "Filed", label: "Application filed with the Nunavut Court of Justice",
      blurb: "File the applicable probate, administration, resealing or ancillary application and supporting documents with the Court Registry." },
    { id: "notice", short: "Follow-up", label: "Court notices or additional material recorded",
      blurb: "Record any notices, affidavits, corrections or additional material required for the particular estate application." },
    { id: "certificate", short: "Grant", label: "Grant of probate or administration issued",
      blurb: "The Nunavut Court of Justice has issued the grant establishing the personal representative's court authority." },
    { id: "clearance", short: "Clearance", label: "CRA clearance certificate requested",
      blurb: "Form TX19, after every required return is filed and assessed. Early distribution can create personal liability." }
  ]
};
function probateLevels(province) { return PROBATE_LEVELS[normaliseProvinceId(province)] || PROBATE_LEVELS.ON; }
const REDRESS_LEVELS = PROBATE_LEVELS.ON;
const REDRESS_OUTCOMES = [
  { id: "waiting", label: "Waiting", tone: "amber" },
  { id: "done", label: "Done", tone: "green" },
  { id: "returned", label: "Returned for more information", tone: "amber" },
  { id: "na", label: "Does not apply to this estate", tone: "grey" }
];

// Who is helping. Estate work is one of the few places where paying a
// professional is often the right answer, so this list does not pretend
// otherwise; it just records who is doing what.
const REPRESENTATIVES = [
  "Doing it myself",
  "Estate lawyer",
  "Accountant",
  "Trust company",
  "Another executor",
  "Someone else"
];

// ---- Documents.
//
// The checklist below is what institutions actually ask for. The first line is
// the one that saves the most running around: funeral directors will give you
// as many original Statements of Death as you ask for, and every bank,
// insurer and registry wants its own.
function evidenceItems(province) {
  const p = normaliseProvinceId(province);
  const provinceData = {
    ON: {
      certificate: "Ontario death certificates are ordered through ServiceOntario. Keep the funeral director's proof of death too.",
      grant: "Estate certificate / Certificate of Appointment",
      values: "Bank balances, appraisals and statements. Used for the court application, Estate Information Return and CRA work."
    },
    BC: {
      certificate: "B.C. Vital Statistics issues death certificates; they can be ordered online. Keep the funeral director's proof of death too.",
      grant: "Estate / representation grant",
      values: "Bank balances, appraisals and statements. Used to support the B.C. grant/fee information and CRA work."
    },
    AB: {
      certificate: "Alberta death documents are ordered through a registry agent (or the approved out-of-province route). Keep the funeral director's proof of death too.",
      grant: "Grant of Probate or Administration",
      values: "Bank balances, appraisals and statements. Alberta's grant fee is based on net property in Alberta; CRA work may need the broader estate records."
    },
    SK: {
      certificate: "Saskatchewan death certificates are issued by eHealth Saskatchewan. A standard death certificate is currently $35. Keep the funeral director's proof of death too.",
      grant: "Letters Probate or Letters of Administration",
      values: "Bank balances, appraisals and statements. Saskatchewan's Statement of Property separates Part 1 and Part 2 assets; the standard probate levy is calculated from the applicable estate value / Total Part 1 Assets."
    },
    MB: {
      certificate: "Manitoba death certificates are issued by the Vital Statistics Branch. The current regular certificate fee is $30. Keep the funeral director's proof of death too.",
      grant: "Grant of Probate or Letters of Administration",
      values: "Bank balances, appraisals and statements. Manitoba has no value-based probate charge, but Form 74B still records the inventory and valuation of the deceased's property for the court process."
    },
    NS: {
      certificate: "Nova Scotia Vital Statistics issues death certificates. The current fee is $33 for a short form and $39.90 for a long form. Keep the funeral director's proof of death too.",
      grant: "Grant of Probate or Administration",
      values: "Bank balances, appraisals and statements used for the Probate Court inventory and probate-tax value. Nova Scotia law has specific inclusion and exclusion rules, so get legal advice if ownership is unclear."
    },
    NB: {
      certificate: "New Brunswick Vital Statistics issues long-form death certificates. The current fee is $40 online or $45 in person or by mail. The Probate Court's basic checklist accepts a copy of the death certificate.",
      grant: "Letters Probate or Letters of Administration",
      values: "Bank balances, appraisals and statements. The current Probate Court checklist calls for detailed estate-value information, and probate tax is based on the estate value used for the application."
    },
    NL: {
      certificate: "Newfoundland and Labrador Vital Statistics issues long-form death certificates. There is no fee when the certificate is issued within the first year of death; after one year it is $35, or $30 online.",
      grant: "Letters of Probate or Letters of Administration",
      values: "Form 56.10A inventory and valuation lists the deceased's property and assets located in Newfoundland and Labrador. The total is used to set the estate-value court charge."
    },
    PE: {
      certificate: "Prince Edward Island Vital Statistics issues death certificates. The current fee is $35 without cause of death or $50 with cause; eligibility rules apply to cause-of-death records.",
      grant: "Letters Probate or Letters of Administration",
      values: "Form 65E / the required inventory records the estate for the court process. P.E.I.'s standard petition fee is based on the Probate Act's probate value definition."
    },
    QC: {
      certificate: "Quebec's Directeur de l'état civil issues death certificates and copies of the act of death. Current normal online fees are $38.50 for a certificate and $46.75 for a copy of an act; paper/mail fees are higher.",
      grant: "Probated will / liquidator authority records",
      values: "Keep a complete inventory of the succession's assets and debts. Quebec requires the liquidator to make an inventory and publish the required notice of closure."
    },
    YT: {
      certificate: "Yukon Vital Statistics issues death certificates. The current fee is $10. Keep the funeral director's proof of death too.",
      grant: "Grant of Probate or Letters of Administration",
      values: "Keep bank balances, appraisals and statements supporting the estate application. Yukon charges no grant fee where the estate does not exceed $25,000 and a $140 grant fee above that threshold."
    },
    NT: {
      certificate: "Northwest Territories Vital Statistics issues death certificates. The current regular certificate fee is $26. Keep the funeral director's proof of death too.",
      grant: "Grant of Probate / Administration or small-estate declaration",
      values: "The standard NWT court-fee band uses property in the Northwest Territories after deducting debts and liabilities against that property. Rule 10 separately defines a small estate as net value reasonably appearing to be less than $35,000."
    },
    NU: {
      certificate: "Nunavut Vital Statistics issues death certificates for deaths registered in Nunavut. The published certificate fee is $10.",
      grant: "Grant of Probate or Administration",
      values: "Nunavut court-fee bands use property in Nunavut after deducting debts and liabilities against that property. Keep written values and supporting statements with the estate file."
    }
  }[p];
  return [
    { id: "statement", label: "Statements of Death from the funeral director", note: "Ask for several originals at the outset. Institutions may each want proof of death." },
    { id: "certificate", label: "The provincial / territorial death certificate", note: provinceData.certificate },
    { id: "will", label: "The original will", note: "Keep the original safe. Court submission and proof requirements differ by province or territory; Quebec distinguishes notarial from non-notarial wills." },
    { id: "id", label: "Your own photo identification", note: "Institutions will ask you to prove who you are as well." },
    { id: "appointment", label: provinceData.grant, note: "If a court grant is needed. Some institutions will release nothing without it." },
    { id: "sin", label: "The deceased's Social Insurance Number", note: "The CRA and Service Canada both ask for it on the first call." },
    { id: "values", label: "Written values for each asset at the date of death", note: provinceData.values },
    { id: "assessments", label: "Notices of Assessment and past returns", note: "For the final return and the clearance certificate request." }
  ];
}
const EVIDENCE_ITEMS = evidenceItems("ON");

// ---- Space to write.
const STATEMENTS = [
  { id: "questions", label: "Questions to ask",
    lead: "Everything you meant to ask the lawyer, the bank or the CRA and forgot on the call. Add to it as it occurs to you.",
    prompts: [
      "What this institution says it needs from you, in their words",
      "Anything you were told that contradicts something else you were told",
      "Dates you were promised something would happen",
      "What you are unsure about and want checked by someone qualified",
      "Anything that felt wrong and you want to come back to"
    ] },
  { id: "log", label: "How it has gone",
    lead: "A plain account of the process for your own use, and for anyone who has to pick this up after you.",
    prompts: [
      "What has been done and what is still outstanding",
      "Which institutions were straightforward and which were not",
      "Money paid out of your own pocket, and when",
      "Decisions you made and why you made them",
      "Anything the beneficiaries have been told"
    ] }
];

// ---- Entitlement fractions are not a concept here; the Probate tab does its
// own arithmetic. Kept as a single value so shared code has something valid.
const ENTITLEMENT_FRACTIONS = [
  { id: "full", label: "Full", mult: 1 }
];
const PSC_TABLE = [];

// ---- Help.
//
// The hardest moment comes first. Somebody settling
// an estate is also grieving, and often doing it alone. Crisis and bereavement
// support lead, then the free and low-cost help, then the numbers they will
// actually have to ring.
function helpSections(province) {
  const p = normaliseProvinceId(province);
  const griefByProvince = {
    ON: [
      { name: "ConnexOntario", tel: "1-866-531-2600",
        detail: "Free, confidential, around the clock. Connects you to mental-health and related supports in Ontario.", url: "https://www.connexontario.ca/" },
      { name: "Your family doctor", detail: "If grief is stopping you sleeping, eating or functioning, ask for medical and local bereavement support." }
    ],
    BC: [
      { name: "BC Bereavement Helpline", tel: "1-877-779-2223",
        detail: "Free and confidential. Connects people with grief resources across B.C.; published hours are Monday to Friday, 9 a.m. to 5 p.m.",
        url: "https://www2.gov.bc.ca/gov/content/life-events/death/after-death/get-support" },
      { name: "Your family doctor", detail: "Ask for local or online bereavement supports if grief is interfering with day-to-day functioning." }
    ],
    AB: [
      { name: "Health Link Alberta", tel: "811",
        detail: "Call 811 for information about health services and grief or bereavement supports available in Alberta.",
        url: "https://www.albertahealthservices.ca/info/Page13161.aspx" },
      { name: "211 Alberta", tel: "211", detail: "Connects people with community services and supports in Alberta." }
    ],
    SK: [
      { name: "Saskatchewan HealthLine", tel: "811",
        detail: "Free and confidential, 24/7. Registered nurses, psychiatric nurses and social workers provide health, mental-health and addictions support and can connect you with local resources.",
        url: "https://www.saskatchewan.ca/residents/health/accessing-health-care-services/healthline" },
      { name: "211 Saskatchewan", tel: "211", detail: "Connects people with community, social and grief-related services across Saskatchewan.", url: "https://sk.211.ca/" }
    ],
    MB: [
      { name: "Health Links–Info Santé", tel: "1-888-315-9257",
        detail: "Free 24/7 health information from nurses across Manitoba. Winnipeg callers can also use 204-788-8200.",
        url: "https://www.gov.mb.ca/health/access.html" },
      { name: "211 Manitoba", tel: "211", detail: "Free 24/7 connection to community services, including grief counselling and mental-health supports.", url: "https://mb.211.ca/" }
    ],
    NS: [
      { name: "211 Nova Scotia", tel: "211", detail: "Free connection to community, social and support services across Nova Scotia.", url: "https://ns.211.ca/" },
      { name: "Your family doctor", detail: "Ask for local or online bereavement supports if grief is interfering with day-to-day functioning." }
    ],
    NB: [
      { name: "Tele-Care New Brunswick", tel: "811", detail: "24-hour nurse support and referrals to additional community services.", url: "https://www.gnb.ca/en/topic/health-wellness/accessing-health-care.html" },
      { name: "211 New Brunswick", tel: "211", detail: "Free, confidential connection to human, social, community and government supports.", url: "https://nb.211.ca/" }
    ],
    NL: [
      { name: "Newfoundland and Labrador HealthLine", tel: "811", detail: "Available 24/7. HealthLine nurses listen, provide support and connect callers with health services; the provincial toll-free number is 1-888-709-2929.", url: "https://www.gov.nl.ca/hcs/findhealthservices/helplines/" },
      { name: "Bridge the gapp", detail: "Online mental-health and addictions information, self-help resources and service connections for Newfoundland and Labrador.", url: "https://www.bridgethegapp.ca/" }
    ],
    PE: [
      { name: "P.E.I. 811 Telehealth", tel: "811", detail: "A registered nurse is available 24 hours a day for non-emergency health information and guidance about provincial health services.", url: "https://www.princeedwardisland.ca/en/information/health-and-wellness/811-telehealth" },
      { name: "211 P.E.I.", tel: "211", detail: "Free, confidential, 24/7 connection to community, social, government and non-urgent health services across the Island.", url: "https://www.princeedwardisland.ca/en/information/social-development-and-seniors/211-pei" }
    ],
    QC: [
      { name: "Info-Social 811", tel: "811", detail: "Choose option 2 for free, confidential psychosocial support. Quebec specifically lists bereavement as a reason to call, and the service is available 24/7 in most regions.", url: "https://www.quebec.ca/en/health/finding-a-resource/info-social-811" },
      { name: "Quebec bereavement resources", detail: "The Quebec government lists additional services for people going through grief and bereavement.", url: "https://www.quebec.ca/en/family-and-support-for-individuals/death/better-cope-with-grief/seek-help-go-through-grief" }
    ],
    YT: [
      { name: "Yukon HealthLine", tel: "811", detail: "Registered nurses provide health advice 24 hours a day and can direct callers to services in their community.", url: "https://yukon.ca/en/health-and-wellness/care-services/access-24-hour-health-advice-811" },
      { name: "Your local health centre or doctor", detail: "Ask for grief, counselling or mental-health support available in your Yukon community." }
    ],
    NT: [
      { name: "NWT 811 Mental Health and Wellness Support", tel: "811", detail: "Available around the clock. Press 1 for a nurse trained to help with mental wellness and addiction-recovery concerns, including grief and loss.", url: "https://www.hss.gov.nt.ca/en/services/811" },
      { name: "Your community health or counselling service", detail: "811 can help identify the appropriate local or territorial service for grief and loss." }
    ],
    NU: [
      { name: "Nunavut Kamatsiaqtut Help Line", tel: "1-800-265-3333", detail: "Anonymous and confidential telephone support, 24 hours a day, seven days a week. Iqaluit: 867-979-3333.", url: "https://livehealthy.gov.nu.ca/en/node/632" },
      { name: "Your local health centre", detail: "Ask for grief, mental-health or counselling support available in your community." }
    ]
  };
  const legalByProvince = {
    ON: [
      { name: "Law Society Referral Service",
        detail: "A free initial consultation of up to 30 minutes with a lawyer or paralegal. Run by the Law Society of Ontario.",
        url: "https://lso.ca/public-resources/finding-a-lawyer-or-paralegal/law-society-referral-service" },
      { name: "Office of the Public Guardian and Trustee", tel: "1-800-366-0335",
        detail: "Ontario public trustee and guardian information, including estate-related functions in qualifying circumstances." }
    ],
    BC: [
      { name: "B.C. Lawyer Referral Service", tel: "604-687-3221",
        detail: "The Canadian Bar Association, B.C. Branch service provides a consultation of up to 15 minutes for free.",
        url: "https://www2.gov.bc.ca/gov/content/family-social-supports/seniors/financial-legal-matters/hiring-a-lawyer" },
      { name: "Public Guardian and Trustee of British Columbia", tel: "604-660-4444",
        detail: "The PGT administers some deceased estates and has grant-review roles where minors or incapable adults are involved.",
        url: "https://www.trustee.bc.ca/estates-personal-trusts" }
    ],
    AB: [
      { name: "Law Society of Alberta Lawyer Directory",
        detail: "Use the online directory to search by location and practice area. The Law Society does not refer or endorse a particular lawyer.",
        url: "https://www.lawsociety.ab.ca/public/findalawyer/" },
      { name: "Alberta Public Trustee",
        detail: "The Public Trustee will consider administering a solvent estate only in limited circumstances, including where a minor or represented-adult client is a beneficiary and no other person is administering.",
        url: "https://www.alberta.ca/deceased-persons-estates" }
    ],
    SK: [
      { name: "Law Society of Saskatchewan — Find Legal Assistance", tel: "1-877-989-4999",
        detail: "Search the Law Society directory by location, area of law, service model and pricing options, including wills and estates.",
        url: "https://www.lawsociety.sk.ca/for-the-public/finding-legal-assistance/" },
      { name: "Saskatchewan Public Guardian and Trustee", tel: "306-787-5424",
        detail: "Provincial information about estate administration and the Public Guardian and Trustee's role when there is no suitable person to administer an estate.",
        url: "https://www.saskatchewan.ca/residents/births-deaths-marriages-and-divorces/dealing-with-death/the-public-guardian-and-trustee-administrator-of-an-estate" }
    ],
    MB: [
      { name: "Law Phone-In & Lawyer Referral Program", tel: "1-800-262-8800",
        detail: "Community Legal Education Association provides free confidential legal information and advice, and in appropriate cases a lawyer referral with a free first interview of up to 30 minutes. Winnipeg: 204-943-2382.",
        url: "https://lawsociety.mb.ca/for-the-public/finding-a-lawyer/looking-for-general-legal-advice-or-assistance/" },
      { name: "Public Guardian and Trustee of Manitoba", tel: "1-800-282-8069",
        detail: "The PGT is an administrator of last resort for certain Manitoba estates where no one else is willing or able to act. Winnipeg: 204-945-2700.",
        url: "https://www.gov.mb.ca/publictrustee/deceased_estates.html" }
    ],
    NS: [
      { name: "Legal Information Society of Nova Scotia", tel: "1-800-665-9779",
        detail: "Legal information and a lawyer-referral route for Nova Scotia. Halifax: 902-455-3135.",
        url: "https://www.legalinfo.org/" },
      { name: "Public Trustee of Nova Scotia", tel: "902-424-7760",
        detail: "The Public Trustee administers some deceased estates where there is no one willing or able to act.",
        url: "https://novascotia.ca/just/pto/" }
    ],
    NB: [
      { name: "Law Society of New Brunswick — Member Directory", tel: "506-458-8540",
        detail: "Use the Law Society member directory to locate a New Brunswick lawyer, including wills-and-estates counsel.",
        url: "https://lawsociety-barreau.nb.ca/" },
      { name: "New Brunswick Probate Court",
        detail: "The Probate Court publishes locations, forms, checklists and procedural information. Court staff can provide process information but not legal advice.",
        url: "https://www.gnb.ca/content/cour/en/probate-court.html" }
    ],
    NL: [
      { name: "Public Legal Information Association of NL", tel: "1-888-660-7788",
        detail: "Legal information and Lawyer Referral Service. Registered referral lawyers provide an initial 30-minute consultation for $40 including tax. St. John's: 709-722-2643.",
        url: "https://publiclegalinfo.com/legal-info/wills-and-estates/dying-without-a-will/" },
      { name: "Office of the Public Trustee — Newfoundland and Labrador", tel: "709-729-0850",
        detail: "The Public Trustee can act as administrator of estates or executor under a will in qualifying circumstances.",
        url: "https://www.gov.nl.ca/jps/department/branches/division/trustee/" }
    ],
    PE: [
      { name: "Community Legal Information", tel: "902-892-0853",
        detail: "P.E.I. legal navigation and lawyer referrals. The referral service can connect people with up to 45 minutes of low-cost legal advice. Toll-free: 1-800-240-9798.",
        url: "https://legalinfopei.ca/" },
      { name: "P.E.I. Public Trustee, Public and Official Guardian", tel: "902-368-6281",
        detail: "An office of last resort that can administer or execute the estate of a P.E.I. resident where there is no one in a representative capacity who can do so.",
        url: "https://www.princeedwardisland.ca/en/information/justice-and-public-safety/public-trustee-public-and-official-guardian" }
    ],
    QC: [
      { name: "Quebec succession information", detail: "The Gouvernement du Québec succession pages explain will searches, verification of non-notarial wills, liquidator duties, inventory and distribution. For legal interpretation, contact a Quebec notary or lawyer.", url: "https://www.quebec.ca/en/justice-et-etat-civil/testament-succession/succession" },
      { name: "Quebec will-search portal", detail: "The mandatory search uses one portal for the Barreau du Québec and Chambre des notaires registries and produces two search certificates.", url: "https://www.quebec.ca/en/justice-et-etat-civil/testament-succession/succession/to-do/will-search" }
    ],
    YT: [
      { name: "Yukon Law Line", tel: "1-866-667-4305", detail: "Yukon Public Legal Education Association provides legal-information help. Whitehorse: 867-668-5297.", url: "https://yukon.ca/en/wills-and-estates" },
      { name: "Supreme Court of Yukon Registry", tel: "867-667-5441", detail: "The Court publishes current Rule 64/65 estate rules and forms. Registry staff can provide procedural information but not legal advice.", url: "https://www.yukoncourts.ca/en/supreme-court/rules-forms" }
    ],
    NT: [
      { name: "NWT Public Trustee Office", tel: "867-767-9252", detail: "The Public Trustee manages some deceased estates and publishes estate-administration information. It only acts in qualifying circumstances.", url: "https://www.justice.gov.nt.ca/en/boards-agencies/public-trustee-office/" },
      { name: "NWT Estate Administration Rules", detail: "The Department of Justice publishes the current court rules, including the Rule 10 small-estate declaration forms.", url: "https://www.justice.gov.nt.ca/en/legislation/" }
    ],
    NU: [
      { name: "Nunavut Court of Justice Registry", tel: "1-866-286-0546", detail: "The Registry publishes the Probate and Administration Rules, forms and fee structure. Iqaluit: 867-975-6100.", url: "https://www.nunavutcourts.ca/nunavut-court-justice/rules-policies-directives-announcements/rules-court" },
      { name: "Nunavut Public Trustee", tel: "1-866-294-2127", detail: "The Public Trustee administers some estates where next of kin are not willing or able to act. Iqaluit: 867-975-6338.", url: "https://www.gov.nu.ca/sites/default/files/publications/2023-08/Nunavut%20Will%20Guide.pdf" }
    ]
  };
  return [
    { id: "crisis", tone: "urgent", label: "If you need to talk to someone now", note: "Free, confidential, and answered any hour of any day.", items: [
      { name: "9-8-8 Suicide Crisis Helpline", tel: "988", detail: "Call or text, anywhere in Canada. For anyone in distress, not only for thoughts of suicide.", alt: "Text 988" },
      { name: "Emergency", tel: "911", detail: "If someone is in immediate danger." }
    ] },
    { id: "grief", tone: "normal", label: "Grief support", note: provinceDef(p).label + " resources, plus Canada-wide crisis help above.", items: griefByProvince[p] },
    { id: "official", tone: "normal", label: "The calls you will have to make", note: "Have the Social Insurance Number in front of you before you dial.", items: [
      { name: p === "QC" ? "Service Canada — OAS and CPP if applicable" : "Service Canada, to cancel CPP and OAS", tel: "1-800-277-9914", detail: p === "QC" ? "Notify Service Canada about OAS and any CPP entitlement or payment that applies to the deceased's contribution history." : "Payments after the month of death have to be repaid, and the demand can land on the executor.", url: "https://www.canada.ca/en/services/life-events/death/notify.html" },
      ...(p === "QC" ? [{ name: "Retraite Québec — QPP survivor benefits", tel: "1-800-463-5185", detail: "QPP death benefit, surviving spouse's pension and orphan's pension information. Retraite Québec's 2026 survivor-benefit form lists this toll-free number.", url: "https://www.retraitequebec.gouv.qc.ca/en/citizens/death" }] : []),
      { name: "Canada Revenue Agency", tel: "1-800-959-8281", detail: "Report the date of death, stop benefit payments, and ask what they need to recognise you as the legal representative.", url: "https://www.canada.ca/en/revenue-agency/services/tax/individuals/life-events/what-when-someone-died.html" },
      { name: "Employment Insurance", tel: "1-800-206-7218", detail: "If the person was receiving or might have been eligible for EI." }
    ] },
    { id: "legal", tone: "normal", label: "If you need legal help", note: "Estate law is provincial or territorial. These routes change with the estate province or territory selected in Settings.", items: legalByProvince[p] }
  ];
}
const HELP_SECTIONS = helpSections("ON");

// ---- The first two weeks.
//
// Not a complete checklist, and it says so. It covers the handful of things
// that are time-sensitive or expensive to get wrong, each one verified against
// the government page that says it.
function guideSections(province) {
  const p = normaliseProvinceId(province);
  const docsByProvince = {
    ON: {
      body: "The funeral director provides proof-of-death documents. Ontario death certificates are ordered through ServiceOntario and some institutions insist on the provincial certificate. Order it early if you expect to need one.",
      links: []
    },
    BC: {
      body: "The funeral director provides proof-of-death documents. B.C. Vital Statistics also issues death certificates, which can be ordered online; the published regular-mail fee is $27. Executors often need proof of death for institutions and the grant process.",
      links: [{ label: "B.C. death certificates", url: "https://www2.gov.bc.ca/gov/content/life-events/order-certificates-copies" }]
    },
    AB: {
      body: "The funeral home registers the death in Alberta. A death certificate or other death document can then be ordered through a registry agent; the government fee is $20 and the registry agent adds its own service fee.",
      links: [{ label: "Alberta death certificates", url: "https://www.alberta.ca/order-death-certificate" }]
    },
    SK: {
      body: "Proof of death from the funeral director, coroner or Vital Statistics is used in Saskatchewan estate applications. eHealth Saskatchewan lists the standard death-certificate fee at $35. Keep the funeral-home proof as well because different institutions may ask for different documents.",
      links: [{ label: "Saskatchewan death certificates", url: "https://www.ehealthsask.ca/residents/deaths" }]
    },
    MB: {
      body: "Manitoba Vital Statistics issues death certificates. The current regular issuance fee is $30 per document. Keep the funeral-home proof too, because banks, insurers and the court may ask for different forms of proof.",
      links: [{ label: "Manitoba death certificates", url: "https://vitalstats.gov.mb.ca/online_certificate_application.html" }]
    },
    NS: {
      body: "Nova Scotia Vital Statistics issues death certificates. The current fee is $33 for a short form and $39.90 for a long form. Keep the funeral-home proof too because institutions and the Probate Court may ask for different evidence.",
      links: [{ label: "Nova Scotia death-certificate fees", url: "https://www.novascotia.ca/vital-statistics-fees-certificates-licences-and-services" }]
    },
    NB: {
      body: "New Brunswick Vital Statistics issues long-form death certificates. The current fee is $40 for an online application or $45 in person or by mail. The Probate Court's current basic checklist says a copy of the death certificate is accepted and the original is not required.",
      links: [{ label: "New Brunswick death certificates", url: "https://www.gnb.ca/en/topic/family-home-community/vital-statistics/death-certificate.html" }]
    },
    NL: {
      body: "Newfoundland and Labrador Vital Statistics issues long-form death certificates. There is no fee for a death certificate issued within the first year of death. After one year, the fee is $35, or $30 for an online order. Keep the funeral-home proof too because institutions and the Supreme Court may ask for different evidence.",
      links: [{ label: "Newfoundland and Labrador death certificates", url: "https://www.gov.nl.ca/gs/birth/death-certificate/" }]
    },
    PE: {
      body: "Prince Edward Island Vital Statistics issues official death certificates. The current fee is $35 without cause of death and $50 with cause; access to cause-of-death information has eligibility requirements. Standard processing is approximately 8 business days plus postage.",
      links: [{ label: "P.E.I. death certificates", url: "https://www.princeedwardisland.ca/en/service/apply-for-a-death-certificate" }, { label: "P.E.I. Vital Statistics fees", url: "https://www.princeedwardisland.ca/en/information/justice-and-public-safety/vital-statistics-service-fees" }]
    },
    QC: {
      body: "Quebec's Directeur de l'état civil issues death certificates and copies of the act of death. As of April 1, 2026, normal online processing is $38.50 for a certificate and $46.75 for a copy of an act. Some succession procedures, including Superior Court verification of a non-notarial will, call for the copy of the act of death.",
      links: [{ label: "Quebec certificates and copies of acts", url: "https://www.etatcivil.gouv.qc.ca/en/Certificate-copy/Certificate-Copy.html" }]
    },
    YT: {
      body: "Yukon Vital Statistics issues death certificates for deaths registered in Yukon. The current fee is $10. Rule 64 requires a death certificate for the estate application unless the fact of death is certain and other acceptable proof is provided.",
      links: [{ label: "Yukon death certificates", url: "https://yukon.ca/en/births-marriages-and-deaths/deaths/order-death-certificate" }]
    },
    NT: {
      body: "Northwest Territories Vital Statistics issues death certificates. The current regular certificate fee is $26. The NWT small-estate Form 2 specifically lists a certified copy of the Certificate of Death, or other relevant proof where no certificate is available.",
      links: [{ label: "NWT death certificate", url: "https://www.hss.gov.nt.ca/en/services/order-death-certificate" }]
    },
    NU: {
      body: "Nunavut Vital Statistics issues death certificates for deaths registered in Nunavut. The published fee is $10. Keep the funeral-home proof as well because institutions and the Court may ask for different evidence.",
      links: [{ label: "Nunavut Vital Statistics certificate application", url: "https://www.gov.nu.ca/sites/default/files/forms/2022-02/application_for_certificate_birth_marriage_death_eng.pdf" }]
    }
  };
  const probateByProvince = {
    ON: { title: "Ontario: the return after the certificate", body: "If an Ontario estate certificate is issued, the Estate Information Return is generally due within 180 calendar days after the certificate is ISSUED. Separately, the CRA clearance certificate on form TX19 comes only after every required return is filed and assessed: distributing too early can leave the legal representative personally liable.", links: [{ label: "Estate Administration Tax, on ontario.ca", url: "https://www.ontario.ca/page/estate-administration-tax" }] },
    BC: { title: "B.C.: wills search, notice, then the grant", body: "A B.C. grant application includes a wills-notice search even if you believe you have the original will. The intended applicant delivers Form P1 and applicable materials, and normally waits at least 21 days before applying. B.C. then charges the Probate Fee Act amount and, above $25,000, the separate Supreme Court commencement fee. CRA clearance remains a separate federal step near the end.", links: [{ label: "B.C. wills and estates", url: "https://www2.gov.bc.ca/gov/content/life-events/death/after-death/wills-estates" }] },
    AB: { title: "Alberta: choose the grant application route", body: "Alberta applications go to the Court of King's Bench. Non-contentious grants can be prepared through the Surrogate Digital Service or with paper GA forms. Self-represented online applicants must meet SDS requirements. Alberta has no general will registry, so locating the original will is its own task. CRA clearance remains a separate federal step near the end.", links: [{ label: "Alberta surrogate applications", url: "https://www.alberta.ca/surrogate-applications-non-contentious-matters" }] },
    SK: { title: "Saskatchewan: standard grant or small-estate route", body: "For a standard Saskatchewan grant application, the Local Registrar filing fee is $200 and the probate levy is $7 for every $1,000 or part of $1,000 of value passing through the estate. Saskatchewan's application guidance calculates the levy from Total Part 1 Assets in the Statement of Property. If personal property is $25,000 or less and no Saskatchewan real property will pass through the estate, a $100 small-estate order under Form 16-36 may be available instead. The Court also has a registrar-assisted process for qualifying estates of $15,000 or less. CRA clearance remains a separate federal step near the end.", links: [{ label: "Saskatchewan probate information", url: "https://sasklawcourts.ca/kings-bench/wills-and-estates/probating-an-estate/" }, { label: "Saskatchewan estates not exceeding $25,000", url: "https://www.saskatchewan.ca/residents/births-deaths-marriages-and-divorces/dealing-with-death/administering-the-estate-of-someone-whos-died/estates-not-exceeding-25000" }] },
    MB: { title: "Manitoba: no value-based probate charge; Rule 74 still applies", body: "Manitoba eliminated charges relating to applications for probate or administration effective November 6, 2020. Probate work still uses Court of King's Bench Rule 74 forms, including Form 74A for a Request for Probate and Form 74B for the inventory and valuation. For estates whose total property does not exceed $10,000, section 47 also allows the court to use summary administration without a grant; the current form list includes Form 74FF for that request. The Probate Division in Winnipeg is the central registry. Separate court services, such as searches, caveats or certified documents, can still have fees. CRA clearance remains a separate federal step near the end.", links: [{ label: "Manitoba Probate Division", url: "https://www.manitobacourts.mb.ca/court-of-queens-bench/frequently-asked-questions/probate-division/" }, { label: "Manitoba Rule 74 forms", url: "https://web2.gov.mb.ca/laws/rules/forms_e.php" }, { label: "Manitoba Surrogate Practice Act", url: "https://web2.gov.mb.ca/laws/statutes/ccsm/c290.php?lang=en" }] },
    NS: { title: "Nova Scotia: grant, inventory and six-month estate notice", body: "Nova Scotia Probate Court applications use the current provincial forms, and probate filings include the original will as an exhibit to the required affidavit. After a grant issues, the personal representative must file Form 29 inventory within 3 months. Estate notices are advertised in the Royal Gazette for 6 months before settlement and distribution; the current Estate Notice advertising fee is $68.15 including HST and is separate from the probate tax. CRA clearance remains a separate federal step near the end.", links: [{ label: "Nova Scotia Probate Court", url: "https://www.courts.ns.ca/courts/probate-court" }, { label: "Nova Scotia probate regulations", url: "https://novascotia.ca/just/regulations/regs/probregs.htm" }, { label: "Royal Gazette estate notices", url: "https://novascotia.ca/Just/Regulations/advertising.htm" }] },
    NB: { title: "New Brunswick: current forms, waiting periods and 2026 probate tax", body: "New Brunswick Letters Probate use Form 2A or 2B; administration applications use Forms 2C through 2F depending on whether there is a will. The rules require 7 days to lapse after death before probate or administration with the will annexed can be granted, and 14 days before administration of an intestate estate can be granted. The current basic checklist accepts a copy of the death certificate and calls for detailed estate-value information. Probate-tax rates changed for applications filed on or after June 12, 2026. CRA clearance remains a separate federal step near the end.", links: [{ label: "New Brunswick Probate Court", url: "https://www.gnb.ca/content/cour/en/probate-court.html" }, { label: "New Brunswick probate checklist", url: "https://www.gnb.ca/content/dam/courts/pdf/probate-court-cour-des-successions/general-check-list-for-probate-applications.pdf" }, { label: "New Brunswick Probate Rules", url: "https://laws.gnb.ca/en/document/cr/84-9" }] },
    NL: { title: "Newfoundland and Labrador: notice first, then the Rule 56 petition", body: "The Supreme Court says the first step for Probate or Administration is to post a Notice of Application with the Registry. After the 5-day notice period, confirm that no caveat has been entered and no previous grant made before proceeding. The petition includes Form 56.10A inventory and valuation of the deceased's Newfoundland and Labrador property and assets; that value sets the estate-value court charge. Probate applications also include the will and Proof of Will. Administration applications commonly require a bond with two sureties unless the Court dispenses with it. CRA clearance remains a separate federal step near the end.", links: [{ label: "Newfoundland and Labrador probate and administration", url: "https://www.court.nl.ca/supreme/rules-practice-notes-and-forms/civil-proceedings/probate-and-admin/" }, { label: "Newfoundland and Labrador Court service fees", url: "https://www.court.nl.ca/supreme/schedule-of-fees/" }] },
    PE: { title: "P.E.I.: Rule 65 petition, inventory and post-grant notices", body: "P.E.I. applications for Letters Probate or Administration are made by petition in the Supreme Court Estates Section using Rule 65 forms. The Probate Act requires the inventory before the grant. After the grant, the Registrar publishes an estate notice in the Gazette calling for demands within six months, and the personal representative must serve notice of the grant on beneficiaries under the Act's service rules. CRA clearance remains a separate federal step near the end.", links: [{ label: "P.E.I. Probate Act", url: "https://www.princeedwardisland.ca/en/legislation/probate-act" }, { label: "P.E.I. Rule 65 estate forms", url: "https://www.courts.pe.ca/forms" }] },
    QC: { title: "Quebec: succession, liquidator and will verification", body: "Quebec uses civil-law succession rules. The person settling the succession is the liquidator. A will search is mandatory. A notarial will does not need probate, while a holograph or witnessed will must be verified by a notary or the Superior Court. The liquidator registers the designation in the RDPRM, prepares an inventory, and publishes the required inventory notice in the RDPRM and a local newspaper. Successors generally have six months from death to accept or renounce, with an extension so they have at least 60 days after closure of the inventory. Before final distribution, use the Revenu Québec authorization process and obtain the CRA clearance certificate.", links: [{ label: "Quebec liquidator steps", url: "https://www.quebec.ca/en/family-and-support-for-individuals/death/what-to-do-in-the-event-of-death/checklist-of-steps-for-the-close-relatives-or-friends-and-the-liquidator/steps-to-be-taken-by-the-liquidator" }, { label: "Quebec will search", url: "https://www.quebec.ca/en/justice-et-etat-civil/testament-succession/succession/to-do/will-search" }, { label: "Revenu Québec distribution authorization", url: "https://www.revenuquebec.ca/en/online-services/forms-and-publications/current-details/mr-14-a-v/" }] },
    YT: { title: "Yukon: Rule 64 notice, grant and special First Nation checks", body: "For a non-contentious Yukon estate, current Supreme Court Rule 64 governs the grant process. The Court will not issue the grant until 21 days have elapsed from mailing or delivery of the Notice of Application. The application includes proof of death and the applicable estate forms. Where the deceased was a member of a First Nation with a Final Agreement and Self-Government Agreement, the applicant must inquire about applicable First Nation inheritance, wills, intestacy or estate-administration laws; Rule 64 also has a separate requirement where the deceased was subject to the Indian Act. The grant fee is $0 at $25,000 or less and $140 above $25,000. CRA clearance remains a separate federal step near the end.", links: [{ label: "Yukon Rule 64", url: "https://www.yukoncourts.ca/sites/default/files/2022-12/2022%20Rule%2064%20-%20ADMINISTRATION%20OF%20ESTATES%20%28NON%20CONTENTIOUS%29.pdf" }, { label: "Yukon rules and forms", url: "https://www.yukoncourts.ca/en/supreme-court/rules-forms" }] },
    NT: { title: "Northwest Territories: standard grant or Rule 10 small-estate route", body: "The NWT Supreme Court Estate Administration Rules govern probate and administration. The standard court fee uses the net value of property in the Northwest Territories. Under Rule 10, an estate whose net value reasonably appears to be less than $35,000 can use a separate application for a declaration of small estate, using Form 2 and Form 3, instead of a grant if the Court approves it. The Department of Justice also publishes estate-administration and will-search information. CRA clearance remains a separate federal step near the end.", links: [{ label: "NWT Estate Administration Rules", url: "https://www.justice.gov.nt.ca/en/files/court-rules/Judicature%20Act/Estate%20Administration%20Rules/Estate%20Administration%20Rules.pdf" }, { label: "NWT estate administration", url: "https://www.justice.gov.nt.ca/en/estate-administration/" }] },
    NU: { title: "Nunavut: Probate and Administration Rules and court-fee bands", body: "Nunavut Court of Justice probate and administration applications use the published Probate and Administration Rules and forms. Form 1 is the basic application for probate or administration, with supporting affidavits and schedules depending on the estate. The legislated court-fee bands are based on the value of property in Nunavut after deducting debts and liabilities against that property. The Court Registry publishes the current rules and fee structure and can answer procedural questions. CRA clearance remains a separate federal step near the end.", links: [{ label: "Nunavut Probate and Administration Rules", url: "https://www.nunavutcourts.ca/nunavut-court-justice/rules-policies-directives-announcements/rules-court" }, { label: "Nunavut Court fees", url: "https://www.nunavutcourts.ca/nunavut-court-justice/rules-policies-directives-announcements/court-policies-and-fees" }] }
  };
  const docs = docsByProvince[p] || docsByProvince.ON;
  const probate = probateByProvince[p] || probateByProvince.ON;
  return [
    { id: "first", title: "The first calls", body: p === "QC" ? "For a Quebec succession, notify the appropriate pension authorities for the deceased's contribution history: Retraite Québec for QPP and Service Canada for OAS and any CPP that applies. Also notify the Canada Revenue Agency. Quebec succession work later includes Revenu Québec as well." : "Service Canada first, to stop CPP and OAS: benefits are payable for the month of the death and no further, and anything paid after that has to be repaid out of the estate. Then the Canada Revenue Agency, to report the date of death and stop benefit payments.", links: p === "QC" ? [{ label: "Retraite Québec — death and survivor benefits", url: "https://www.retraitequebec.gouv.qc.ca/en/citizens/death" }, { label: "Who to notify, on canada.ca", url: "https://www.canada.ca/en/services/life-events/death/notify.html" }] : [{ label: "Who to notify, on canada.ca", url: "https://www.canada.ca/en/services/life-events/death/notify.html" }] },
    { id: "poa", title: "A power of attorney does not survive the death", body: "Every power of attorney and every pre-death authorisation ends when the person dies. Your authority after death comes from the will and applicable estate law, and sometimes from a court grant. Institutions will ask you to prove that authority.", links: [] },
    { id: "docs", title: "Proof of death", body: docs.body, links: docs.links },
    { id: "money", title: "The 60-day one", body: p === "QC" ? "For the QPP death benefit, the maximum is $2,500. During the first 60 days after death, priority can go to the person or charity that paid funeral expenses and provides proof; after 60 days, heirs may receive the benefit under the published rules. The application itself can be filed for up to five years after death." : "Service Canada asks for the CPP death benefit application within 60 days of the death, on form ISP1200. The base amount is $2,500. A further $2,500 is added only where the person died before ever collecting a CPP retirement or disability pension and left no surviving spouse or common-law partner.", links: p === "QC" ? [{ label: "QPP death benefit", url: "https://www.retraitequebec.gouv.qc.ca/en/citizens/death/death-benefit-quebec-pension-plan" }] : [{ label: "CPP amounts, on canada.ca", url: "https://www.canada.ca/en/services/benefits/publicpensions/cpp/payment-amounts.html" }] },
    { id: "fraud", title: "Tell the credit bureaus", body: "Equifax and TransUnion should both be told so that new credit cannot easily be taken out in the name of the person who died.", links: [{ label: "Notifying a death, on canada.ca", url: "https://www.canada.ca/en/services/life-events/death/notify.html" }] },
    { id: "probate", title: probate.title, body: probate.body, links: probate.links },
    { id: "notadvice", title: "None of this is advice", body: "Whether an estate needs probate at all, how an asset passes, what the will means, and what should be filed are legal and tax questions. This app keeps your record of the process. It does not tell you what to do; use the jurisdiction-specific legal-help route under Help when you need advice.", links: [] }
  ];
}
const GUIDE_SECTIONS = guideSections("ON");



const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

// Domain lookup helpers. Older prototypes used a few different IDs, so the
// normalisers keep an existing test record readable while V1A writes only the
// estate-specific IDs above.
const normaliseStageId = (id) => id === "submitted" ? "sent" : (STAGES.some((s) => s.id === id) ? id : "todo");
const stageIndex = (id) => Math.max(0, STAGES.findIndex((s) => s.id === normaliseStageId(id)));
const stageLabel = (id) => STAGES[stageIndex(id)].label;
const bodyArea = (id) => BODY_AREAS.find((a) => a.id === id) || BODY_AREAS[BODY_AREAS.length - 1];
const normaliseConditionStatusId = (id) => id === "unclaimed" ? "unsure" : (CONDITION_STATUSES.some((s) => s.id === id) ? id : "unsure");
const conditionStatus = (id) => CONDITION_STATUSES.find((s) => s.id === normaliseConditionStatusId(id)) || CONDITION_STATUSES[3];
const redressLevel = (id, province = "ON") => {
  const normalized = id === "eir" ? "provincial" : id;
  const current = probateLevels(province);
  const direct = current.find((r) => r.id === normalized);
  if (direct) return direct;
  for (const key of Object.keys(PROBATE_LEVELS)) {
    const found = PROBATE_LEVELS[key].find((r) => r.id === normalized);
    if (found) return found;
  }
  return current[0];
};
const redressOutcome = (id) => REDRESS_OUTCOMES.find((r) => r.id === id) || REDRESS_OUTCOMES[0];

// ---- Dates. Everything is stored as YYYY-MM-DD, parsed as local rather than
// UTC. new Date("2026-03-01") is midnight UTC, which in Canadian time zones west of UTC can be the evening
// of February 28th, and that one-day slip would show up in every elapsed count. --
function parseDate(s) {
  if (!s) return null;
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}
function todayISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}
function daysBetween(fromISO, toISO) {
  const a = parseDate(fromISO), b = parseDate(toISO || todayISO());
  if (!a || !b) return null;
  return Math.round((b - a) / 86400000);
}
function formatDate(s) {
  const d = parseDate(s);
  if (!d) return "";
  return d.toLocaleDateString(getLang() === "fr" ? "fr-CA" : "en-CA", { year: "numeric", month: "short", day: "numeric" });
}
// Whole months and years counted off the calendar, not by dividing days by an
// average month length. That shortcut makes exactly one year come out as
// "11 months", because 365 divided by 30.44 is 11.99. On an app whose whole
// job is showing people how long they have been waiting, that is not a
// rounding quibble.
function calendarSpan(fromISO, toISO) {
  const a = parseDate(fromISO), b = parseDate(toISO || todayISO());
  if (!a || !b) return null;
  const forward = b >= a;
  const from = forward ? a : b, to = forward ? b : a;
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  // Not a full month yet if the day of the month has not come round again.
  if (to.getDate() < from.getDate()) months -= 1;
  const anchor = new Date(from.getFullYear(), from.getMonth() + months, from.getDate());
  const days = Math.round((to - anchor) / 86400000);
  const totalDays = Math.round((to - from) / 86400000);
  return { forward, years: Math.floor(months / 12), months: months % 12, days, totalDays };
}

// "1 year, 2 months" reads better than "428 days" once a claim has been open
// a while, and long waits are the normal case here rather than the exception.
function spanText(fromISO, toISO) {
  const s = calendarSpan(fromISO, toISO);
  if (!s) return "";
  if (s.totalDays === 0) return t("today");
  // French pluralises these the same way English does, so one table of four
  // units serves both; the singular and plural stay separate entries because
  // "1 mois" and "2 mois" happen to match while "1 an" and "2 ans" do not.
  const unit = (n, one, many) => n + " " + t(n === 1 ? one : many);
  if (s.years === 0 && s.months === 0) return unit(s.totalDays, "day", "days");
  const parts = [];
  if (s.years) parts.push(unit(s.years, "year", "years"));
  if (s.months) parts.push(unit(s.months, "month", "months"));
  if (!s.years && s.months && s.days) parts.push(unit(s.days, "day", "days"));
  return parts.join(", ");
}

// ---- Start Here guided checklist.
//
// This is deliberately an ordered orientation layer, not legal advice and not
// a deadline calculator. A person opening the app after a death should not have
// to understand the tab structure before they can begin. Each item can be
// checked, dated and annotated; the record is saved with the rest of the estate.
const START_GROUPS = [
  { id: "immediate", title: "Start here — first things first", blurb: "Begin with the facts and documents that unlock almost everything else." },
  { id: "days", title: "Next — first days", blurb: "Secure the estate and make the first important notifications." },
  { id: "weeks", title: "Then — first weeks", blurb: "Build the estate picture and deal with benefits, accounts and authority." },
  { id: "admin", title: "Administration", blurb: "Keep records as you work through tax, property, debts and distributions." },
  { id: "finish", title: "Before you finish", blurb: "Final tax and distribution steps come after the estate is ready for them." }
];
const START_TASKS = [
  { id: "death-proof", group: "immediate", title: "Get proof of death / death certificates", detail: "Ask the funeral home what proof it provides and find out whether certified death certificates will be needed for the institutions you must contact." },
  { id: "will", group: "immediate", title: "Find the most recent will and codicils", detail: "Locate the original will, any codicils and the lawyer or notary information. Do not assume an older copy is the final will." },
  { id: "representative", group: "immediate", title: "Confirm who is responsible for the estate", detail: "Identify the executor, administrator or, in Quebec, liquidator. Court or other formal authority may be required depending on the estate and jurisdiction." },
  { id: "funeral", group: "immediate", title: "Record funeral, burial or cremation arrangements", detail: "Keep contracts, receipts and information about any prepaid plan or insurance." },

  { id: "secure", group: "days", title: "Secure the home, property, vehicles and valuables", detail: "Protect property, collect keys, check insurance requirements and make sure essential property is not left unattended or at risk." },
  { id: "dependants", group: "days", title: "Deal with immediate needs of dependants and pets", detail: "Record any urgent care, housing or practical arrangements that need attention." },
  { id: "mail", group: "days", title: "Secure mail and important records", detail: "Gather statements, tax records, bills, identification and other estate paperwork. Consider how mail will be handled while the estate is being settled." },
  { id: "service-canada", group: "days", title: "Notify Service Canada and stop CPP / OAS payments when applicable", detail: "Report the death as required and record the date and reference information. Quebec Pension Plan matters are handled through Retraite Québec." },
  { id: "cra", group: "days", title: "Notify the Canada Revenue Agency", detail: "Report the death to the CRA and keep a record of what was sent or discussed." },
  { id: "province", group: "days", title: "Notify provincial or territorial programs that apply", detail: "Health coverage, driver's licence, benefits and other programs vary by province or territory. Use the estate's jurisdiction in Settings to guide your research." },

  { id: "inventory", group: "weeks", title: "Start a complete estate inventory", detail: "List bank accounts, investments, real estate, vehicles, personal property, business interests, debts and other assets or liabilities." },
  { id: "banks", group: "weeks", title: "Contact banks and financial institutions", detail: "Tell each institution about the death, ask what documents it requires and record balances or values at the date of death where needed." },
  { id: "insurance", group: "weeks", title: "Find and contact life insurance companies", detail: "Locate policies and beneficiary information and ask the insurer about its claim process." },
  { id: "pensions", group: "weeks", title: "Contact employers, pensions and workplace benefit plans", detail: "Ask about pension survivor benefits, final pay, group life insurance and any other amounts or benefits that may be payable." },
  { id: "benefits", group: "weeks", title: "Check survivor and death benefits", detail: "Review the Benefits section for programs that may apply. The responsible government or plan administrator decides eligibility." },
  { id: "utilities", group: "weeks", title: "Review utilities, subscriptions and recurring payments", detail: "Identify services that should continue temporarily and those that can be cancelled. Avoid cancelling something needed to protect estate property." },
  { id: "digital", group: "weeks", title: "Identify digital accounts and online services", detail: "Record important email, cloud, social, subscription and other digital accounts and follow each provider's process for a deceased account holder." },
  { id: "authority", group: "weeks", title: "Determine whether probate, a grant or will verification is required", detail: "Requirements vary across Canada and by the assets involved. Use the Probate / Succession section for process information and get legal advice where the answer is unclear." },

  { id: "estate-account", group: "admin", title: "Open or use an estate account if required", detail: "Keep estate money separate and maintain a clear record of deposits, payments and reimbursements." },
  { id: "debts", group: "admin", title: "Identify debts, bills and legitimate estate expenses", detail: "Keep statements and receipts. Do not assume every debt should be paid immediately or personally by the executor." },
  { id: "tax-returns", group: "admin", title: "Prepare the deceased person's required tax returns", detail: "Determine which CRA and, where applicable, Revenu Québec returns are required and keep the supporting records." },
  { id: "property", group: "admin", title: "Manage, transfer or sell estate property as authorized", detail: "Keep insurance, valuation, sale and transfer records. Follow the will and applicable law before disposing of estate property." },
  { id: "beneficiaries", group: "admin", title: "Keep beneficiaries or heirs appropriately informed", detail: "Record important communications and documents provided while the estate is being administered." },

  { id: "estate-tax", group: "finish", title: "Complete estate / trust tax work that applies", detail: "An estate can have tax obligations after death. An accountant or the responsible tax authority can confirm what filings are required." },
  { id: "clearance", group: "finish", title: "Consider tax clearance before final distribution", detail: "CRA clearance, and a separate Revenu Québec authorization process in Quebec, can matter before final distribution. Confirm the requirements for this estate." },
  { id: "distribution", group: "finish", title: "Make final distributions only when the estate is ready", detail: "Follow the will or applicable succession law, resolve required debts and taxes, and keep a record of each distribution." },
  { id: "accounts", group: "finish", title: "Prepare final estate accounts and keep the file", detail: "Reconcile money in and out, retain receipts and statements, document distributions and keep the estate record for the period appropriate to the circumstances." }
];

// ---- Storage. Text in localStorage, document images in IndexedDB. The same
// split as the recipe app, for the same reason: localStorage is about 5MB and
// a handful of photographed letters would fill it and take the claims with it. --
const STORAGE_KEY = "estate-file-v1";

// ---- Language.
// Kept outside the estate record so switching language never touches estate
// data. On first launch the interface follows the phone language.
const LANG_KEY = "estate-file-lang";
function loadLangPref() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === "fr" || saved === "en") return saved;
  } catch {}
  try {
    const nav = (navigator.languages && navigator.languages[0]) || navigator.language || "";
    if (/^fr\b/i.test(nav)) return "fr";
  } catch {}
  return "en";
}
function saveLangPref(l) {
  try { localStorage.setItem(LANG_KEY, l); } catch {}
}

// Text size is kept out of the record for the same reason as language: a
// display preference must never be able to damage the estate record, and a
// corrupt record must never be able to strand somebody at unreadable text.
const TEXT_KEY = "estate-file-textsize";
function loadTextPref() {
  try {
    const saved = localStorage.getItem(TEXT_KEY);
    if (TEXT_SIZES.some((s) => s.id === saved)) return saved;
  } catch {}
  return "normal";
}
function saveTextPref(id) {
  try { localStorage.setItem(TEXT_KEY, id); } catch {}
}
const textSizeDef = (id) => TEXT_SIZES.find((s) => s.id === id) || TEXT_SIZES[0];

// Theme preference, outside the record like every display preference.
const THEME_KEY = "estate-file-theme";
function loadThemePref() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (THEMES.some((s) => s.id === saved)) return saved;
  } catch {}
  return "auto";
}
function saveThemePref(id) {
  try { localStorage.setItem(THEME_KEY, id); } catch {}
}

// ---- First run.
//
// Someone opening this cold gets seven tabs and no orientation. Four cards,
// once, on the first launch. Three of them are orientation and one is the
// thing that matters most: what this app is not.
//
// It is skippable from the first card, because somebody who wants to get on
// with it should not be made to sit through anything, and it never returns
// once dismissed. The flag is stored outside the record so that restoring a
// backup does not make it reappear.
const SEEN_KEY = "estate-file-seen-intro";
const INTRO_CARDS = [
  {
    id: "what",
    title: t("Your own record of settling an estate"),
    body: t("Everything you put in stays on this phone. There is no account, no server, and nothing is sent anywhere. That is why it works with no signal, and why a backup matters.")
  },
  {
    id: "not",
    title: t("What this is not"),
    body: t("This is not a government service, a law firm or an accountant, and it is not connected to any of them. It cannot see any file, cannot submit anything, and does not give legal or tax advice. It keeps your record of what you have done.")
  },
  {
    id: "help",
    title: t("Help is always one tap away"),
    body: t("The Help button at the top of every screen has crisis and grief support first, then the government numbers you may need and jurisdiction-specific legal-help routes. Choose the estate province or territory in Settings so the local information is right.")
  },
  {
    id: "start",
    title: t("Start Here shows you what comes next"),
    body: t("Open Start Here for an ordered checklist of the estate work. Tap a box when something is done, add the date, and keep a note. You do not have to remember the whole process at once.")
  }
];
function loadSeenIntro() {
  try { return localStorage.getItem(SEEN_KEY) === "1"; } catch { return false; }
}
function saveSeenIntro() {
  try { localStorage.setItem(SEEN_KEY, "1"); } catch {}
}

// What kind of thing a search result is. At module scope with the other data
// tables so it is translated at render time and can be walked by the French
// coverage test, rather than hidden inside the component where nothing can
// check it.
// What kind of event a timeline row is. Module scope with the other data
// tables so labels stay centralized.
const TIMELINE_KIND = {
  applied: { label: t("Step started"), tone: "blue" },
  stage: { label: t("Moved on"), tone: "grey" },
  contact: { label: t("Call or message"), tone: "grey" },
  redress: { label: t("Probate stage"), tone: "amber" },
  outcome: { label: t("Outcome"), tone: "green" },
  reminder: { label: t("Date to watch"), tone: "amber" },
  document: { label: t("Document kept"), tone: "grey" }
};

const SEARCH_KIND_LABEL = {
  claim: t("Step"), condition: t("What it is"), contact: t("Contact log"),
  reminder: t("Reminder"), statement: t("In your own words"), redress: t("Probate stage")
};

// ---- The lock.
//
// What this is: a screen in front of the file, so a phone left on a kitchen
// table or handed to somebody to look at a photograph does not also hand over
// the estate record.
//
// What this is NOT, and the app says so on the setting itself: encryption.
// The record still sits in this device's storage exactly as before. Anyone
// with the phone's passcode and the patience to open browser storage can read
// it whether this is on or off. Saying otherwise would be a lie somebody
// might rely on, and the honest framing costs nothing.
//
// The PIN is stored as a salted SHA-256 digest rather than in the clear. That
// does not make the record private; it means the PIN itself is not sitting
// there to be read, and people reuse PINs.
const LOCK_KEY = "estate-file-lock";
async function hashPin(pin, salt) {
  const enc = new TextEncoder().encode(String(salt) + ":" + String(pin));
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function loadLock() {
  try {
    const raw = localStorage.getItem(LOCK_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    return (o && o.hash && o.salt) ? o : null;
  } catch { return null; }
}
function saveLock(o) {
  try {
    if (o) localStorage.setItem(LOCK_KEY, JSON.stringify(o));
    else localStorage.removeItem(LOCK_KEY);
    return true;
  } catch { return false; }
}
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function saveState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (e) { console.error("save failed", e); }
}

const DOC_DB = "estate-file-docs";
const DOC_STORE = "docs";
function openDocDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DOC_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DOC_STORE)) db.createObjectStore(DOC_STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function docTx(mode, run) {
  return openDocDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(DOC_STORE, mode);
    const store = tx.objectStore(DOC_STORE);
    let out;
    try { out = run(store); } catch (e) { reject(e); return; }
    tx.oncomplete = () => resolve(out && out.result !== undefined ? out.result : out);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }));
}
const docPut = (rec) => docTx("readwrite", (st) => st.put(rec));
const docGet = (id) => docTx("readonly", (st) => st.get(id));
const docDelete = (id) => docTx("readwrite", (st) => st.delete(id));
// Every document, contents and all. Only ever called when the person asks for
// a full backup: pulling several megabytes of scanned letters into memory is
// not something to do on a whim.
const docAllFull = () => docTx("readonly", (st) => st.getAll()).then((rows) => rows || []);
const docAllMeta = () => docTx("readonly", (st) => st.getAll()).then((rows) =>
  (rows || []).map((r) => ({ id: r.id, claimId: r.claimId, title: r.title, addedAt: r.addedAt, kind: r.kind || "image", thumb: r.thumb })));

// PDFs cannot be shrunk the way a photograph can. A scanned letter from My
// a bank or registry is already compressed, and re-encoding it would need a PDF
// library this app does not carry. So they are stored as they arrive, with a
// ceiling, and the user is told plainly when a file is too big rather than
// the save quietly failing later.
const MAX_PDF_BYTES = 8 * 1024 * 1024;
const isPdf = (file) => (file.type === "application/pdf") || /\.pdf$/i.test(file.name || "");

function readPdf(file) {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_PDF_BYTES) {
      reject(new Error(t("That PDF is over 8 MB. Try downloading it again at a smaller size, or photograph the pages instead.")));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(t("Could not read that file.")));
    reader.onload = () => resolve({ kind: "pdf", full: reader.result, thumb: null, bytes: file.size });
    reader.readAsDataURL(file);
  });
}

// A photographed letter at full phone resolution is three or four megabytes and
// none of that detail survives being shown on a phone screen. Downsizing before
// storing keeps a hundred documents well inside what the device will hold.
// 1400px on the long edge keeps typed text readable when zoomed.
function readAndResize(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(t("Could not read that file.")));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error(t("That does not look like an image.")));
      img.onload = () => {
        const render = (maxSide, quality) => {
          const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const hh = Math.max(1, Math.round(img.height * scale));
          const c = document.createElement("canvas");
          c.width = w; c.height = hh;
          const ctx = c.getContext("2d");
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, w, hh);
          ctx.drawImage(img, 0, 0, w, hh);
          return c.toDataURL("image/jpeg", quality);
        };
        try { resolve({ kind: "image", full: render(1400, 0.8), thumb: render(200, 0.6) }); }
        catch (e) { reject(new Error(t("Could not process that image."))); }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

const readDocument = (file) => isPdf(file) ? readPdf(file) : readAndResize(file);

// Style helpers are functions, not constants. A constant would bake in the
// colour values and the text scale at load time, before the person's theme
// and size preferences have been read - which is exactly what happened to
// inputs in v5i: they stayed at normal size while everything else grew.
const inputStyle = () => ({
  padding: "10px 11px",
  borderRadius: 8,
  border: "1px solid " + T.line,
  background: T.field,
  fontSize: fs(13.5),
  color: T.ink,
  outline: "none"
});
const labelStyle = () => ({ fontFamily: font.body, fontSize: fs(11), fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 });

function Field(props) {
  return h("div", { style: { marginBottom: 11 } },
    h("div", { style: labelStyle() }, props.label),
    props.children,
    props.hint ? h("div", { style: { fontSize: fs(10.5), color: T.inkSoft, marginTop: 4, lineHeight: 1.4 } }, props.hint) : null
  );
}

function EstateFile() {
  const [loaded, setLoaded] = useState(false);
  const [province, setProvince] = useState("ON");
  const [claims, setClaims] = useState([]);
  const [startChecklist, setStartChecklist] = useState({});
  const [startOpen, setStartOpen] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [redress, setRedress] = useState([]);
  const [evidence, setEvidence] = useState({});
  const [statements, setStatements] = useState({});
  const [docMeta, setDocMeta] = useState([]);
  // setLang runs inside the initialiser so the very first render is already in
  // the right language; t() reads a module-level value, not this state.
  const [lang, setLangState] = useState(() => { const l = loadLangPref(); setLang(l); return l; });
  // As with language, the scale is applied inside the initialiser so the very
  // first paint is already at the chosen size rather than flashing at normal.
  const [themeChoice, setThemeChoice] = useState(() => {
    const id = loadThemePref();
    setThemeTokens(id);
    return id;
  });
  // The sheet backdrop reads the choice through a ref because sheet() is
  // called from render helpers that close over an older render otherwise.
  const themeChoiceRef = useRef(themeChoice);
  themeChoiceRef.current = themeChoice;
  const chooseTheme = (id) => {
    setThemeTokens(id);
    saveThemePref(id);
    setThemeChoice(id);
  };
  // Follow-the-phone means following it live: someone whose phone goes dark
  // at sunset should see the app follow without reopening it.
  useEffect(() => {
    if (themeChoice !== "auto") return;
    let mq;
    const onChange = () => { setThemeTokens("auto"); setThemeChoice("auto"); forceRender((n) => n + 1); };
    try {
      mq = window.matchMedia("(prefers-color-scheme: dark)");
      if (mq.addEventListener) mq.addEventListener("change", onChange);
      else if (mq.addListener) mq.addListener(onChange);
    } catch {}
    return () => {
      try {
        if (mq && mq.removeEventListener) mq.removeEventListener("change", onChange);
        else if (mq && mq.removeListener) mq.removeListener(onChange);
      } catch {}
    };
  }, [themeChoice]);
  const [, forceRender] = useState(0);

  const [textSize, setTextSizeState] = useState(() => {
    const id = loadTextPref();
    setTextScale(textSizeDef(id).scale);
    return id;
  });
  // The lock is checked before anything else renders. Starting locked when a
  // PIN exists means a cold launch never flashes the file for an instant
  // first, which would defeat the whole point of it.
  const [lockRec, setLockRec] = useState(() => loadLock());
  const [locked, setLocked] = useState(() => !!loadLock());
  const [pinEntry, setPinEntry] = useState("");
  const [pinError, setPinError] = useState("");
  const [lockSetupOpen, setLockSetupOpen] = useState(false);
  const [pinNew, setPinNew] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");

  const tryUnlock = async () => {
    if (!lockRec) { setLocked(false); return; }
    try {
      const h = await hashPin(pinEntry, lockRec.salt);
      if (h === lockRec.hash) { setLocked(false); setPinEntry(""); setPinError(""); }
      else setPinError(t("That is not the right PIN."));
    } catch { setPinError(t("Could not check the PIN on this device.")); }
  };

  const setUpLock = async () => {
    const pin = pinNew.trim();
    if (!/^\d{4,8}$/.test(pin)) { setPinError(t("Use 4 to 8 numbers.")); return; }
    if (pin !== pinConfirm.trim()) { setPinError(t("The two PINs are not the same.")); return; }
    try {
      const salt = uid() + uid();
      const rec = { salt, hash: await hashPin(pin, salt) };
      if (!saveLock(rec)) { setPinError(t("Could not save the PIN on this device.")); return; }
      setLockRec(rec);
      setPinNew(""); setPinConfirm(""); setPinError("");
      setLockSetupOpen(false);
      flash(t("Lock turned on"));
    } catch { setPinError(t("Could not save the PIN on this device.")); }
  };

  const removeLock = () => {
    saveLock(null);
    setLockRec(null);
    setLocked(false);
    setPinNew(""); setPinConfirm(""); setPinEntry(""); setPinError("");
    setLockSetupOpen(false);
    flash(t("Lock turned off"));
  };

  const chooseTextSize = (id) => {
    setTextScale(textSizeDef(id).scale);
    saveTextPref(id);
    setTextSizeState(id);
  };
  const chooseLang = (l) => {
    setLang(l);
    saveLangPref(l);
    setLangState(l);
    try { document.documentElement.lang = l; } catch {}
  };
  useEffect(() => {
    try {
      document.documentElement.lang = lang;
      document.title = lang === "fr" ? "Dossier successoral — Votre propre dossier" : "Estate File — An Executor's Own Record";
    } catch {}
  }, [lang]);

  const [tab, setTab] = useState("start");
  const [openClaim, setOpenClaim] = useState(null);
  const [toast, setToast] = useState("");

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [cCondition, setCCondition] = useState("");
  const [cType, setCType] = useState(BENEFIT_TYPES[0]);
  const [cFile, setCFile] = useState("");
  const [cApplied, setCApplied] = useState(todayISO());
  const [cStage, setCStage] = useState("todo");
  const [cNotes, setCNotes] = useState("");

  const [remOpen, setRemOpen] = useState(false);
  const [remLabel, setRemLabel] = useState("");
  const [remDate, setRemDate] = useState(todayISO());
  const [remClaim, setRemClaim] = useState("");

  const [logOpen, setLogOpen] = useState(false);
  const [logWho, setLogWho] = useState("");
  const [logDate, setLogDate] = useState(todayISO());
  const [logSummary, setLogSummary] = useState("");
  const [logClaim, setLogClaim] = useState("");

  const [redressOpen, setRedressOpen] = useState(false);
  const [rdEditingId, setRdEditingId] = useState(null);
  const [rdClaim, setRdClaim] = useState("");
  const [rdLevel, setRdLevel] = useState(REDRESS_LEVELS[0].id);
  const [rdRequested, setRdRequested] = useState(todayISO());
  const [rdHeard, setRdHeard] = useState("");
  const [rdDecided, setRdDecided] = useState("");
  const [rdOutcome, setRdOutcome] = useState("waiting");
  const [rdRep, setRdRep] = useState(REPRESENTATIVES[0]);
  const [rdNotes, setRdNotes] = useState("");

  const [docTitle, setDocTitle] = useState("");
  const [estImpair, setEstImpair] = useState("");
  const [estQol, setEstQol] = useState("");
  const [estFraction, setEstFraction] = useState("5/5");
  const [viewingDoc, setViewingDoc] = useState(null);

  const [conditions, setConditions] = useState([]);
  const [condOpen, setCondOpen] = useState(false);
  const [condEditingId, setCondEditingId] = useState(null);
  const [bName, setBName] = useState("");
  const [bArea, setBArea] = useState(BODY_AREAS[0].id);
  const [bStatus, setBStatus] = useState("unsure");
  const [bLinked, setBLinked] = useState("");
  const [bSymptoms, setBSymptoms] = useState("");
  const [bImpacts, setBImpacts] = useState("");
  const [condExportOpen, setCondExportOpen] = useState(false);
  const [condExportText, setCondExportText] = useState("");

  const [guideOpen, setGuideOpen] = useState(false);
  const [introStep, setIntroStep] = useState(() => (loadSeenIntro() ? -1 : 0));
  const dismissIntro = () => { saveSeenIntro(); setIntroStep(-1); };
  const [searchOpen, setSearchOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");

  const [backupOpen, setBackupOpen] = useState(false);
  const [backupText, setBackupText] = useState("");
  const [restoreText, setRestoreText] = useState("");
  const fileRef = useRef(null);
  const pendingDocClaim = useRef(null);

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2600); };

  useEffect(() => {
    const data = loadState();
    if (data) {
      if (data.province) setProvince(normaliseProvinceId(data.province));
      if (Array.isArray(data.claims)) setClaims(data.claims);
      if (data.startChecklist && typeof data.startChecklist === "object") setStartChecklist(data.startChecklist);
      if (Array.isArray(data.reminders)) setReminders(data.reminders);
      if (Array.isArray(data.contacts)) setContacts(data.contacts);
      if (Array.isArray(data.redress)) setRedress(data.redress);
      if (data.evidence && typeof data.evidence === "object") setEvidence(data.evidence);
      if (data.statements && typeof data.statements === "object") setStatements(data.statements);
      if (Array.isArray(data.conditions)) setConditions(data.conditions);
    }
    setLoaded(true);
    docAllMeta().then(setDocMeta).catch(() => {});
  }, []);

  useEffect(() => {
    if (!loaded) return;
    saveState({ province, claims, startChecklist, reminders, contacts, redress, evidence, statements, conditions });
  }, [province, claims, startChecklist, reminders, contacts, redress, evidence, statements, conditions, loaded]);

  const claimById = (id) => claims.find((c) => c.id === id) || null;

  // ---- Search.
  //
  // An executor six months into this has steps, dozens of logged calls,
  // reminders, conditions and two drafts per claim. "When did I speak to that
  // case manager, and what did she say" is then a real question with no way
  // to answer it short of scrolling everything.
  //
  // Plain substring matching, accent- and case-insensitive, across everything
  // the person typed themselves. It deliberately does NOT search the benefit
  // directory or the guide: those are reference text, and burying somebody's
  // own contact log under twenty programme descriptions would defeat the
  // point. Results carry the estate step they belong to, so a note stays tied
  // to the task that gives it context.
  const normalise = (s) => String(s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const searchResults = useMemo(() => {
    const q = normalise(searchQ).trim();
    if (q.length < 2) return [];
    const hit = (...parts) => normalise(parts.filter(Boolean).join(" ")).indexOf(q) !== -1;
    const out = [];
    const claimName = (id) => { const c = claimById(id); return c ? c.condition : null; };

    claims.forEach((c) => {
      if (hit(c.condition, c.type, c.fileNumber, c.notes))
        out.push({ kind: "claim", id: c.id, claimId: c.id,
          title: c.condition, sub: c.notes || t(c.type) || "" });
    });
    conditions.forEach((c) => {
      if (hit(c.name, c.symptoms, c.impacts, c.linked))
        out.push({ kind: "condition", id: c.id,
          title: c.name, sub: c.impacts || c.symptoms || "" });
    });
    contacts.forEach((r) => {
      if (hit(r.who, r.summary))
        out.push({ kind: "contact", id: r.id, claimId: r.claimId,
          title: r.who || t("Contact log"), sub: r.summary || "", date: r.date });
    });
    reminders.forEach((r) => {
      if (hit(r.label))
        out.push({ kind: "reminder", id: r.id, claimId: r.claimId,
          title: r.label, sub: "", date: r.date });
    });
    // statements is keyed claimId -> kind -> text.
    Object.keys(statements || {}).forEach((cid) => {
      const byKind = statements[cid] || {};
      Object.keys(byKind).forEach((kind) => {
        const text = byKind[kind];
        if (!text || !hit(text)) return;
        out.push({ kind: "statement", id: cid + ":" + kind, claimId: cid,
          title: t(statementDef(kind).label),
          sub: String(text).replace(/\s+/g, " ").slice(0, 120) });
      });
    });
    redress.forEach((r) => {
      if (hit(r.notes, r.representative))
        out.push({ kind: "redress", id: r.id, claimId: r.claimId,
          title: t(redressLevel(r.level, province).label), sub: r.notes || "", date: r.dateRequested });
    });

    return out.map((r) => ({ ...r, claimName: r.claimId ? claimName(r.claimId) : null }));
  }, [searchQ, claims, conditions, contacts, reminders, statements, redress, lang, province]);


  // Tapping a result puts you where the thing lives, rather than showing it in
  // a dead-end preview.
  const openSearchResult = (r) => {
    setSearchOpen(false);
    if (r.kind === "condition") { setTab("body"); setOpenClaim(null); return; }
    if (r.kind === "reminder" && !r.claimId) { setTab("reminders"); setOpenClaim(null); return; }
    if (r.claimId && claimById(r.claimId)) { setTab("claims"); setOpenClaim(r.claimId); return; }
    setTab(r.kind === "reminder" ? "reminders" : "claims");
    setOpenClaim(null);
  };
  const current = openClaim ? claimById(openClaim) : null;

  const openNewClaim = () => {
    setEditingId(null);
    setCCondition(""); setCType(BENEFIT_TYPES[0]); setCFile("");
    setCApplied(todayISO()); setCStage("todo"); setCNotes("");
    setEditorOpen(true);
  };
  const openEditClaim = (c) => {
    setEditingId(c.id);
    setCCondition(c.condition); setCType(c.type || BENEFIT_TYPES[0]); setCFile(c.fileNumber || "");
    setCApplied(c.dateApplied || todayISO()); setCStage(normaliseStageId(c.stage)); setCNotes(c.notes || "");
    setEditorOpen(true);
  };
  const saveClaim = () => {
    const condition = cCondition.trim();
    if (!condition) return;
    const rec = {
      condition, type: cType, fileNumber: cFile.trim(),
      dateApplied: cApplied, stage: cStage, notes: cNotes.trim()
    };
    if (editingId) {
      setClaims((cur) => cur.map((c) => c.id === editingId ? { ...c, ...rec } : c));
      flash(t("Step updated"));
    } else {
      const id = uid();
      setClaims((cur) => cur.concat([{ id, ...rec, createdAt: todayISO(), history: [{ stage: cStage, on: todayISO() }] }]));
      flash(t("Step added"));
    }
    setEditorOpen(false);
  };
  const deleteClaim = (id) => {
    setClaims((cur) => cur.filter((c) => c.id !== id));
    setReminders((cur) => cur.filter((r) => r.claimId !== id));
    setContacts((cur) => cur.filter((r) => r.claimId !== id));
    setRedress((cur) => cur.filter((r) => r.claimId !== id));
    docMeta.filter((d) => d.claimId === id).forEach((d) => docDelete(d.id).catch(() => {}));
    setDocMeta((cur) => cur.filter((d) => d.claimId !== id));
    setOpenClaim(null);
    setEditorOpen(false);
    flash(t("Step removed"));
  };

  // Moving a stage records when it happened, which is what turns this from a
  // status field into a history you can actually show someone.
  const setStage = (id, stageId) => {
    setClaims((cur) => cur.map((c) => {
      if (c.id !== id) return c;
      const history = (c.history || []).concat([{ stage: stageId, on: todayISO() }]);
      return { ...c, stage: stageId, history };
    }));
  };

  const addReminder = () => {
    const label = remLabel.trim();
    if (!label) return;
    setReminders((cur) => cur.concat([{ id: uid(), label, date: remDate, claimId: remClaim || null, done: false }]));
    setRemLabel(""); setRemDate(todayISO()); setRemClaim("");
    setRemOpen(false);
    flash(t("Reminder added"));
  };
  const toggleReminder = (id) => setReminders((cur) => cur.map((r) => r.id === id ? { ...r, done: !r.done } : r));
  const removeReminder = (id) => setReminders((cur) => cur.filter((r) => r.id !== id));

  const addContact = () => {
    const who = logWho.trim();
    if (!who) return;
    setContacts((cur) => cur.concat([{ id: uid(), who, date: logDate, summary: logSummary.trim(), claimId: logClaim || null }]));
    setLogWho(""); setLogDate(todayISO()); setLogSummary(""); setLogClaim("");
    setLogOpen(false);
    flash(t("Added to the contact log"));
  };
  const removeContact = (id) => setContacts((cur) => cur.filter((r) => r.id !== id));

  // ---------- head to toe ----------

  const openNewCondition = () => {
    setCondEditingId(null);
    setBName(""); setBArea(BODY_AREAS[0].id); setBStatus("unsure");
    setBLinked(""); setBSymptoms(""); setBImpacts("");
    setCondOpen(true);
  };
  const openEditCondition = (c) => {
    setCondEditingId(c.id);
    setBName(c.name); setBArea(c.area || BODY_AREAS[0].id); setBStatus(normaliseConditionStatusId(c.status));
    setBLinked(c.linked || ""); setBSymptoms(c.symptoms || ""); setBImpacts(c.impacts || "");
    setCondOpen(true);
  };
  const saveCondition = () => {
    const name = bName.trim();
    if (!name) return;
    const rec = {
      name, area: bArea, status: bStatus,
      linked: bLinked.trim(), symptoms: bSymptoms.trim(), impacts: bImpacts.trim(),
      updatedAt: todayISO()
    };
    if (condEditingId) {
      setConditions((cur) => cur.map((c) => c.id === condEditingId ? { ...c, ...rec } : c));
      flash(t("Updated"));
    } else {
      setConditions((cur) => cur.concat([{ id: uid(), ...rec, createdAt: todayISO() }]));
      flash(t("Added to the inventory"));
    }
    setCondOpen(false);
  };
  const deleteCondition = (id) => {
    setConditions((cur) => cur.filter((c) => c.id !== id));
    setCondOpen(false);
    flash(t("Removed"));
  };

  // A stable estate-inventory order is the whole idea, so the sort key is the area's
  // position in BODY_AREAS rather than anything alphabetical.
  const conditionsByArea = useMemo(() => {
    const order = {};
    BODY_AREAS.forEach((a, i) => { order[a.id] = i; });
    const sorted = conditions.slice().sort((a, b) => {
      const d = (order[a.area] ?? 99) - (order[b.area] ?? 99);
      return d !== 0 ? d : a.name.localeCompare(b.name);
    });
    const groups = [];
    sorted.forEach((c) => {
      const last = groups[groups.length - 1];
      if (last && last.area === (c.area || "whole")) last.items.push(c);
      else groups.push({ area: c.area || "whole", items: [c] });
    });
    return groups;
  }, [conditions]);

  // Plain text, because the places this goes are a doctor's desk, a form and
  // an email, none of which want anything fancier. The header says whose
  // words these are: the reader should never mistake it for a court document.
  const buildConditionText = () => {
    const lines = [];
    lines.push(t("THE ESTATE INVENTORY"));
    lines.push(t("My own record of this estate. Not a court document and not a legal valuation."));
    lines.push(t("As of ") + formatDate(todayISO()));
    conditionsByArea.forEach((g) => {
      lines.push("");
      lines.push(bodyArea(g.area).label.toUpperCase());
      g.items.forEach((c) => {
        lines.push("- " + c.name + "  (" + conditionStatus(c.status).label + ")");
        if (c.linked) lines.push("    Linked to: " + c.linked);
        if (c.symptoms) lines.push("    Symptoms: " + c.symptoms);
        if (c.impacts) lines.push("    What it stops me doing: " + c.impacts);
      });
    });
    return lines.join("\n");
  };
  const openCondExport = () => {
    setCondExportText(buildConditionText());
    setCondExportOpen(true);
  };
  const copyCondExport = () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(condExportText)
          .then(() => flash(t("Copied. Paste it into an email, a message or a form.")))
          .catch(() => flash(t("Could not copy. Select the text and copy it by hand.")));
      } else flash(t("Select the text above and copy it by hand."));
    } catch { flash(t("Select the text above and copy it by hand.")); }
  };

  const pickDocument = (claimId) => {
    pendingDocClaim.current = claimId || null;
    if (fileRef.current) { fileRef.current.value = ""; fileRef.current.click(); }
  };
  // Several files at once, handled one after another rather than all in
  // parallel. Reading four photographs simultaneously means four full-size
  // bitmaps in memory at the same time, which is how a web view gets killed on
  // an older phone. In sequence it is slower by a second and it does not fall
  // over.
  //
  // A failure on one file does not abandon the rest. Someone importing six
  // letters, one of which is a 20 MB PDF, should end up with five saved and
  // one clear message, not nothing.
  const onFileChosen = (e) => {
    const files = Array.prototype.slice.call(e.currentTarget.files || []);
    if (!files.length) return;
    const claimId = pendingDocClaim.current;
    const titleFor = (file, i) => {
      const typed = docTitle.trim();
      if (!typed) return (file.name || t("Document")).slice(0, 80);
      // A typed title across several files would give six identical names, so
      // number them.
      return (files.length > 1 ? typed + " " + (i + 1) : typed).slice(0, 80);
    };

    let saved = 0;
    const failures = [];

    const step = (i) => {
      if (i >= files.length) {
        setDocTitle("");
        if (saved && !failures.length) {
          flash(saved === 1 ? t("Document saved") : saved + t(" documents saved"));
        } else if (saved && failures.length) {
          flash(saved + t(" saved. ") + failures[0]);
        } else if (failures.length) {
          flash(failures[0]);
        }
        return;
      }
      const file = files[i];
      readDocument(file).then((out) => {
        const id = uid();
        const rec = {
          id, claimId,
          title: titleFor(file, i),
          addedAt: todayISO(),
          kind: out.kind,
          thumb: out.thumb,
          full: out.full
        };
        return docPut(rec).then(() => {
          saved += 1;
          setDocMeta((cur) => cur.concat([{
            id, claimId: rec.claimId, title: rec.title,
            addedAt: rec.addedAt, kind: rec.kind, thumb: rec.thumb
          }]));
        });
      }).catch((err) => {
        failures.push(err && err.message ? err.message : t("One file could not be saved."));
      }).then(() => step(i + 1));
    };
    step(0);
  };
  const openDocument = (id) => {
    docGet(id).then((rec) => { if (rec) setViewingDoc(rec); })
      .catch(() => flash(t("Could not open that document")));
  };
  const deleteDocument = (id) => {
    docDelete(id).then(() => {
      setDocMeta((cur) => cur.filter((d) => d.id !== id));
      setViewingDoc(null);
      flash(t("Document removed"));
    }).catch(() => flash(t("Could not remove that document")));
  };

  const openNewRedress = (claimId) => {
    setRdEditingId(null);
    setRdClaim(claimId || "");
    // Suggest the stage after the furthest probate milestone already recorded.
    // Someone can still choose any stage manually, but the common path advances
    // in order instead of sending them back to the start.
    const levels = probateLevels(province);
    const used = redress.filter((r) => r.claimId === claimId).map((r) => r.level === "eir" ? "provincial" : r.level);
    const furthest = used.reduce((max, id) => {
      const i = levels.findIndex((l) => l.id === id);
      return i > max ? i : max;
    }, -1);
    const nextIdx = Math.min(furthest + 1, levels.length - 1);
    setRdLevel(levels[nextIdx].id);
    setRdRequested(todayISO()); setRdHeard(""); setRdDecided("");
    setRdOutcome("waiting"); setRdRep(REPRESENTATIVES[0]); setRdNotes("");
    setRedressOpen(true);
  };
  const openEditRedress = (r) => {
    setRdEditingId(r.id);
    setRdClaim(r.claimId || "");
    setRdLevel(r.level === "eir" ? "provincial" : r.level);
    setRdRequested(r.dateRequested || todayISO());
    setRdHeard(r.dateHeard || "");
    setRdDecided(r.dateDecided || "");
    setRdOutcome(r.outcome || "waiting");
    setRdRep(r.representative || REPRESENTATIVES[0]);
    setRdNotes(r.notes || "");
    setRedressOpen(true);
  };
  const saveRedress = () => {
    const rec = {
      claimId: rdClaim || null, level: rdLevel,
      dateRequested: rdRequested, dateHeard: rdHeard, dateDecided: rdDecided,
      outcome: rdOutcome, representative: rdRep, notes: rdNotes.trim()
    };
    if (rdEditingId) {
      setRedress((cur) => cur.map((r) => r.id === rdEditingId ? { ...r, ...rec } : r));
      flash(t("Updated"));
    } else {
      setRedress((cur) => cur.concat([{ id: uid(), ...rec }]));
      flash(t(redressLevel(rdLevel, province).short) + t(" added"));
    }
    setRedressOpen(false);
  };
  const removeRedress = (id) => {
    setRedress((cur) => cur.filter((r) => r.id !== id));
    setRedressOpen(false);
    flash(t("Removed"));
  };

  const [helpOpen, setHelpOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryText, setSummaryText] = useState("");
  const [summaryWhole, setSummaryWhole] = useState(false);

  // A compact record for a lawyer, accountant, co-executor or institution.
  // Plain text so
  // it can go into an email, a message, or be read down the phone.
  const buildSummary = (c) => {
    const L = [];
    const rule = "----------------------------------------";
    // Dates vary in width, so pad them to a fixed column. This summary gets
    // handed to a professional or pasted into an email, and a ragged left
    // edge makes it look careless.
    const col = (iso) => (formatDate(iso) + "             ").slice(0, 14);
    L.push(t("STEP SUMMARY"));
    L.push(rule);
    L.push(t("Step: ") + c.condition);
    if (c.type) L.push(t("Category: ") + t(c.type));
    if (c.fileNumber) L.push(t("Reference number: ") + c.fileNumber);
    if (c.dateApplied) L.push(t("Started / filed: ") + formatDate(c.dateApplied) + t("  (elapsed ") + spanText(c.dateApplied) + ")");
    L.push(t("Where it stands: ") + t(stageLabel(c.stage)));
    L.push("");

    const hist = (c.history || []).filter((x) => x && x.stage && x.on);
    if (hist.length) {
      L.push(t("PROGRESS"));
      L.push(rule);
      hist.forEach((x) => L.push("  " + col(x.on) + stageLabel(x.stage)));
      L.push("");
    }

    const steps = redress.filter((r) => r.claimId === c.id)
      .slice().sort((a, b) => (a.dateRequested || "").localeCompare(b.dateRequested || ""));
    if (steps.length) {
      L.push(t("PROBATE PROGRESS"));
      L.push(rule);
      steps.forEach((r) => {
        L.push("  " + redressLevel(r.level, province).label);
        if (r.dateRequested) L.push(t("    Requested: ") + formatDate(r.dateRequested));
        if (r.dateHeard) L.push(t("    Heard: ") + formatDate(r.dateHeard));
        if (r.dateDecided) L.push(t("    Completed: ") + formatDate(r.dateDecided));
        L.push(t("    Outcome: ") + redressOutcome(r.outcome).label);
        if (r.representative) L.push(t("    Represented by: ") + r.representative);
        if (r.notes) L.push(t("    Notes: ") + r.notes);
        L.push("");
      });
    }

    const logs = contacts.filter((r) => r.claimId === c.id)
      .slice().sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    if (logs.length) {
      L.push(t("CONTACT LOG"));
      L.push(rule);
      logs.forEach((l) => {
        L.push("  " + col(l.date) + l.who);
        if (l.summary) L.push("      " + l.summary.replace(/\n/g, "\n      "));
      });
      L.push("");
    }

    const rems = reminders.filter((r) => r.claimId === c.id && !r.done)
      .slice().sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    if (rems.length) {
      L.push(t("STILL TO COME"));
      L.push(rule);
      rems.forEach((r) => L.push("  " + col(r.date) + r.label));
      L.push("");
    }

    STATEMENTS.forEach((sd) => {
      const text = (statements[c.id] || {})[sd.id];
      if (!text || !text.trim()) return;
      L.push(sd.label.toUpperCase());
      L.push(rule);
      text.trim().split(/\n/).forEach((line) => L.push("  " + line));
      L.push("");
    });

    const ev = evidence[c.id] || {};
    const currentEvidenceItems = evidenceItems(province);
    const have = currentEvidenceItems.filter((i) => ev[i.id]);
    const missing = currentEvidenceItems.filter((i) => !ev[i.id]);
    if (have.length || missing.length) {
      L.push(t("EVIDENCE"));
      L.push(rule);
      have.forEach((i) => L.push("  [x] " + i.label));
      missing.forEach((i) => L.push("  [ ] " + i.label));
      L.push("");
    }

    const docs = docMeta.filter((d) => d.claimId === c.id);
    if (docs.length) {
      L.push(t("DOCUMENTS HELD (on my phone, not attached)"));
      L.push(rule);
      docs.forEach((d) => L.push("  " + col(d.addedAt) + d.title));
      L.push("");
    }

    L.push(rule);
    L.push(t("Prepared from my own records on ") + formatDate(todayISO()) + ".");
    L.push(t("This is my personal record and may contain errors. The institutions' own records are authoritative."));
    return L.join("\n");
  };

  // ---- The whole file, on paper.
  //
  // buildSummary covers one step. A lawyer, accountant or co-executor may need
  // the whole estate record: every step, the inventory, unfinished dates and
  // every logged call including the ones not tied to a particular step.
  // Reconstructing that across seven tabs while somebody waits is
  // exactly the moment this app exists to prevent.
  //
  // Plain text, same as everything else here, because it has to survive being
  // pasted into an email, printed, or read down a phone. The print button
  // opens the system print sheet, which on an iPhone offers Save to Files as
  // a PDF; where printing is unavailable the copy button still works, so
  // there is no dead end.
  const buildWholeFile = () => {
    const rule = "----------------------------------------";
    const col = (iso) => (formatDate(iso) + "             ").slice(0, 14);
    const L = [];
    L.push(t("MY ESTATE FILE"));
    L.push(rule);
    L.push(t("Estate province / territory: ") + t(provinceDef(province).label));
    L.push(t("Prepared from my own records on ") + formatDate(todayISO()) + ".");
    L.push(t("This is my personal record and may contain errors. The institutions' own records are authoritative."));
    L.push("");
    L.push(t("Steps") + ": " + claims.length + "   " +
           t("Estate inventory") + ": " + conditions.length + "   " +
           t("Documents") + ": " + docMeta.length);
    L.push("");

    if (conditions.length) {
      L.push(t("THE ESTATE INVENTORY"));
      L.push(rule);
      conditionsByArea.forEach((g) => {
        L.push("  " + t(bodyArea(g.area).label).toUpperCase());
        g.items.forEach((c) => {
          L.push("    " + c.name + "  (" + t(conditionStatus(c.status).label) + ")");
          if (c.linked) L.push("      " + t("Held by: ") + c.linked);
          if (c.symptoms) L.push("      " + t("Where held: ") + c.symptoms);
          if (c.impacts) L.push("      " + t("Value at death: ") + c.impacts);
        });
      });
      L.push("");
    }

    const sorted = claims.slice().sort((a, b) => (a.dateApplied || "").localeCompare(b.dateApplied || ""));
    sorted.forEach((c, i) => {
      L.push("");
      L.push("=".repeat(40));
      L.push(t("Step") + " " + (i + 1) + " " + t(" of ").trim() + " " + sorted.length);
      L.push("=".repeat(40));
      L.push(buildSummary(c));
    });

    // Calls and dates that belong to no particular claim would otherwise
    // vanish from a whole-file print, which is precisely when they matter.
    const looseLogs = contacts.filter((r) => !r.claimId || !claimById(r.claimId))
      .slice().sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    if (looseLogs.length) {
      L.push("");
      L.push(t("CONTACT LOG") + " (" + t("Not tied to a step") + ")");
      L.push(rule);
      looseLogs.forEach((l) => {
        L.push("  " + col(l.date) + l.who);
        if (l.summary) L.push("      " + l.summary.replace(/\n/g, "\n      "));
      });
    }
    const looseRems = reminders.filter((r) => !r.done && (!r.claimId || !claimById(r.claimId)))
      .slice().sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    if (looseRems.length) {
      L.push("");
      L.push(t("STILL TO COME") + " (" + t("Not tied to a step") + ")");
      L.push(rule);
      looseRems.forEach((r) => L.push("  " + col(r.date) + r.label));
    }

    return L.join("\n");
  };

  const openWholeFile = () => { setSummaryText(buildWholeFile()); setSummaryWhole(true); setSummaryOpen(true); };

  // Printing happens in a detached window rather than by styling this one,
  // so nothing about the app's own layout can leak into the page. If the
  // browser refuses to open it, say so plainly and leave the copy button,
  // rather than failing silently.
  const printSummary = () => {
    try {
      const w = window.open("", "_blank");
      if (!w) { flash(t("Printing was blocked. Copy the text instead.")); return; }
      const esc = (s) => String(s)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      w.document.write(
        "<!DOCTYPE html><html lang=\"" + getLang() + "\"><head><meta charset=\"utf-8\">" +
        "<title>" + esc(t("MY ESTATE FILE")) + "</title>" +
        "<style>body{font:12px ui-monospace,Menlo,Consolas,monospace;margin:24px;white-space:pre-wrap;}" +
        "@page{margin:18mm;}</style></head><body>" + esc(summaryText) + "</body></html>"
      );
      w.document.close();
      w.focus();
      setTimeout(() => { try { w.print(); } catch {} }, 250);
    } catch {
      flash(t("Printing was blocked. Copy the text instead."));
    }
  };

  const openSummary = (c) => { setSummaryText(buildSummary(c)); setSummaryWhole(false); setSummaryOpen(true); };
  const copySummary = () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(summaryText)
          .then(() => flash(t("Summary copied")))
          .catch(() => flash(t("Could not copy. Select the text and copy it by hand.")));
      } else flash(t("Select the text above and copy it by hand."));
    } catch { flash(t("Select the text above and copy it by hand.")); }
  };

  const toggleEvidence = (claimId, itemId) => {
    setEvidence((cur) => {
      const forClaim = { ...(cur[claimId] || {}) };
      forClaim[itemId] = !forClaim[itemId];
      return { ...cur, [claimId]: forClaim };
    });
  };

  const [stmtOpen, setStmtOpen] = useState(false);
  const [stmtClaim, setStmtClaim] = useState(null);
  const [stmtKind, setStmtKind] = useState("impact");
  const [stmtText, setStmtText] = useState("");
  const [showPrompts, setShowPrompts] = useState(true);

  const getStatement = (claimId, kind) => ((statements[claimId] || {})[kind] || "");

  const openStatement = (claimId, kind) => {
    setStmtClaim(claimId);
    setStmtKind(kind);
    setStmtText(getStatement(claimId, kind));
    // Prompts start open on a blank page, where they are the point, and
    // closed once there is something written, where they are in the way.
    setShowPrompts(!getStatement(claimId, kind).trim());
    setStmtOpen(true);
  };

  // Written straight into state on every keystroke, which persists through the
  // normal save effect. Someone drafting this over several weeks should never
  // have to think about whether it was kept.
  const updateStatement = (text) => {
    setStmtText(text);
    if (!stmtClaim) return;
    setStatements((cur) => {
      const forClaim = { ...(cur[stmtClaim] || {}) };
      forClaim[stmtKind] = text;
      forClaim[stmtKind + t("Updated")] = todayISO();
      return { ...cur, [stmtClaim]: forClaim };
    });
  };

  const copyStatement = () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(stmtText)
          .then(() => flash(t("Copied")))
          .catch(() => flash(t("Could not copy. Select the text and copy it by hand.")));
      } else flash(t("Select the text above and copy it by hand."));
    } catch { flash(t("Select the text above and copy it by hand.")); }
  };

  const openBackup = () => {
    setBackupText(JSON.stringify({ province, claims, startChecklist, reminders, contacts, redress, evidence, statements, conditions }));
    setRestoreText("");
    setBackupOpen(true);
  };
  const copyBackup = () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(backupText)
          .then(() => flash(t("Backup copied. Paste it somewhere safe.")))
          .catch(() => flash(t("Could not copy. Select the text and copy it by hand.")));
      } else flash(t("Select the text above and copy it by hand."));
    } catch { flash(t("Select the text above and copy it by hand.")); }
  };
  // ---- The full backup, documents included.
  //
  // The paste-a-text backup covers everything typed, and the app has always
  // said plainly that it does not cover the photographed letters. That
  // honesty does not make the gap smaller: a lost phone still takes the
  // decision letters with it, and those are the hardest things to replace.
  //
  // This writes a real file the person can put in iCloud, email to themselves
  // or drop on a computer. It is one JSON file so that a restore cannot end
  // up with the record and the documents out of step.
  const [fullBackupBusy, setFullBackupBusy] = useState(false);

  const applyRecord = (data) => {
    if (data.province) setProvince(normaliseProvinceId(data.province));
    if (Array.isArray(data.claims)) setClaims(data.claims);
    if (data.startChecklist && typeof data.startChecklist === "object") setStartChecklist(data.startChecklist);
    if (Array.isArray(data.reminders)) setReminders(data.reminders);
    if (Array.isArray(data.contacts)) setContacts(data.contacts);
    if (Array.isArray(data.redress)) setRedress(data.redress);
    if (data.evidence && typeof data.evidence === "object") setEvidence(data.evidence);
    if (data.statements && typeof data.statements === "object") setStatements(data.statements);
    if (Array.isArray(data.conditions)) setConditions(data.conditions);
  };

  const downloadFullBackup = () => {
    setFullBackupBusy(true);
    docAllFull().then((docs) => {
      const payload = {
        format: "estate-file-backup",
        version: 1,
        savedAt: todayISO(),
        record: { province, claims, startChecklist, reminders, contacts, redress, evidence, statements, conditions },
        documents: docs
      };
      const json = JSON.stringify(payload);
      const blob = new Blob([json], { type: "application/json" });
      const filename = "estate-file-backup-" + todayISO() + ".json";
      // The App Store build exposes a tiny native share bridge. WKWebView does
      // not reliably honour the HTML download attribute for blob URLs, so on
      // iPhone/iPad hand the finished backup to iOS and let the user choose
      // Files, iCloud, Mail, AirDrop, etc. The web/PWA build keeps the normal
      // browser download path below.
      const nativeBackup = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.saveBackup;
      if (nativeBackup) {
        nativeBackup.postMessage({ filename, text: json });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        // Revoked on a delay rather than immediately: some browsers have not
        // finished with the URL by the time the click handler returns.
        setTimeout(() => { try { URL.revokeObjectURL(url); a.remove(); } catch {} }, 4000);
      }
      const mb = Math.round(blob.size / 104857.6) / 10;
      flash(t("Backup file made") + " (" + mb + " MB, " + docs.length + " " +
            t(docs.length === 1 ? t(" document") : t(" documents")).trim() + ")");
    }).catch(() => {
      flash(t("Could not build the backup file on this device."));
    }).then(() => setFullBackupBusy(false));
  };

  // Restoring replaces rather than merges. Merging two records of the same
  // claims would leave duplicates that somebody would then have to unpick by
  // hand, which is worse than being told plainly what is about to happen.
  const restoreFromFile = (file) => {
    if (!file) return;
    setFullBackupBusy(true);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        const rec = data.record || data;
        if (!rec || (!Array.isArray(rec.claims) && !Array.isArray(rec.conditions))) {
          flash(t("That does not look like an Estate File backup."));
          setFullBackupBusy(false);
          return;
        }
        applyRecord(rec);
        const docs = Array.isArray(data.documents) ? data.documents : [];
        if (!docs.length) {
          setDocMeta([]);
          setBackupOpen(false);
          setFullBackupBusy(false);
          flash(t("Restored."));
          return;
        }
        // Written one at a time so a single unreadable document cannot take
        // the whole restore down with it.
        let done = 0;
        const next = (i) => {
          if (i >= docs.length) {
            docAllMeta().then(setDocMeta).catch(() => {});
            setBackupOpen(false);
            setFullBackupBusy(false);
            flash(t("Restored.") + " " + done + " " +
                  t(done === 1 ? t(" document") : t(" documents")).trim() + ".");
            return;
          }
          docPut(docs[i]).then(() => { done += 1; }).catch(() => {}).then(() => next(i + 1));
        };
        next(0);
      } catch {
        flash(t("That does not look like an Estate File backup."));
        setFullBackupBusy(false);
      }
    };
    reader.onerror = () => {
      flash(t("Could not read that file."));
      setFullBackupBusy(false);
    };
    reader.readAsText(file);
  };

  const runRestore = () => {
    try {
      const data = JSON.parse(restoreText);
      if (data.province) setProvince(normaliseProvinceId(data.province));
      if (Array.isArray(data.claims)) setClaims(data.claims);
      if (Array.isArray(data.reminders)) setReminders(data.reminders);
      if (Array.isArray(data.contacts)) setContacts(data.contacts);
      if (Array.isArray(data.redress)) setRedress(data.redress);
      if (data.evidence && typeof data.evidence === "object") setEvidence(data.evidence);
      if (data.statements && typeof data.statements === "object") setStatements(data.statements);
      if (Array.isArray(data.conditions)) setConditions(data.conditions);
      setBackupOpen(false);
      flash(t("Restored. Documents are not in the backup."));
    } catch { flash(t("That does not look like an Estate File backup.")); }
  };

  // ---- One line of time.
  //
  // The story of a claim is currently spread across the claim card, the
  // contact log, the reminders and the appeals list, ordered by whichever
  // screen you happen to be on. The two questions that keep coming up -
  // "how long has this been going on" and "what happened, in order" - are
  // exactly the ones that arrangement cannot answer.
  //
  // Everything with a date, on one line, newest first. Nothing here is new
  // information; it is the same record read along a different axis.

  const timeline = useMemo(() => {
    const rows = [];
    const nameOf = (id) => { const c = claims.find((x) => x.id === id); return c ? c.condition : null; };

    claims.forEach((c) => {
      if (c.dateApplied) rows.push({ kind: "applied", date: c.dateApplied, claimId: c.id, title: c.condition, detail: t(c.type || "") });
      (c.history || []).forEach((x) => {
        if (x && x.on && x.stage) rows.push({ kind: "stage", date: x.on, claimId: c.id, title: t(stageLabel(x.stage)), detail: c.condition });
      });
    });
    contacts.forEach((r) => {
      if (r.date) rows.push({ kind: "contact", date: r.date, claimId: r.claimId, title: r.who, detail: r.summary || "" });
    });
    redress.forEach((r) => {
      if (r.dateRequested) rows.push({ kind: "redress", date: r.dateRequested, claimId: r.claimId, title: t(redressLevel(r.level, province).label), detail: t("Date started or filed") });
      if (r.dateHeard) rows.push({ kind: "redress", date: r.dateHeard, claimId: r.claimId, title: t(redressLevel(r.level, province).label), detail: t("Date received or issued") });
      if (r.dateDecided) rows.push({ kind: "outcome", date: r.dateDecided, claimId: r.claimId, title: t(redressOutcome(r.outcome).label), detail: t(redressLevel(r.level, province).label) });
    });
    reminders.forEach((r) => {
      if (r.date) rows.push({ kind: "reminder", date: r.date, claimId: r.claimId, title: r.label, detail: r.done ? t("Done") : "", done: r.done });
    });
    docMeta.forEach((d) => {
      if (d.addedAt) rows.push({ kind: "document", date: d.addedAt, claimId: d.claimId, title: d.title, detail: "" });
    });

    return rows
      .map((r) => ({ ...r, claimName: r.claimId ? nameOf(r.claimId) : null }))
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [claims, contacts, redress, reminders, docMeta, lang, province]);

  const sortedClaims = useMemo(() => claims.slice().sort((a, b) => {
    const da = a.dateApplied || "", db = b.dateApplied || "";
    return db.localeCompare(da);
  }), [claims]);

  const upcoming = useMemo(() => reminders.slice().sort((a, b) => (a.date || "").localeCompare(b.date || "")), [reminders]);
  const dueCount = useMemo(() => reminders.filter((r) => !r.done && daysBetween(todayISO(), r.date) <= 0).length, [reminders]);

  // ---------- pieces ----------

  // A PDF has no picture to show, so it gets a drawn tile instead of a broken
  // image. Documents saved before this version have no kind recorded and are
  // all photographs, hence the fallback.
  const DocThumb = ({ doc }) => {
    if (doc.kind === "pdf" || !doc.thumb) {
      return h("div", {
        style: {
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          width: "100%", height: 86, background: T.blueSoft, borderBottom: "1px solid " + T.line
        }
      },
        h("div", { style: { fontFamily: font.body, fontSize: fs(11), fontWeight: 900, color: T.blue, letterSpacing: 0.5 } }, "PDF"),
        h("div", { style: { fontSize: fs(9), color: T.inkSoft, marginTop: 2 } }, t("tap to open"))
      );
    }
    return h("img", { src: doc.thumb, alt: doc.title, style: { display: "block", width: "100%", height: 86, objectFit: "cover" } });
  };

  const StageTrack = ({ claim }) => {
    const idx = stageIndex(claim.stage);
    return h("div", { style: { display: "flex", gap: 3, marginTop: 9 } },
      STAGES.map((s, i) => h("div", {
        key: s.id,
        title: t(s.label),
        style: {
          flex: 1, height: 5, borderRadius: 3,
          background: i <= idx ? (claim.stage === "done" ? T.green : T.gold) : T.line
        }
      }))
    );
  };

  const ClaimCard = (c) => {
    const docs = docMeta.filter((d) => d.claimId === c.id).length;
    const rem = reminders.filter((r) => r.claimId === c.id && !r.done).length;
    return h("button", {
      key: c.id,
      onClick: () => setOpenClaim(c.id),
      style: {
        display: "block", width: "100%", textAlign: "left", cursor: "pointer",
        background: T.card, border: "1px solid " + T.line, borderRadius: 12,
        padding: "13px 14px", marginBottom: 9
      }
    },
      h("div", { style: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" } },
        h("div", { style: { fontFamily: font.display, fontSize: fs(16.5), color: T.heading, lineHeight: 1.2, minWidth: 0 } }, c.condition),
        h("div", {
          style: {
            flex: "0 0 auto", fontFamily: font.body, fontSize: fs(10), fontWeight: 800,
            color: c.stage === "done" ? T.green : T.gold,
            background: c.stage === "done" ? "#EAF2ED" : T.goldSoft,
            borderRadius: 999, padding: "3px 9px"
          }
        }, t(stageLabel(c.stage)))
      ),
      h("div", { style: { fontFamily: font.body, fontSize: fs(11.5), color: T.inkSoft, marginTop: 4 } },
        t(c.type || ""),
        c.fileNumber ? "  ·  " + c.fileNumber : ""
      ),
      h(StageTrack, { claim: c }),
      h("div", { style: { fontFamily: font.body, fontSize: fs(11.5), color: T.ink, marginTop: 8 } },
        c.dateApplied
          ? h("span", null, t("Elapsed "), h("b", null, spanText(c.dateApplied)), t(" · started "), formatDate(c.dateApplied))
          : h("span", { style: { color: T.inkSoft } }, t("No start date set"))
      ),
      (docs || rem) ? h("div", { style: { fontFamily: font.body, fontSize: fs(10.5), color: T.inkSoft, marginTop: 4 } },
        [docs ? docs + (docs === 1 ? t(" document") : t(" documents")) : null,
         rem ? rem + (rem === 1 ? t(" reminder") : t(" reminders")) : null].filter(Boolean).join(" · ")
      ) : null
    );
  };

  // ---------- screens ----------

  // Search lives at the top of the landing screen rather than in the header.
  // The header is already carrying the wordmark, the language toggle and
  // Help, and Help must stay the loudest thing in it; adding a fourth control
  // there was what made the wordmark wrap in the first place. Claims is where
  // someone arrives and where "my own stuff" begins, so the search for their
  // own stuff belongs at the top of it. It is drawn as a field rather than a
  // button because that is what it behaves like.
  const searchBar = () => h("button", {
    onClick: () => { setSearchQ(""); setSearchOpen(true); },
    style: {
      width: "100%", display: "flex", alignItems: "center", gap: 8,
      padding: "10px 12px", marginBottom: 10, cursor: "pointer",
      borderRadius: 10, border: "1px solid " + T.line, background: T.card,
      color: T.inkSoft, fontFamily: font.body, fontSize: fs(12.5), textAlign: "left"
    }
  },
    h("span", { "aria-hidden": "true", style: { fontSize: fs(13) } }, "\u2315"),
    h("span", null, t("Search your file"))
  );

  const timelineBar = () => h("button", {
    onClick: () => setTimelineOpen(true),
    style: {
      width: "100%", display: "flex", alignItems: "center", gap: 8,
      padding: "10px 12px", marginBottom: 10, cursor: "pointer",
      borderRadius: 10, border: "1px solid " + T.line, background: T.card,
      color: T.inkSoft, fontFamily: font.body, fontSize: fs(12.5), textAlign: "left"
    }
  },
    h("span", { "aria-hidden": "true", style: { fontSize: fs(13) } }, "\u21f5"),
    h("span", null, t("One line of time"))
  );

  const claimsScreen = () => h("div", { style: { padding: 16 } },
    (claims.length || conditions.length || contacts.length || reminders.length) ? searchBar() : null,
    timeline.length ? timelineBar() : null,
    h("button", {
      onClick: openNewClaim,
      style: {
        width: "100%", padding: "13px", borderRadius: 10, border: "none",
        background: T.primary, color: "#fff", fontFamily: font.body,
        fontWeight: 800, fontSize: fs(13.5), cursor: "pointer", marginBottom: 8
      }
    }, t("Add a step")),
    h("button", {
      onClick: () => setGuideOpen(true),
      style: {
        width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid " + T.line,
        background: T.card, color: T.ink, fontFamily: font.body, fontSize: fs(12), cursor: "pointer",
        textAlign: "left", lineHeight: 1.5, marginBottom: 14
      }
    },
      h("b", null, t("Not sure where to start?")),
      t(" Start with the time-sensitive calls and documents, then add each estate task as you encounter it. The first two weeks \u203a")),
    sortedClaims.length === 0
      ? h("div", { style: { padding: "12px 14px", borderRadius: 12, border: "1px solid " + T.line, background: T.card } },
          h("div", { style: { fontFamily: font.display, fontSize: fs(17), color: T.heading, marginBottom: 4 } }, t("Start with one step")),
          h("div", { style: { fontFamily: font.body, fontSize: fs(12), color: T.inkSoft, lineHeight: 1.5 } },
            t("Add the first thing you have to do \u2014 cancelling CPP, ringing the bank, telling the CRA. From there you can keep the letters, log every call, and see at a glance how long each one has been sitting."))
        )
      : sortedClaims.map(ClaimCard)
  );

  const claimDetail = () => {
    const c = current;
    if (!c) return null;
    const docs = docMeta.filter((d) => d.claimId === c.id);
    const rems = reminders.filter((r) => r.claimId === c.id);
    const logs = contacts.filter((r) => r.claimId === c.id).slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    const idx = stageIndex(c.stage);

    return h("div", { style: { padding: 16 } },
      h("button", {
        onClick: () => setOpenClaim(null),
        style: { border: "none", background: "transparent", padding: "0 0 10px", color: T.gold, fontFamily: font.body, fontWeight: 800, fontSize: fs(12.5), cursor: "pointer" }
      }, t("\u2039 All steps")),

      h("div", { style: { fontFamily: font.display, fontSize: fs(23), color: T.heading, lineHeight: 1.15 } }, c.condition),
      h("div", { style: { fontFamily: font.body, fontSize: fs(12), color: T.inkSoft, marginTop: 3 } },
        t(c.type || ""), c.fileNumber ? "  ·  " + c.fileNumber : ""),
      c.dateApplied ? h("div", { style: { fontFamily: font.body, fontSize: fs(12.5), color: T.ink, marginTop: 6 } },
        t("Started "), formatDate(c.dateApplied), t(". Elapsed "), h("b", null, spanText(c.dateApplied)), ".") : null,

      h("div", { style: { marginTop: 16, marginBottom: 6, fontFamily: font.display, fontSize: fs(17), color: T.heading } }, t("Where it stands")),
      h("div", { style: { fontSize: fs(11), color: T.inkSoft, marginBottom: 9, lineHeight: 1.45 } },
        t("Your own record of where this has got to. Nobody else updates it.")),
      h("div", { style: { background: T.card, border: "1px solid " + T.line, borderRadius: 10, overflow: "hidden" } },
        STAGES.map((s, i) => {
          const done = i < idx, here = i === idx;
          return h("button", {
            key: s.id,
            onClick: () => setStage(c.id, s.id),
            style: {
              display: "flex", gap: 10, width: "100%", textAlign: "left", cursor: "pointer",
              alignItems: "flex-start", padding: "10px 12px", background: here ? T.goldSoft : "transparent",
              border: "none", borderTop: i === 0 ? "none" : "1px solid " + T.line
            }
          },
            h("span", {
              "aria-hidden": "true",
              style: {
                width: 17, height: 17, borderRadius: 999, flex: "0 0 auto", marginTop: 1,
                border: "1.5px solid " + (done || here ? T.gold : T.line),
                background: done ? T.gold : "#fff",
                color: "#fff", fontSize: fs(10), fontWeight: 900, lineHeight: "15px", textAlign: "center"
              }
            }, done ? "\u2713" : ""),
            h("span", { style: { minWidth: 0 } },
              h("span", { style: { display: "block", fontFamily: font.body, fontSize: fs(13), fontWeight: here ? 800 : 600, color: T.ink } }, t(s.label)),
              h("span", { style: { display: "block", fontFamily: font.body, fontSize: fs(10.5), color: T.inkSoft, marginTop: 2, lineHeight: 1.4 } }, t(s.blurb))
            )
          );
        })
      ),

      c.notes ? h("div", { style: { marginTop: 16 } },
        h("div", { style: { fontFamily: font.display, fontSize: fs(17), color: T.heading, marginBottom: 6 } }, t("Notes")),
        h("div", { style: { background: T.card, border: "1px solid " + T.line, borderRadius: 10, padding: "11px 13px", fontSize: fs(12.5), color: T.ink, lineHeight: 1.55, whiteSpace: "pre-wrap" } }, c.notes)
      ) : null,

      h("div", { style: { marginTop: 18, display: "flex", justifyContent: "space-between", alignItems: "baseline" } },
        h("div", { style: { fontFamily: font.display, fontSize: fs(17), color: T.heading } }, t("Documents")),
        h("button", {
          onClick: () => pickDocument(c.id),
          style: { border: "1px solid " + T.blue, borderRadius: 8, background: T.blueSoft, color: T.blue, fontSize: fs(11), fontWeight: 800, padding: "5px 10px", cursor: "pointer" }
        }, t("Add"))
      ),
      docs.length === 0
        ? h("div", { style: { fontSize: fs(11.5), color: T.inkSoft, marginTop: 6, lineHeight: 1.45 } },
            t("Statements of death, the will, certificates, letters. Photograph them or import PDFs. Several at once is fine. They stay on this phone."))
        : h("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 8 } },
            docs.map((d) => h("button", {
              key: d.id,
              onClick: () => openDocument(d.id),
              style: { padding: 0, border: "1px solid " + T.line, borderRadius: 9, overflow: "hidden", background: T.card, cursor: "pointer" }
            },
              h(DocThumb, { doc: d }),
              h("div", { style: { fontSize: fs(9.5), color: T.inkSoft, padding: "4px 5px", lineHeight: 1.3, overflowWrap: "anywhere" } }, d.title)
            ))
          ),

      h("div", { style: { marginTop: 18, display: "flex", justifyContent: "space-between", alignItems: "baseline" } },
        h("div", { style: { fontFamily: font.display, fontSize: fs(17), color: T.heading } }, t("Contact log")),
        h("button", {
          onClick: () => { setLogClaim(c.id); setLogWho(""); setLogDate(todayISO()); setLogSummary(""); setLogOpen(true); },
          style: { border: "1px solid " + T.blue, borderRadius: 8, background: T.blueSoft, color: T.blue, fontSize: fs(11), fontWeight: 800, padding: "5px 10px", cursor: "pointer" }
        }, t("Add"))
      ),
      h("div", { style: { fontSize: fs(11), color: T.inkSoft, marginTop: 4, marginBottom: 7, lineHeight: 1.45 } },
        t("Who you spoke to and what was said. Worth keeping for every call.")),
      logs.length === 0
        ? h("div", { style: { fontSize: fs(11.5), color: T.inkSoft } }, t("Nothing logged yet."))
        : h("div", { style: { background: T.card, border: "1px solid " + T.line, borderRadius: 10, overflow: "hidden" } },
            logs.map((l, i) => h("div", {
              key: l.id,
              style: { padding: "10px 12px", borderTop: i === 0 ? "none" : "1px solid " + T.line }
            },
              h("div", { style: { display: "flex", justifyContent: "space-between", gap: 8 } },
                h("span", { style: { fontFamily: font.body, fontSize: fs(12.5), fontWeight: 700, color: T.ink } }, l.who),
                h("button", {
                  onClick: () => removeContact(l.id),
                  style: { border: "none", background: "transparent", color: T.inkSoft, fontSize: fs(11), cursor: "pointer", padding: 0 }
                }, "\u2715")
              ),
              h("div", { style: { fontSize: fs(10.5), color: T.inkSoft, marginTop: 2 } }, formatDate(l.date)),
              l.summary ? h("div", { style: { fontSize: fs(12), color: T.ink, marginTop: 4, lineHeight: 1.5, whiteSpace: "pre-wrap" } }, l.summary) : null
            ))
          ),

      rems.length ? h("div", { style: { marginTop: 18 } },
        h("div", { style: { fontFamily: font.display, fontSize: fs(17), color: T.heading, marginBottom: 7 } }, t("Reminders")),
        h("div", { style: { background: T.card, border: "1px solid " + T.line, borderRadius: 10, overflow: "hidden" } },
          rems.map((r, i) => h("div", { key: r.id, style: { padding: "9px 12px", borderTop: i === 0 ? "none" : "1px solid " + T.line, fontSize: fs(12.5), color: r.done ? T.inkSoft : T.ink } },
            r.label, h("span", { style: { color: T.inkSoft, fontSize: fs(10.5) } }, "  ", formatDate(r.date))))
        )
      ) : null,

      h("div", { style: { marginTop: 20, fontFamily: font.display, fontSize: fs(17), color: T.heading } }, t("In your own words")),
      h("div", { style: { fontSize: fs(11), color: T.inkSoft, marginTop: 4, marginBottom: 8, lineHeight: 1.45 } },
        t("The questions you meant to ask, and a plain account of how it has gone. Written down here, they are ready for the next call or the next meeting.")),
      h("div", { style: { background: T.card, border: "1px solid " + T.line, borderRadius: 10, overflow: "hidden" } },
        STATEMENTS.map((sd, i) => {
          const text = getStatement(c.id, sd.id);
          const words = wordCount(text);
          return h("button", {
            key: sd.id,
            onClick: () => openStatement(c.id, sd.id),
            style: {
              display: "block", width: "100%", textAlign: "left", cursor: "pointer",
              padding: "11px 13px", background: "transparent", border: "none",
              borderTop: i === 0 ? "none" : "1px solid " + T.line
            }
          },
            h("div", { style: { display: "flex", justifyContent: "space-between", gap: 9, alignItems: "baseline" } },
              h("span", { style: { fontFamily: font.body, fontSize: fs(13), fontWeight: 800, color: T.ink } }, sd.label),
              h("span", { style: { flex: "0 0 auto", fontSize: fs(10.5), color: words ? T.green : T.gold, fontWeight: 700 } },
                words ? words + (words === 1 ? t(" word") : t(" words")) : t("Not started"))
            ),
            h("div", { style: { fontSize: fs(11), color: T.inkSoft, marginTop: 3, lineHeight: 1.45 } },
              words
                ? (text.trim().replace(/\s+/g, " ").slice(0, 90) + (text.trim().length > 90 ? "..." : ""))
                : t(sd.lead))
          );
        })
      ),

      h("div", { style: { marginTop: 18, display: "flex", justifyContent: "space-between", alignItems: "baseline" } },
        h("div", { style: { fontFamily: font.display, fontSize: fs(17), color: T.heading } }, t("Evidence")),
        h("div", { style: { fontSize: fs(10.5), color: T.inkSoft } },
          evidenceItems(province).filter((i) => (evidence[c.id] || {})[i.id]).length + t(" of ") + evidenceItems(province).length)
      ),
      h("div", { style: { fontSize: fs(11), color: T.inkSoft, marginTop: 4, marginBottom: 8, lineHeight: 1.45 } },
        t("What institutions actually ask for. Not every estate needs every one, and a lawyer will tell you which yours does.")),
      h("div", { style: { background: T.card, border: "1px solid " + T.line, borderRadius: 10, overflow: "hidden" } },
        evidenceItems(province).map((item, i) => {
          const on = !!(evidence[c.id] || {})[item.id];
          return h("button", {
            key: item.id,
            onClick: () => toggleEvidence(c.id, item.id),
            style: {
              display: "flex", gap: 10, width: "100%", textAlign: "left", cursor: "pointer",
              alignItems: "flex-start", padding: "10px 12px", background: "transparent",
              border: "none", borderTop: i === 0 ? "none" : "1px solid " + T.line
            }
          },
            h("span", {
              "aria-hidden": "true",
              style: {
                width: fs(18), height: fs(18), borderRadius: 5, flex: "0 0 auto", marginTop: 1,
                border: "1.5px solid " + (on ? T.green : T.line), background: on ? T.green : "#fff",
                color: "#fff", fontSize: fs(11), fontWeight: 900, lineHeight: fs(15) + "px", textAlign: "center"
              }
            }, on ? "\u2713" : ""),
            h("span", { style: { minWidth: 0 } },
              h("span", { style: { display: "block", fontFamily: font.body, fontSize: fs(12.5), color: on ? T.inkSoft : T.ink, fontWeight: 600 } }, t(item.label)),
              h("span", { style: { display: "block", fontFamily: font.body, fontSize: fs(10.5), color: T.inkSoft, marginTop: 2, lineHeight: 1.4 } }, t(item.note))
            )
          );
        })
      ),

      (c.type === "Probate" || redress.some((r) => r.claimId === c.id)) ? redressSection(c) : null,

      h("button", {
        onClick: () => openSummary(c),
        style: { width: "100%", marginTop: 20, padding: "13px", borderRadius: 10, border: "none", background: T.primary, color: "#fff", fontFamily: font.body, fontWeight: 800, fontSize: fs(13), cursor: "pointer" }
      }, t("Make a summary of this step")),
      h("div", { style: { fontSize: fs(10.5), color: T.inkSoft, marginTop: 5, lineHeight: 1.45, textAlign: "center" } },
        t("Everything recorded on this step, in plain text for a lawyer, accountant, co-executor or institution.")),

      h("button", {
        onClick: () => openEditClaim(c),
        style: { width: "100%", marginTop: 20, padding: "12px", borderRadius: 10, border: "1px solid " + T.line, background: T.btn2, color: T.ink, fontFamily: font.body, fontWeight: 700, fontSize: fs(12.5), cursor: "pointer" }
      }, t("Edit this step"))
    );
  };

  // Redress only appears once a decision has landed, because until then there
  // is nothing to disagree with and the section would just be clutter.
  const redressSection = (c) => {
    const steps = redress.filter((r) => r.claimId === c.id)
      .slice().sort((a, b) => (a.dateRequested || "").localeCompare(b.dateRequested || ""));
    const toneColour = { amber: T.amber, green: T.green, red: T.red, grey: T.inkSoft };

    return h("div", { style: { marginTop: 20 } },
      h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline" } },
        h("div", { style: { fontFamily: font.display, fontSize: fs(17), color: T.heading } }, t(province === "QC" ? "Succession" : "Probate")),
        h("button", {
          onClick: () => openNewRedress(c.id),
          style: { border: "1px solid " + T.blue, borderRadius: 8, background: T.blueSoft, color: T.blue, fontSize: fs(11), fontWeight: 800, padding: "5px 10px", cursor: "pointer" }
        }, t("Add"))
      ),

      steps.length === 0
        ? h("div", { style: { marginTop: 7 } },
            h("div", { style: { fontSize: fs(11.5), color: T.inkSoft, lineHeight: 1.5, marginBottom: 9 } },
              t("If this estate needs a court grant, you can track the main milestones here. The sequence changes with the estate province or territory selected in Settings.")),
            h("div", { style: { background: T.card, border: "1px solid " + T.line, borderRadius: 10, overflow: "hidden" } },
              probateLevels(province).map((l, i) => h("div", {
                key: l.id,
                style: { padding: "9px 12px", borderTop: i === 0 ? "none" : "1px solid " + T.line }
              },
                h("div", { style: { fontFamily: font.body, fontSize: fs(12.5), fontWeight: 700, color: T.ink } }, (i + 1) + ". " + l.label),
                h("div", { style: { fontSize: fs(10.5), color: T.inkSoft, marginTop: 2, lineHeight: 1.45 } }, t(l.blurb))
              ))
            ),
            h("div", { style: { background: T.goldSoft, border: "1px solid " + T.gold, borderRadius: 10, padding: "11px 13px", fontSize: fs(11.5), color: T.ink, lineHeight: 1.5, marginTop: 9 } },
              t("Probate and succession procedures differ by province or territory. Record the actual dates from your court, notary and government paperwork."),
              h("div", { style: { marginTop: 6, color: T.inkSoft } },
                province === "ON" ? t("Ontario's Estate Information Return is generally due within 180 calendar days after the estate certificate is issued.") :
                province === "BC" ? t("B.C. normally requires the P1 notice and a wait of at least 21 days before the grant application is made.") :
                province === "AB" ? t("Alberta non-contentious grants can use the Surrogate Digital Service or paper GA forms; the route depends on the application.") :
                province === "SK" ? t("Saskatchewan standard grant applications use a $200 Local Registrar filing fee plus a $7-per-$1,000-or-part probate levy; special small-estate procedures can differ.") :
                province === "MB" ? t("Manitoba eliminated charges for probate and administration applications in 2020; Rule 74 forms still govern the court application.") :
                province === "NS" ? t("Nova Scotia requires Form 29 inventory within 3 months after the grant and uses a six-month Royal Gazette estate-notice period.") :
                province === "NB" ? t("New Brunswick uses province-specific Probate Court forms, with a 7-day minimum before probate/administration with will annexed can be granted and 14 days for intestate administration.") :
                province === "NL" ? t("Newfoundland and Labrador starts with a Notice of Application and 5-day notice period, then uses Rule 56 petition and inventory materials.") :
                province === "PE" ? t("Prince Edward Island uses Rule 65 petitions and inventory requirements, followed by Gazette estate-notice and beneficiary-notice work after the grant.") :
                province === "YT" ? t("Yukon Rule 64 requires a 21-day notice period before a grant will issue and contains special First Nation / Indian Act estate checks where applicable.") :
                province === "NT" ? t("The NWT uses fixed court-fee bands and has a separate Rule 10 small-estate declaration route where net value reasonably appears to be less than $35,000.") :
                province === "NU" ? t("Nunavut uses the Nunavut Court of Justice Probate and Administration Rules and fixed court-fee bands based on net Nunavut property.") :
                t("Quebec uses a mandatory will search, liquidator designation, inventory and RDPRM notices. A notarial will does not need probate; non-notarial wills must be verified.")))
          )
        : h("div", { style: { marginTop: 8 } },
            steps.map((r) => {
              const lvl = redressLevel(r.level, province);
              const out = redressOutcome(r.outcome);
              const waiting = r.outcome === "waiting";
              return h("button", {
                key: r.id,
                onClick: () => openEditRedress(r),
                style: {
                  display: "block", width: "100%", textAlign: "left", cursor: "pointer",
                  background: T.card, border: "1px solid " + T.line, borderRadius: 10,
                  padding: "11px 13px", marginBottom: 8
                }
              },
                h("div", { style: { display: "flex", justifyContent: "space-between", gap: 9, alignItems: "baseline" } },
                  h("div", { style: { fontFamily: font.body, fontSize: fs(13), fontWeight: 800, color: T.ink } }, t(lvl.label)),
                  h("div", { style: { flex: "0 0 auto", fontSize: fs(10), fontWeight: 800, color: toneColour[out.tone], background: out.tone === "green" ? "#EAF2ED" : (out.tone === "red" ? "#FBEBE8" : (out.tone === "amber" ? T.goldSoft : "#F1F0EC")), borderRadius: 999, padding: "3px 9px" } }, out.label)
                ),
                h("div", { style: { fontSize: fs(11), color: T.inkSoft, marginTop: 4, lineHeight: 1.5 } },
                  r.dateRequested ? t("Requested ") + formatDate(r.dateRequested) : "",
                  r.dateHeard ? t("  ·  heard ") + formatDate(r.dateHeard) : "",
                  r.dateDecided ? t("  ·  completed ") + formatDate(r.dateDecided) : ""),
                waiting && r.dateRequested
                  ? h("div", { style: { fontSize: fs(11.5), color: T.ink, marginTop: 3 } }, t("Waiting "), h("b", null, spanText(r.dateRequested)))
                  : null,
                r.representative ? h("div", { style: { fontSize: fs(10.5), color: T.inkSoft, marginTop: 3 } }, r.representative) : null
              );
            })
          )
    );
  };

  const redressSheet = () => sheet(() => setRedressOpen(false), [
    h("div", { key: "t", style: { fontFamily: font.display, fontSize: fs(20), color: T.heading, marginBottom: 3 } },
      rdEditingId ? t("Edit this step") : t(province === "QC" ? "Add a succession step" : "Add a probate step")),
    h("div", { key: "b", style: { fontSize: fs(11.5), color: T.inkSoft, marginBottom: 12, lineHeight: 1.45 } },
      t(province === "QC" ? "Your own record of the succession process. Nothing entered here is submitted to a court, notary, Revenu Québec, the CRA or any other authority." : "Your own record of the probate process. Nothing entered here is submitted to a court, provincial or territorial authority, or the CRA.")),
    h(Field, { key: "lv", label: t("Which stage"), hint: redressLevel(rdLevel, province).blurb },
      h("select", { value: rdLevel, onChange: (e) => setRdLevel(e.currentTarget.value), style: { ...inputStyle(), width: "100%" } },
        probateLevels(province).map((l) => h("option", { key: l.id, value: l.id }, t(l.label))))),
    h(Field, { key: "cl", label: t("Step") },
      h("select", { value: rdClaim, onChange: (e) => setRdClaim(e.currentTarget.value), style: { ...inputStyle(), width: "100%" } },
        [h("option", { key: "none", value: "" }, t("Not tied to a step"))].concat(
          claims.map((c) => h("option", { key: c.id, value: c.id }, c.condition))))),
    h(Field, { key: "rq", label: t("Date started or filed") },
      h("input", { type: "date", value: rdRequested, onInput: (e) => setRdRequested(e.currentTarget.value), style: { ...inputStyle(), width: "100%" } })),
    h(Field, { key: "hd", label: t("Date received or issued"), hint: t(province === "QC" ? "Leave blank if this succession stage does not produce a dated response, registration or certificate." : "Leave blank if this probate stage does not produce a dated response or certificate.") },
      h("input", { type: "date", value: rdHeard, onInput: (e) => setRdHeard(e.currentTarget.value), style: { ...inputStyle(), width: "100%" } })),
    h(Field, { key: "dc", label: t("Date completed"), hint: t("Leave blank while this stage is still outstanding.") },
      h("input", { type: "date", value: rdDecided, onInput: (e) => setRdDecided(e.currentTarget.value), style: { ...inputStyle(), width: "100%" } })),
    h(Field, { key: "oc", label: t("Outcome") },
      h("select", { value: rdOutcome, onChange: (e) => setRdOutcome(e.currentTarget.value), style: { ...inputStyle(), width: "100%" } },
        REDRESS_OUTCOMES.map((o) => h("option", { key: o.id, value: o.id }, t(o.label))))),
    h(Field, { key: "rp", label: t("Who is handling this"), hint: t("Record the person or professional responsible for this part of the process.") },
      h("select", { value: rdRep, onChange: (e) => setRdRep(e.currentTarget.value), style: { ...inputStyle(), width: "100%" } },
        REPRESENTATIVES.map((r) => h("option", { key: r, value: r }, r)))),
    h(Field, { key: "nt", label: t("Notes") },
      h("textarea", { value: rdNotes, onInput: (e) => setRdNotes(e.currentTarget.value), rows: 4, placeholder: t("What was filed, what came back, what you were told, and what is still needed"), style: { ...inputStyle(), width: "100%", resize: "vertical", lineHeight: 1.5 } })),
    h("div", { key: "a", style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 6 } },
      h("button", { onClick: () => setRedressOpen(false), style: { padding: "13px", borderRadius: 10, border: "1px solid " + T.line, background: T.btn2, fontFamily: font.body, fontSize: fs(13), fontWeight: 700, cursor: "pointer" } }, t("Cancel")),
      h("button", {
        onClick: saveRedress,
        style: { padding: "13px", borderRadius: 10, border: "none", fontFamily: font.body, fontSize: fs(13), fontWeight: 800, cursor: "pointer", background: T.primary, color: "#fff" }
      }, rdEditingId ? t("Save changes") : t("Add"))),
    rdEditingId ? h("button", {
      key: "d", onClick: () => removeRedress(rdEditingId),
      style: { width: "100%", marginTop: 10, padding: "12px", borderRadius: 10, border: "1px solid " + T.red, background: T.btn2, color: T.red, fontFamily: font.body, fontSize: fs(12.5), fontWeight: 700, cursor: "pointer" }
    }, t("Remove this step")) : null
  ]);

  const remindersScreen = () => h("div", { style: { padding: 16 } },
    h("button", {
      onClick: () => { setRemLabel(""); setRemDate(todayISO()); setRemClaim(""); setRemOpen(true); },
      style: { width: "100%", padding: "13px", borderRadius: 10, border: "none", background: T.primary, color: "#fff", fontFamily: font.body, fontWeight: 800, fontSize: fs(13.5), cursor: "pointer", marginBottom: 8 }
    }, t("Add a reminder")),
    h("div", { style: { fontSize: fs(11), color: T.inkSoft, marginBottom: 14, lineHeight: 1.5 } },
      t("Use the dates you have been given. This app does not work out your deadlines and will not invent one for you.")),
    upcoming.length === 0
      ? h("div", { style: { padding: "12px 14px", borderRadius: 12, border: "1px solid " + T.line, background: T.card } },
          h("div", { style: { fontFamily: font.display, fontSize: fs(17), color: T.heading, marginBottom: 4 } }, t("Nothing to watch for")),
          h("div", { style: { fontFamily: font.body, fontSize: fs(12), color: T.inkSoft, lineHeight: 1.5 } },
            t("When a letter, court notice or institution gives you a date, put it here: a filing deadline, appointment, return date or promised follow-up."))
        )
      : h("div", { style: { background: T.card, border: "1px solid " + T.line, borderRadius: 10, overflow: "hidden" } },
          upcoming.map((r, i) => {
            const d = daysBetween(todayISO(), r.date);
            const overdue = !r.done && d !== null && d < 0;
            const soon = !r.done && d !== null && d >= 0 && d <= 14;
            return h("div", { key: r.id, style: { display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderTop: i === 0 ? "none" : "1px solid " + T.line } },
              h("button", {
                onClick: () => toggleReminder(r.id),
                "aria-label": r.done ? t("Mark not done") : t("Mark done"),
                style: {
                  width: 19, height: 19, borderRadius: 5, flex: "0 0 auto", cursor: "pointer",
                  border: "1.5px solid " + (r.done ? T.green : T.line), background: r.done ? T.green : "#fff",
                  color: "#fff", fontSize: fs(12), fontWeight: 900, lineHeight: "16px", padding: 0
                }
              }, r.done ? "\u2713" : ""),
              h("div", { style: { flex: 1, minWidth: 0 } },
                h("div", { style: { fontSize: fs(13), color: r.done ? T.inkSoft : T.ink, textDecoration: r.done ? "line-through" : "none", overflowWrap: "anywhere" } }, r.label),
                h("div", { style: { fontSize: fs(10.5), color: overdue ? T.red : (soon ? T.amber : T.inkSoft), marginTop: 2 } },
                  formatDate(r.date),
                  r.done ? "" : (overdue ? "  ·  " + spanText(r.date, todayISO()) + " ago" : (d === 0 ? t("  ·  today") : t("  ·  in ") + spanText(todayISO(), r.date))),
                  r.claimId && claimById(r.claimId) ? "  ·  " + claimById(r.claimId).condition : ""
                )
              ),
              h("button", {
                onClick: () => removeReminder(r.id),
                style: { border: "none", background: "transparent", color: T.inkSoft, fontSize: fs(12), cursor: "pointer" }
              }, "\u2715")
            );
          })
        )
  );

  const documentsScreen = () => {
    const all = docMeta.slice().sort((a, b) => (b.addedAt || "").localeCompare(a.addedAt || ""));
    return h("div", { style: { padding: 16 } },
      h("button", {
        onClick: () => pickDocument(null),
        style: { width: "100%", padding: "13px", borderRadius: 10, border: "none", background: T.primary, color: "#fff", fontFamily: font.body, fontWeight: 800, fontSize: fs(13.5), cursor: "pointer", marginBottom: 8 }
      }, t("Add a document")),
      h("div", { style: { fontSize: fs(11), color: T.inkSoft, marginBottom: 14, lineHeight: 1.5 } },
        t("Photographs or PDFs of statements of death, the will, certificates and letters, kept on this phone only. You can pick several at once. They are not in the text backup, so keep the originals.")),
      all.length === 0
        ? h("div", { style: { padding: "12px 14px", borderRadius: 12, border: "1px solid " + T.line, background: T.card } },
            h("div", { style: { fontFamily: font.display, fontSize: fs(17), color: T.heading, marginBottom: 4 } }, t("No documents yet")),
            h("div", { style: { fontFamily: font.body, fontSize: fs(12), color: T.inkSoft, lineHeight: 1.5 } },
              t("Statements of death, the will, certificates, anything you post. Photograph it before it goes in the envelope."))
          )
        : h("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 } },
            all.map((d) => h("button", {
              key: d.id,
              onClick: () => openDocument(d.id),
              style: { padding: 0, border: "1px solid " + T.line, borderRadius: 9, overflow: "hidden", background: T.card, cursor: "pointer" }
            },
              h(DocThumb, { doc: d }),
              h("div", { style: { fontSize: fs(9.5), color: T.inkSoft, padding: "4px 5px", lineHeight: 1.3, overflowWrap: "anywhere" } },
                d.title,
                d.claimId && claimById(d.claimId) ? h("span", { style: { display: "block", color: T.gold } }, claimById(d.claimId).condition) : null)
            ))
          )
    );
  };

  // ---- Provincial probate / estate-grant fees.
  //
  // The selected estate province changes the arithmetic and the process text.
  // The calculator deliberately does not decide which assets belong in the
  // entered value or whether a grant is required; those remain legal questions.
  const chooseProvince = (id) => {
    const next = normaliseProvinceId(id);
    setProvince(next);
    const levels = probateLevels(next);
    if (!levels.some((l) => l.id === (rdLevel === "eir" ? "provincial" : rdLevel))) setRdLevel(levels[0].id);
  };

  const provincePicker = (marginBottom = 14) => h("div", { style: { marginBottom } },
    h("div", { style: { ...labelStyle(), marginBottom: 6 } }, t("Estate province or territory")),
    h("div", { role: "group", "aria-label": t("Estate province or territory"), style: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 7 } },
      PROVINCES.map((p) => h("button", {
        key: p.id,
        onClick: () => chooseProvince(p.id),
        "aria-pressed": province === p.id ? "true" : "false",
        style: {
          padding: "10px 5px", borderRadius: 9, cursor: "pointer",
          border: "1.5px solid " + (province === p.id ? T.primary : T.line),
          background: province === p.id ? T.primary : T.btn2,
          color: province === p.id ? "#fff" : T.ink,
          fontFamily: font.body, fontSize: fs(11.5), fontWeight: province === p.id ? 800 : 700
        }
      }, t(p.short))))
  );

  const estimateScreen = () => {
    const raw = estImpair === "" ? null : Number(estImpair);
    const hasInput = raw !== null && Number.isFinite(raw) && raw >= 0;
    const calc = hasInput ? calculateProbateFees(province, raw) : null;
    const p = provinceDef(province);
    const sourcesByProvince = {
      ON: [{ label: "Ontario Estate Administration Tax", url: "https://www.ontario.ca/page/estate-administration-tax" }],
      BC: [
        { label: "B.C. Probate Fee Act", url: "https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/00_99004_01" },
        { label: "B.C. Supreme Court fees", url: "https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/168_2009_06" }
      ],
      AB: [{ label: "Alberta court fees", url: "https://www.alberta.ca/court-fees" }],
      SK: [{ label: "Saskatchewan probate fees", url: "https://sasklawcourts.ca/kings-bench/wills-and-estates/probating-an-estate/" }],
      MB: [
        { label: "Manitoba Court Services Fees Regulation", url: "https://web2.gov.mb.ca/laws/regs/current/150-2021.php" },
        { label: "Manitoba probate-charge elimination notice", url: "https://www.manitobacourts.mb.ca/site/assets/files/1152/2020-11-06_notice_-_elimination_of_probate_charges.pdf" }
      ],
      NS: [
        { label: "Nova Scotia Probate Court costs and fees", url: "https://www.courts.ns.ca/resources/public/costs-fees" },
        { label: "Nova Scotia probate regulations", url: "https://novascotia.ca/just/regulations/regs/probregs.htm" }
      ],
      NB: [
        { label: "New Brunswick Probate Court tax and fees", url: "https://www.gnb.ca/content/cour/en/probate-court.html" },
        { label: "New Brunswick Probate Court Act", url: "https://laws.gnb.ca/en/document/cs/P-17.1/" }
      ],
      NL: [
        { label: "Newfoundland and Labrador Court service fees", url: "https://www.court.nl.ca/supreme/schedule-of-fees/" },
        { label: "Newfoundland and Labrador Services Charges Act", url: "https://www.assembly.nl.ca/legislation/sr/statutes/s13-2.htm" }
      ],
      PE: [
        { label: "Prince Edward Island Probate Act", url: "https://www.princeedwardisland.ca/en/legislation/probate-act" },
        { label: "Prince Edward Island Rule 65 estate forms", url: "https://www.courts.pe.ca/forms" }
      ],
      QC: [
        { label: "Quebec will verification", url: "https://www.quebec.ca/en/justice-et-etat-civil/testament-succession/succession/settlement/succession-will/probating" },
        { label: "Quebec mandatory will search", url: "https://www.quebec.ca/en/justice-et-etat-civil/testament-succession/succession/to-do/will-search" },
        { label: "Quebec liquidator designation", url: "https://www.quebec.ca/en/justice-et-etat-civil/testament-succession/succession/to-do/liquidator/appointment" }
      ],
      YT: [
        { label: "Yukon Supreme Court Appendix C fees", url: "https://www.yukoncourts.ca/sites/default/files/2023-12/Appendix%20C.pdf" },
        { label: "Yukon Rule 64", url: "https://www.yukoncourts.ca/sites/default/files/2022-12/2022%20Rule%2064%20-%20ADMINISTRATION%20OF%20ESTATES%20%28NON%20CONTENTIOUS%29.pdf" }
      ],
      NT: [
        { label: "NWT Court Services Fees Regulations", url: "https://www.justice.gov.nt.ca/en/legislation/" },
        { label: "NWT Estate Administration Rules", url: "https://www.justice.gov.nt.ca/en/files/court-rules/Judicature%20Act/Estate%20Administration%20Rules/Estate%20Administration%20Rules.pdf" }
      ],
      NU: [
        { label: "Nunavut Court fee structure", url: "https://www.nunavutcourts.ca/nunavut-court-justice/rules-policies-directives-announcements/court-policies-and-fees" },
        { label: "Nunavut Probate and Administration Rules", url: "https://www.nunavutcourts.ca/nunavut-court-justice/rules-policies-directives-announcements/rules-court" }
      ]
    };
    const hintByProvince = {
      ON: "Enter the estate value used for Ontario Estate Administration Tax. Which assets count is a legal question.",
      BC: "Enter the estate value for the B.C. grant. The Probate Fee Act has its own definition of estate value; get advice if you are unsure what counts.",
      AB: "Enter the net value of property in Alberta used for the grant-fee bracket.",
      SK: "Enter the Saskatchewan estate value used for the standard probate levy. The government application guidance calculates the levy from Total Part 1 Assets on the Statement of Property; whether an asset belongs there is a legal question.",
      MB: "Manitoba has no value-based probate application charge. Entering a value confirms the current $0 charge; separate court services can still have fees.",
      NS: "Enter the Nova Scotia estate value used for probate tax. The Probate Act and regulations determine what property counts; get advice if ownership or valuation is unclear.",
      NB: "Enter the New Brunswick estate value used for probate tax. The calculator applies the rates effective June 12, 2026; whether particular property belongs in the application is a legal question.",
      NL: "Enter the Newfoundland and Labrador estate value used on Form 56.10A. The Court says the inventory value is used to set the estate-value court charge.",
      PE: "Enter the P.E.I. probate value for the standard petition fee. The Probate Act defines probate value; get legal advice if you are unsure what property belongs in it.",
      QC: "Quebec does not use an estate-value probate tax. The important cost question is whether a non-notarial will must be verified, plus RDPRM, newspaper, notary or court costs that depend on the file.",
      YT: "Enter the Yukon estate value used for the grant-fee threshold. Whether a grant is required and what property belongs in the estate are legal questions.",
      NT: "Enter the value of property in the Northwest Territories after deducting debts and liabilities against that property, as used by the current court-fee bands.",
      NU: "Enter the value of property in Nunavut after deducting debts and liabilities against that property, as used by the current court-fee bands."
    };
    const emptyByProvince = {
      ON: "Ontario: $0 on the first $50,000, then $15 per $1,000 or part above it; the estate value is rounded up to the next $1,000.",
      BC: "B.C.: no Probate Fee Act fee at $25,000 or less. Above that the bands are $6 and $14 per $1,000 or part, plus a separate $200 court commencement fee above $25,000.",
      AB: "Alberta: the grant fee is a fixed bracket from $35 to $525, based on the net value of property in Alberta.",
      SK: "Saskatchewan standard grant application: $200 Local Registrar filing fee plus $7 per $1,000 or part. A separate $100 small-estate order may be available for qualifying estates with personal property of $25,000 or less and no Saskatchewan real property passing through the estate.",
      MB: "Manitoba: charges for applications for probate or administration were eliminated effective November 6, 2020. Separate court services can still have fees.",
      NS: "Nova Scotia: probate tax is charged by estate-value band. Above $100,000 it is $1,002.65 plus $16.95 for every $1,000 or part over $100,000. Royal Gazette advertising is a separate post-grant cost.",
      NB: "New Brunswick (applications filed on or after June 12, 2026): $200 up to $20,000; then $5 per $1,000 or part over $20,000 through $100,000; above $100,000, $600 plus $15 per $1,000 or part over $100,000.",
      NL: "Newfoundland and Labrador: $60 where the estate value does not exceed $1,000; above $1,000, $60 plus $0.60 for each additional $100 in value (0.6% of the portion over $1,000).",
      PE: "Prince Edward Island: $50 up to $10,000; $100 to $25,000; $200 to $50,000; $400 to $100,000; above $100,000, $400 plus $4 per $1,000 or fraction over $100,000.",
      QC: "Quebec: no estate-value probate tax. A notarial will does not need probate; holograph and witnessed wills require verification. Current RDPRM fees shown by Quebec are $59 for liquidator designation and $59 for each listed closure notice; other costs vary.",
      YT: "Yukon: no grant fee where the estate does not exceed $25,000; $140 for a grant, ancillary grant or resealing where the estate exceeds $25,000.",
      NT: "Northwest Territories: $30 up to $10,000; $110 to $25,000; $215 to $125,000; $325 to $250,000; $435 above $250,000. A separate Rule 10 small-estate declaration route exists where net value reasonably appears under $35,000.",
      NU: "Nunavut: $30 up to $10,000; $110 to $25,000; $215 to $125,000; $325 to $250,000; $425 above $250,000. Certified copies, caveats and other services can add separate fees."
    };
    const sources = sourcesByProvince[province] || sourcesByProvince.ON;
    const hint = hintByProvince[province] || hintByProvince.ON;
    const empty = emptyByProvince[province] || emptyByProvince.ON;

    let resultCard = null;
    if (hasInput && province === "ON") {
      resultCard = h("div", { style: { background: T.card, border: "1px solid " + T.line, borderRadius: 12, padding: "14px 15px" } },
        h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 } },
          h("span", { style: { fontSize: fs(12), color: T.inkSoft } }, t("Value, rounded up")),
          h("span", { style: { fontFamily: font.body, fontSize: fs(14), fontWeight: 800, color: T.ink } }, money(calc.rounded))),
        h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 } },
          h("span", { style: { fontSize: fs(12), color: T.inkSoft } }, t("Taxed above $50,000")),
          h("span", { style: { fontFamily: font.body, fontSize: fs(14), fontWeight: 800, color: T.ink } }, money(calc.taxable))),
        h("div", { style: { borderTop: "1px solid " + T.line, marginTop: 6, paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "baseline" } },
          h("span", { style: { fontFamily: font.display, fontSize: fs(15), color: T.heading } }, t("Estate Administration Tax")),
          h("span", { style: { fontFamily: font.body, fontSize: fs(19), fontWeight: 800, color: T.gold } }, money(calc.total))));
    } else if (hasInput && province === "BC") {
      resultCard = h("div", { style: { background: T.card, border: "1px solid " + T.line, borderRadius: 12, padding: "14px 15px" } },
        h("div", { style: { display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 8 } },
          h("span", { style: { fontSize: fs(12), color: T.inkSoft } }, t("Probate Fee Act fee")),
          h("span", { style: { fontFamily: font.body, fontSize: fs(14), fontWeight: 800, color: T.ink } }, money(calc.probateFee))),
        h("div", { style: { display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 8 } },
          h("span", { style: { fontSize: fs(12), color: T.inkSoft } }, t("Supreme Court commencement fee")),
          h("span", { style: { fontFamily: font.body, fontSize: fs(14), fontWeight: 800, color: T.ink } }, money(calc.courtFee))),
        h("div", { style: { borderTop: "1px solid " + T.line, marginTop: 6, paddingTop: 10, display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" } },
          h("span", { style: { fontFamily: font.display, fontSize: fs(15), color: T.heading } }, t("Estimated court + probate fees")),
          h("span", { style: { fontFamily: font.body, fontSize: fs(19), fontWeight: 800, color: T.gold } }, money(calc.total))),
        h("div", { style: { fontSize: fs(10.5), color: T.inkSoft, marginTop: 8, lineHeight: 1.45 } },
          t("This total does not include a wills search, alias searches, optional courier charges, electronic-filing fees or other case-specific court charges.")));
    } else if (hasInput && province === "AB") {
      resultCard = h("div", { style: { background: T.card, border: "1px solid " + T.line, borderRadius: 12, padding: "14px 15px" } },
        h("div", { style: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" } },
          h("span", { style: { fontFamily: font.display, fontSize: fs(15), color: T.heading } }, t("Court fee for the grant")),
          h("span", { style: { fontFamily: font.body, fontSize: fs(19), fontWeight: 800, color: T.gold } }, money(calc.total))),
        h("div", { style: { fontSize: fs(10.5), color: T.inkSoft, marginTop: 8, lineHeight: 1.45 } },
          t("This is the published fee for issuing a grant of probate or administration based on the net value of property in Alberta. Other court services can have separate fees.")));
    } else if (hasInput && province === "SK") {
      resultCard = h("div", { style: { background: T.card, border: "1px solid " + T.line, borderRadius: 12, padding: "14px 15px" } },
        h("div", { style: { display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 8 } },
          h("span", { style: { fontSize: fs(12), color: T.inkSoft } }, t("Probate levy")),
          h("span", { style: { fontFamily: font.body, fontSize: fs(14), fontWeight: 800, color: T.ink } }, money(calc.probateLevy))),
        h("div", { style: { display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 8 } },
          h("span", { style: { fontSize: fs(12), color: T.inkSoft } }, t("Local Registrar filing fee")),
          h("span", { style: { fontFamily: font.body, fontSize: fs(14), fontWeight: 800, color: T.ink } }, money(calc.courtFee))),
        h("div", { style: { borderTop: "1px solid " + T.line, marginTop: 6, paddingTop: 10, display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" } },
          h("span", { style: { fontFamily: font.display, fontSize: fs(15), color: T.heading } }, t("Estimated standard court + probate fees")),
          h("span", { style: { fontFamily: font.body, fontSize: fs(19), fontWeight: 800, color: T.gold } }, money(calc.total))),
        h("div", { style: { fontSize: fs(10.5), color: T.inkSoft, marginTop: 8, lineHeight: 1.45 } },
          t("This is the standard grant route only. It does not include the separate $25 Certificate of No Infants fee when requested. A qualifying small estate with personal property of $25,000 or less and no Saskatchewan real property passing through the estate can use a different $100 court-order route.")));
    } else if (hasInput && province === "MB") {
      resultCard = h("div", { style: { background: T.card, border: "1px solid " + T.line, borderRadius: 12, padding: "14px 15px" } },
        h("div", { style: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" } },
          h("span", { style: { fontFamily: font.display, fontSize: fs(15), color: T.heading } }, t("Probate / administration application charge")),
          h("span", { style: { fontFamily: font.body, fontSize: fs(19), fontWeight: 800, color: T.gold } }, money(calc.total))),
        h("div", { style: { fontSize: fs(10.5), color: T.inkSoft, marginTop: 8, lineHeight: 1.45 } },
          t("Manitoba eliminated charges relating to applications for probate or administration effective November 6, 2020. Separate court services such as caveats, searches and certified documents can still have fees. Estates of $10,000 or less may also qualify for the separate section 47 summary-administration procedure.")));
    } else if (hasInput && province === "NS") {
      resultCard = h("div", { style: { background: T.card, border: "1px solid " + T.line, borderRadius: 12, padding: "14px 15px" } },
        h("div", { style: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" } },
          h("span", { style: { fontFamily: font.display, fontSize: fs(15), color: T.heading } }, t("Nova Scotia probate tax")),
          h("span", { style: { fontFamily: font.body, fontSize: fs(19), fontWeight: 800, color: T.gold } }, moneyCents(calc.total))),
        h("div", { style: { fontSize: fs(10.5), color: T.inkSoft, marginTop: 8, lineHeight: 1.45 } },
          t("This is the published probate tax only. The required Royal Gazette Estate Notice currently costs $68.15 including HST and is a separate post-grant expense. Other case-specific court costs can also apply.")));
    } else if (hasInput && province === "NB") {
      resultCard = h("div", { style: { background: T.card, border: "1px solid " + T.line, borderRadius: 12, padding: "14px 15px" } },
        h("div", { style: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" } },
          h("span", { style: { fontFamily: font.display, fontSize: fs(15), color: T.heading } }, t("New Brunswick probate tax")),
          h("span", { style: { fontFamily: font.body, fontSize: fs(19), fontWeight: 800, color: T.gold } }, money(calc.total))),
        h("div", { style: { fontSize: fs(10.5), color: T.inkSoft, marginTop: 8, lineHeight: 1.45 } },
          t("These are the rates for applications filed on or after June 12, 2026. Separate sundry Probate Court fees can apply depending on the filing.")));
    } else if (hasInput && province === "NL") {
      resultCard = h("div", { style: { background: T.card, border: "1px solid " + T.line, borderRadius: 12, padding: "14px 15px" } },
        h("div", { style: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" } },
          h("span", { style: { fontFamily: font.display, fontSize: fs(15), color: T.heading } }, t("Newfoundland and Labrador court charge")),
          h("span", { style: { fontFamily: font.body, fontSize: fs(19), fontWeight: 800, color: T.gold } }, moneyCents(calc.total))),
        h("div", { style: { fontSize: fs(10.5), color: T.inkSoft, marginTop: 8, lineHeight: 1.45 } },
          t("This is the estate-value charge for a grant or resealing. The Supreme Court's own calculator uses the total from Form 56.10A; other court services can have separate fees.")));
    } else if (hasInput && province === "PE") {
      resultCard = h("div", { style: { background: T.card, border: "1px solid " + T.line, borderRadius: 12, padding: "14px 15px" } },
        h("div", { style: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" } },
          h("span", { style: { fontFamily: font.display, fontSize: fs(15), color: T.heading } }, t("P.E.I. standard probate petition fee")),
          h("span", { style: { fontFamily: font.body, fontSize: fs(19), fontWeight: 800, color: T.gold } }, money(calc.total))),
        h("div", { style: { fontSize: fs(10.5), color: T.inkSoft, marginTop: 8, lineHeight: 1.45 } },
          t("This is the standard petition fee only. The Probate Act has separate fees for some proceedings and an additional $1 fee for each renunciation or dedimus where probate value exceeds $1,000.")));
    } else if (hasInput && province === "YT") {
      resultCard = h("div", { style: { background: T.card, border: "1px solid " + T.line, borderRadius: 12, padding: "14px 15px" } },
        h("div", { style: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" } },
          h("span", { style: { fontFamily: font.display, fontSize: fs(15), color: T.heading } }, t("Yukon grant / resealing fee")),
          h("span", { style: { fontFamily: font.body, fontSize: fs(19), fontWeight: 800, color: T.gold } }, money(calc.total))),
        h("div", { style: { fontSize: fs(10.5), color: T.inkSoft, marginTop: 8, lineHeight: 1.45 } },
          t("Appendix C charges no grant fee where the estate does not exceed $25,000 and $140 above that threshold. A $0 fee does not by itself mean a grant is unnecessary.")));
    } else if (hasInput && province === "NT") {
      resultCard = h("div", { style: { background: T.card, border: "1px solid " + T.line, borderRadius: 12, padding: "14px 15px" } },
        h("div", { style: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" } },
          h("span", { style: { fontFamily: font.display, fontSize: fs(15), color: T.heading } }, t("NWT estate administration court fee")),
          h("span", { style: { fontFamily: font.body, fontSize: fs(19), fontWeight: 800, color: T.gold } }, money(calc.total))),
        h("div", { style: { fontSize: fs(10.5), color: T.inkSoft, marginTop: 8, lineHeight: 1.45 } },
          t("The standard fee band uses net property in the NWT. Rule 10 also provides a separate small-estate declaration route where net value reasonably appears to be less than $35,000; that is a legal/process choice, not an automatic calculator result.")));
    } else if (hasInput && province === "NU") {
      resultCard = h("div", { style: { background: T.card, border: "1px solid " + T.line, borderRadius: 12, padding: "14px 15px" } },
        h("div", { style: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" } },
          h("span", { style: { fontFamily: font.display, fontSize: fs(15), color: T.heading } }, t("Nunavut probate / administration court fee")),
          h("span", { style: { fontFamily: font.body, fontSize: fs(19), fontWeight: 800, color: T.gold } }, money(calc.total))),
        h("div", { style: { fontSize: fs(10.5), color: T.inkSoft, marginTop: 8, lineHeight: 1.45 } },
          t("The fee band uses net property in Nunavut. Certified copies, caveats and other court services have separate fees and are not included here.")));
    } else if (province === "QC") {
      resultCard = h("div", { style: { background: T.card, border: "1px solid " + T.line, borderRadius: 12, padding: "14px 15px" } },
        h("div", { style: { fontFamily: font.display, fontSize: fs(16), color: T.heading, marginBottom: 7 } }, t("Quebec succession costs work differently")),
        h("div", { style: { fontSize: fs(11.5), color: T.ink, lineHeight: 1.55 } },
          t("There is no estate-value probate tax to calculate. A notarial will does not need probate. A holograph or witnessed will must be verified by a notary or Superior Court, and those costs vary by route.")),
        h("div", { style: { fontSize: fs(11), color: T.inkSoft, marginTop: 8, lineHeight: 1.5 } },
          t("Current Quebec government pages list $59 to register the liquidator designation in the RDPRM, $59 for the notice of closure of inventory, and $59 for the notice closing the final account. Newspaper, registry-search, notary and court costs are separate.")));
    }

    return h("div", { style: { padding: 16 } },
      h("div", { style: { fontFamily: font.display, fontSize: fs(20), color: T.heading, marginBottom: 3 } }, t(province === "QC" ? "Quebec succession costs" : "Work out the probate fee")),
      h("div", { style: { fontSize: fs(11.5), color: T.inkSoft, marginBottom: 12, lineHeight: 1.5 } },
        province === "QC" ? t("Quebec does not use an estate-value probate tax. This screen shows the succession cost structure and the official sources instead of asking for a meaningless estate-value calculation.") : t(p.label) + t(" rules from a value you enter. Arithmetic on published government rates, not a legal decision about what belongs in the estate.")),

      province === "QC" ? null : h("div", { style: { background: T.card, border: "1px solid " + T.line, borderRadius: 12, padding: "14px 15px", marginBottom: 12 } },
        h(Field, { label: t("Estate value for this calculation"), hint: t(hint) },
          h("input", {
            type: "number", inputMode: "decimal", min: "0", value: estImpair,
            onInput: (e) => setEstImpair(e.currentTarget.value), placeholder: "0",
            style: { ...inputStyle(), width: "100%" }
          }))
      ),

      !hasInput
        ? h("div", { style: { padding: "14px 15px", borderRadius: 12, border: "1px solid " + T.line, background: T.card } },
            h("div", { style: { fontFamily: font.display, fontSize: fs(17), color: T.heading, marginBottom: 4 } }, t("Enter a value to see the fee")),
            h("div", { style: { fontSize: fs(12), color: T.inkSoft, lineHeight: 1.5 } }, t(empty)))
        : resultCard,

      h("div", { style: { marginTop: 12, background: T.goldSoft, border: "1px solid " + T.gold, borderRadius: 10, padding: "11px 13px", fontSize: fs(11.5), color: T.ink, lineHeight: 1.55 } },
        h("b", null, t("This does not decide whether probate is needed or what value belongs in the calculation.")),
        t(" Asset ownership, joint interests, beneficiary designations, debts and property outside the jurisdiction can change the legal answer. Use the jurisdiction-specific legal-help route under Help if you are unsure.")),

      h("div", { style: { marginTop: 10, fontSize: fs(10.5), color: T.inkSoft, lineHeight: 1.5 } },
        t("Rates and rules were checked in ") + RATES_READ + t(". Check the authoritative source") + (sources.length > 1 ? t("s") : "") + t(" before relying on the estimate: "),
        sources.map((source, i) => h(React.Fragment, { key: source.url },
          i ? t(" · ") : null,
          h("a", { href: frUrl(source.url).url, target: "_blank", rel: "noopener noreferrer", style: { color: T.blue, fontWeight: 700, textDecoration: "none" } }, t(source.label) + (frUrl(source.url).english ? t(" (page in English)") : ""))
        ))),

      h("div", { style: { marginTop: 14 } },
        h("button", { onClick: () => setGuideOpen(true), style: { width: "100%", padding: "13px", borderRadius: 10, border: "1px solid " + T.line, background: T.btn2, color: T.ink, fontFamily: font.body, fontSize: fs(13), fontWeight: 700, cursor: "pointer" } },
          t("The first two weeks ›")))
    );
  };

  const statusToneColor = (tone) =>
    tone === "green" ? T.green : tone === "amber" ? T.amber : tone === "red" ? T.red : T.inkSoft;

  const bodyScreen = () => h("div", { style: { padding: 16 } },
    h("div", { style: { fontFamily: font.display, fontSize: fs(20), color: T.heading, marginBottom: 3 } }, t("The estate inventory")),
    h("div", { style: { fontSize: fs(11.5), color: T.inkSoft, marginBottom: 14, lineHeight: 1.5 } },
      t("Every account, property and debt, what it is worth at the date of death, and how it passes. Courts, provincial or territorial estate processes and the CRA can all require parts of this same information. Build it once here instead of rebuilding it from memory.")),

    h("div", { style: { display: "grid", gridTemplateColumns: conditions.length ? "1fr 1fr" : "1fr", gap: 8, marginBottom: 14 } },
      h("button", {
        onClick: openNewCondition,
        style: { padding: "12px", borderRadius: 10, border: "none", background: T.primary, color: "#fff", fontFamily: font.body, fontWeight: 800, fontSize: fs(13.5), cursor: "pointer" }
      }, t("Add to the inventory")),
      conditions.length ? h("button", {
        onClick: openCondExport,
        style: { padding: "12px", borderRadius: 10, border: "1px solid " + T.line, background: T.btn2, color: T.ink, fontFamily: font.body, fontWeight: 700, fontSize: fs(13), cursor: "pointer" }
      }, t("The whole list, as text")) : null),

    conditions.length === 0
      ? h("div", { style: { padding: "12px 14px", borderRadius: 12, border: "1px solid " + T.line, background: T.card } },
          h("div", { style: { fontFamily: font.display, fontSize: fs(17), color: T.heading, marginBottom: 4 } }, t("Start at the top of your head")),
          h("div", { style: { fontFamily: font.body, fontSize: fs(12), color: T.inkSoft, lineHeight: 1.5 } },
            t("Build the estate inventory one item at a time: accounts, property, insurance, investments, debts and anything else that matters. Record how it passes, who holds it and the value at the date of death.")))
      : conditionsByArea.map((g) => h("div", { key: g.area, style: { marginBottom: 16 } },
          h("div", { style: { fontFamily: font.display, fontSize: fs(17), color: T.heading, marginBottom: 7 } }, bodyArea(g.area).label),
          h("div", { style: { background: T.card, border: "1px solid " + T.line, borderRadius: 10, overflow: "hidden" } },
            g.items.map((c, i) => {
              const st = conditionStatus(c.status);
              return h("button", {
                key: c.id,
                onClick: () => openEditCondition(c),
                style: { display: "block", width: "100%", textAlign: "left", cursor: "pointer", background: "transparent", border: "none", padding: "11px 13px", borderTop: i === 0 ? "none" : "1px solid " + T.line }
              },
                h("div", { style: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" } },
                  h("span", { style: { fontFamily: font.body, fontSize: fs(13), fontWeight: 800, color: T.ink, minWidth: 0 } }, c.name),
                  h("span", { style: { flex: "0 0 auto", fontFamily: font.body, fontSize: fs(10.5), fontWeight: 800, color: statusToneColor(st.tone) } }, t(st.label))),
                c.linked ? h("div", { style: { fontSize: fs(11), color: T.inkSoft, marginTop: 3 } }, t("Linked to ") + c.linked) : null,
                c.impacts ? h("div", { style: { fontSize: fs(11.5), color: T.inkSoft, marginTop: 3, lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } }, c.impacts) : null
              );
            })
          ))),

    conditions.length ? h("div", { style: { fontSize: fs(10.5), color: T.inkSoft, lineHeight: 1.45, marginTop: 4 } },
      t("Tap an inventory item to change or remove it. This list stays on your phone, and it is in your backup under Settings.")) : null
  );

  const benefitsScreen = () => h("div", { style: { padding: 16 } },
    h("div", { style: { fontFamily: font.display, fontSize: fs(20), color: T.heading, marginBottom: 3 } }, t("What exists")),
    h("div", { style: { fontSize: fs(11.5), color: T.inkSoft, marginBottom: 12, lineHeight: 1.5 } },
      t(province === "QC" ? "Quebec uses the Québec Pension Plan for its main survivor benefits; federal OAS, CRA and other Canada-wide information still applies. Estate information below follows Quebec succession rules." : "Federal benefits apply across Canada. Provincial or territorial estate information below changes with the estate province or territory selected here and in Settings.")),

    ratesAreStale() ? h("div", {
      style: { background: "#FBEBE8", border: "1px solid " + T.red, borderRadius: 9, padding: "10px 12px", fontSize: fs(11.5), color: T.red, marginBottom: 14, lineHeight: 1.45 }
    }, t("These amounts were read in ") + RATES_READ + t(". Check the government pages before relying on them.")) : null,

    benefitCategories(province).map((cat) => {
      const items = benefitsForProvince(province).filter((b) => b.cat === cat.id);
      if (!items.length) return null;
      return h("div", { key: cat.id, style: { marginBottom: 18 } },
        h("div", { style: { fontFamily: font.display, fontSize: fs(17), color: T.heading, marginBottom: cat.note ? 3 : 7 } }, t(cat.label)),
        cat.note ? h("div", { style: { fontSize: fs(11), color: T.inkSoft, marginBottom: 7, lineHeight: 1.45 } }, t(cat.note)) : null,
        h("div", { style: { background: T.card, border: "1px solid " + T.line, borderRadius: 10, overflow: "hidden" } },
          items.map((b, i) => h("div", {
            key: b.id,
            style: { padding: "11px 13px", borderTop: i === 0 ? "none" : "1px solid " + T.line }
          },
            h("div", { style: { fontFamily: font.body, fontSize: fs(13), fontWeight: 800, color: T.ink } }, t(b.name)),
            h("div", { style: { fontSize: fs(11.5), color: T.inkSoft, marginTop: 3, lineHeight: 1.5 } }, t(b.what)),
            h("div", { style: { fontSize: fs(11.5), color: T.gold, fontWeight: 700, marginTop: 4 } }, t(b.rate)),
            h("a", {
              href: frUrl(b.url).url, target: "_blank", rel: "noopener noreferrer",
              style: { display: "inline-block", fontSize: fs(11), color: T.blue, fontWeight: 700, marginTop: 5, textDecoration: "none" }
            }, benefitLinkText(b.url)),
            b.moreUrl ? h("a", {
              href: b.moreUrl, target: "_blank", rel: "noopener noreferrer",
              style: { display: "block", fontSize: fs(11), color: T.blue, fontWeight: 700, marginTop: 4, textDecoration: "none" }
            }, t(b.moreLabel || "Open second official source")) : null
          ))
        )
      );
    }),

    h("div", { style: { background: T.goldSoft, border: "1px solid " + T.gold, borderRadius: 10, padding: "12px 14px", fontSize: fs(12), color: T.ink, lineHeight: 1.55, marginBottom: 10 } },
      h("b", null, t("Not sure which of these applies to you?")),
      t(" That is normal. Eligibility depends on the benefit and the person's circumstances. Use the official links for the rules, and ask Service Canada, Retraite Québec when applicable, the CRA, or a qualified professional when you are unsure."),
      h("div", { style: { marginTop: 7, color: T.inkSoft } }, t("Key phone numbers and legal-help information are under Help, at the top of any screen."))
    ),

    h("button", {
      onClick: () => setHelpOpen(true),
      style: {
        width: "100%", cursor: "pointer", textAlign: "left",
        background: T.primary, color: T.cream, border: "none", borderRadius: 10,
        padding: "12px 14px", fontFamily: font.body, fontSize: fs(12), lineHeight: 1.55
      }
    },
      h("b", null, t("Every number in one place.")),
      t(" Crisis and grief support, the government numbers you may need, and jurisdiction-specific legal-help routes. Tap here, or Help at the top of any screen."))
  );

  const summarySheet = () => sheet(() => setSummaryOpen(false), [
    h("div", { key: "t", style: { fontFamily: font.display, fontSize: fs(20), color: T.heading, marginBottom: 3 } },
      summaryWhole ? t("Your whole file") : t("Step summary")),
    h("div", { key: "b", style: { fontSize: fs(11.5), color: T.inkSoft, marginBottom: 12, lineHeight: 1.45 } },
      summaryWhole
        ? t("Every estate step, inventory item, call and date in one document. Useful when meeting a lawyer or accountant, updating a co-executor, or keeping a paper record.")
        : t("Everything you have recorded on this step, on one page. Copy it into an email, or read it down the phone.")),
    h("textarea", { key: "ta", value: summaryText, readOnly: true, rows: 14,
      style: { ...inputStyle(), width: "100%", resize: "vertical", fontSize: fs(11), lineHeight: 1.45, fontFamily: "ui-monospace, Menlo, Consolas, monospace" } }),
    h("div", { key: "a", style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 } },
      h("button", { onClick: () => setSummaryOpen(false), style: { padding: "13px", borderRadius: 10, border: "1px solid " + T.line, background: T.btn2, fontFamily: font.body, fontSize: fs(13), fontWeight: 700, cursor: "pointer" } }, t("Close")),
      h("button", { onClick: copySummary, style: { padding: "13px", borderRadius: 10, border: "none", background: T.primary, color: "#fff", fontFamily: font.body, fontSize: fs(13), fontWeight: 800, cursor: "pointer" } }, t("Copy"))),
    // Print sits below the pair rather than replacing one of them: copy is
    // still the common case, and on an iPhone the print sheet is also the
    // route to Save to Files as a PDF, which is worth saying out loud.
    h("button", {
      key: "p", onClick: printSummary,
      style: { width: "100%", marginTop: 8, padding: "13px", borderRadius: 10, border: "none", background: T.primary, color: "#fff", fontFamily: font.body, fontSize: fs(13.5), fontWeight: 800, cursor: "pointer" }
    }, t("Print or save as PDF")),
    h("div", { key: "pn", style: { fontSize: fs(10.5), color: T.inkSoft, marginTop: 6, lineHeight: 1.45, textAlign: "center" } },
      t("Printing opens your phone's print sheet, where Save to Files makes a PDF."))
  ]);

  const statementSheet = () => {
    const sd = statementDef(stmtKind);
    const words = wordCount(stmtText);
    return sheet(() => setStmtOpen(false), [
      h("div", { key: "t", style: { fontFamily: font.display, fontSize: fs(20), color: T.heading, marginBottom: 3 } }, sd.label),
      h("div", { key: "l", style: { fontSize: fs(11.5), color: T.inkSoft, marginBottom: 10, lineHeight: 1.45 } }, t(sd.lead)),

      h("button", {
        key: "pt",
        onClick: () => setShowPrompts(!showPrompts),
        style: {
          width: "100%", textAlign: "left", cursor: "pointer", marginBottom: 10,
          background: T.goldSoft, border: "1px solid " + T.gold, borderRadius: 9, padding: "10px 12px"
        }
      },
        h("div", { style: { fontFamily: font.body, fontSize: fs(12), fontWeight: 800, color: T.heading } },
          showPrompts ? t("Things you might mention") : t("Things you might mention  (tap to show)")),
        showPrompts
          ? h("div", { style: { marginTop: 6 } },
              sd.prompts.map((p) => h("div", {
                key: p,
                style: { fontSize: fs(11.5), color: T.ink, lineHeight: 1.5, marginTop: 4 }
              }, "\u00b7  " + t(p))),
              h("div", { style: { fontSize: fs(10.5), color: T.inkSoft, marginTop: 8, lineHeight: 1.45 } },
                t("These are the questions the form asks, put plainly. Not a template, and not everything applies to everyone."))
            )
          : null
      ),

      h("textarea", {
        key: "ta", value: stmtText,
        onInput: (e) => updateStatement(e.currentTarget.value),
        rows: 12,
        placeholder: t("Start anywhere. It does not have to be in order, and it does not have to be finished today."),
        style: { ...inputStyle(), width: "100%", resize: "vertical", fontSize: fs(13.5), lineHeight: 1.6 }
      }),

      h("div", { key: "wc", style: { display: "flex", justifyContent: "space-between", fontSize: fs(10.5), color: T.inkSoft, marginTop: 6 } },
        h("span", null, words ? words + (words === 1 ? t(" word") : t(" words")) : ""),
        h("span", null, t("Saved as you type"))),

      h("div", { key: "a", style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 } },
        h("button", {
          onClick: () => setStmtOpen(false),
          style: { padding: "13px", borderRadius: 10, border: "1px solid " + T.line, background: T.btn2, fontFamily: font.body, fontSize: fs(13), fontWeight: 700, cursor: "pointer" }
        }, t("Done")),
        h("button", {
          onClick: copyStatement, disabled: !stmtText.trim(),
          style: {
            padding: "13px", borderRadius: 10, border: "none", fontFamily: font.body, fontSize: fs(13), fontWeight: 800,
            cursor: stmtText.trim() ? "pointer" : "default",
            background: stmtText.trim() ? T.primary : "#B9BDCB", color: "#fff"
          }
        }, t("Copy"))),

      h("div", { key: "n", style: { fontSize: fs(10.5), color: T.inkSoft, marginTop: 9, lineHeight: 1.45 } },
        t("This stays on your phone. Take it to the meeting with the lawyer or the accountant, so the half-hour is spent on answers rather than on remembering the questions."))
    ]);
  };

  const searchSheet = () => sheet(() => setSearchOpen(false), [
    h("div", { key: "t", style: { fontFamily: font.display, fontSize: fs(20), color: T.heading, marginBottom: 3 } }, t("Search your file")),
    h("div", { key: "b", style: { fontSize: fs(11.5), color: T.inkSoft, marginBottom: 10, lineHeight: 1.45 } },
      t("Your estate steps, inventory, contact log, reminders, notes and probate progress. Only what you wrote yourself.")),
    h("input", {
      key: "q",
      value: searchQ,
      onInput: (e) => setSearchQ(e.currentTarget.value),
      placeholder: t("Type a name, a word, anything"),
      "aria-label": t("Search your file"),
      autoComplete: "off", autoCorrect: "off", autoCapitalize: "none",
      style: { ...inputStyle(), width: "100%", fontSize: fs(15) }
    }),
    normalise(searchQ).trim().length < 2
      ? h("div", { key: "hint", style: { fontSize: fs(11), color: T.inkSoft, marginTop: 10, lineHeight: 1.5 } },
          t("Two letters or more. Accents and capitals do not matter."))
      : searchResults.length === 0
        ? h("div", { key: "none", style: { marginTop: 12, padding: "12px 14px", borderRadius: 10, border: "1px solid " + T.line, background: T.card } },
            h("div", { style: { fontFamily: font.body, fontSize: fs(12.5), fontWeight: 700, color: T.ink } }, t("Nothing found")),
            h("div", { style: { fontSize: fs(11.5), color: T.inkSoft, marginTop: 3, lineHeight: 1.45 } },
              t("This looks through what you have entered, not the benefit list or the guide.")))
        : h("div", { key: "res", style: { marginTop: 12 } },
            h("div", { style: { fontSize: fs(10.5), color: T.inkSoft, marginBottom: 6 } },
              searchResults.length + " " + t(searchResults.length === 1 ? t("result") : t("results"))),
            h("div", { style: { background: T.card, border: "1px solid " + T.line, borderRadius: 10, overflow: "hidden" } },
              searchResults.map((r, i) => h("button", {
                key: r.kind + r.id,
                onClick: () => openSearchResult(r),
                style: {
                  display: "block", width: "100%", textAlign: "left", cursor: "pointer",
                  background: "transparent", border: "none", padding: "11px 13px",
                  borderTop: i === 0 ? "none" : "1px solid " + T.line
                }
              },
                h("div", { style: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" } },
                  h("span", { style: { fontFamily: font.body, fontSize: fs(13), fontWeight: 800, color: T.ink, minWidth: 0 } }, r.title),
                  h("span", { style: { flex: "0 0 auto", fontFamily: font.body, fontSize: fs(10), fontWeight: 800, color: T.inkSoft } },
                    t(SEARCH_KIND_LABEL[r.kind]))),
                // Where it came from matters as much as what it says: a note
                // means something different under one claim than another.
                (r.claimName || r.date) ? h("div", { style: { fontSize: fs(10.5), color: T.blue, fontWeight: 700, marginTop: 2 } },
                  [r.claimName, r.date ? formatDate(r.date) : null].filter(Boolean).join("  \u00b7  ")) : null,
                r.sub ? h("div", { style: { fontSize: fs(11.5), color: T.inkSoft, marginTop: 3, lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } }, r.sub) : null
              ))
            )),
    h("button", {
      key: "x", onClick: () => setSearchOpen(false),
      style: { width: "100%", marginTop: 14, padding: "13px", borderRadius: 10, border: "1px solid " + T.line, background: T.btn2, fontFamily: font.body, fontSize: fs(13), fontWeight: 700, cursor: "pointer" }
    }, t("Close"))
  ]);

  const lockSetupSheet = () => sheet(() => setLockSetupOpen(false), [
    h("div", { key: "t", style: { fontFamily: font.display, fontSize: fs(20), color: T.heading, marginBottom: 3 } },
      lockRec ? t("Change or turn off the PIN") : t("Set a PIN")),
    h("div", { key: "b", style: { fontSize: fs(11.5), color: T.inkSoft, marginBottom: 12, lineHeight: 1.45 } },
      t("Four to eight numbers. There is no way to reset it, so choose something you will not forget.")),
    h(Field, { key: "p1", label: t("PIN") },
      h("input", {
        type: "password", inputMode: "numeric", autoComplete: "off", value: pinNew,
        onInput: (e) => { setPinNew(e.currentTarget.value.replace(/\D/g, "").slice(0, 8)); setPinError(""); },
        style: { ...inputStyle(), width: "100%", fontSize: fs(18), letterSpacing: 4 }
      })),
    h(Field, { key: "p2", label: t("PIN again") },
      h("input", {
        type: "password", inputMode: "numeric", autoComplete: "off", value: pinConfirm,
        onInput: (e) => { setPinConfirm(e.currentTarget.value.replace(/\D/g, "").slice(0, 8)); setPinError(""); },
        style: { ...inputStyle(), width: "100%", fontSize: fs(18), letterSpacing: 4 }
      })),
    pinError ? h("div", { key: "e", role: "alert", style: { fontSize: fs(11.5), color: T.red, marginBottom: 8 } }, pinError) : null,
    h("div", { key: "a", style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 4 } },
      h("button", { onClick: () => setLockSetupOpen(false), style: { padding: "13px", borderRadius: 10, border: "1px solid " + T.line, background: T.btn2, fontFamily: font.body, fontSize: fs(13), fontWeight: 700, cursor: "pointer" } }, t("Cancel")),
      h("button", { onClick: setUpLock, style: { padding: "13px", borderRadius: 10, border: "none", background: T.primary, color: "#fff", fontFamily: font.body, fontSize: fs(13), fontWeight: 800, cursor: "pointer" } }, t("Save"))),
    lockRec ? h("button", {
      key: "off", onClick: removeLock,
      style: { width: "100%", marginTop: 10, padding: "12px", borderRadius: 10, border: "1px solid " + T.red, background: T.btn2, color: T.red, fontFamily: font.body, fontSize: fs(12.5), fontWeight: 700, cursor: "pointer" }
    }, t("Turn the lock off")) : null
  ]);

  const timelineSheet = () => sheet(() => setTimelineOpen(false), [
    h("div", { key: "t", style: { fontFamily: font.display, fontSize: fs(20), color: T.heading, marginBottom: 3 } }, t("One line of time")),
    h("div", { key: "b", style: { fontSize: fs(11.5), color: T.inkSoft, marginBottom: 12, lineHeight: 1.45 } },
      t("Everything with a date, newest first. The same record you already have, read in order.")),
    timeline.length === 0
      ? h("div", { key: "none", style: { padding: "12px 14px", borderRadius: 10, border: "1px solid " + T.line, background: T.card } },
          h("div", { style: { fontFamily: font.body, fontSize: fs(12.5), fontWeight: 700, color: T.ink } }, t("Nothing dated yet")),
          h("div", { style: { fontSize: fs(11.5), color: T.inkSoft, marginTop: 3, lineHeight: 1.45 } },
            t("Once a step has a date and calls, letters or documents start going in, this fills itself.")))
      : h("div", { key: "rows" },
          timeline.map((r, i) => {
            const kind = TIMELINE_KIND[r.kind] || TIMELINE_KIND.stage;
            const dot = kind.tone === "blue" ? T.blue : kind.tone === "green" ? T.green : kind.tone === "amber" ? T.amber : T.line;
            return h("div", {
              key: r.kind + i + r.date,
              style: { display: "flex", gap: 10, alignItems: "flex-start" }
            },
              // A rail down the left, so the eye reads it as one sequence
              // rather than a stack of separate cards.
              h("div", { "aria-hidden": "true", style: { flex: "0 0 auto", width: 12, alignSelf: "stretch", display: "flex", flexDirection: "column", alignItems: "center" } },
                h("div", { style: { width: 9, height: 9, borderRadius: 999, background: dot, border: dot === T.line ? "1.5px solid " + T.inkSoft : "none", marginTop: fs(13) } }),
                i < timeline.length - 1 ? h("div", { style: { flex: 1, width: 1.5, background: T.line, minHeight: 14 } }) : null),
              h("div", { style: { flex: 1, minWidth: 0, paddingBottom: 12 } },
                h("div", { style: { fontSize: fs(10.5), color: T.inkSoft, fontWeight: 700 } },
                  formatDate(r.date) + "  \u00b7  " + t(kind.label)),
                h("div", { style: { fontFamily: font.body, fontSize: fs(13), fontWeight: 800, color: T.ink, marginTop: 1 } }, r.title),
                r.claimName ? h("div", { style: { fontSize: fs(11), color: T.blue, fontWeight: 700, marginTop: 1 } }, r.claimName) : null,
                r.detail ? h("div", { style: { fontSize: fs(11.5), color: T.inkSoft, marginTop: 2, lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } }, r.detail) : null)
            );
          })),
    h("button", {
      key: "x", onClick: () => setTimelineOpen(false),
      style: { width: "100%", marginTop: 10, padding: "13px", borderRadius: 10, border: "1px solid " + T.line, background: T.btn2, fontFamily: font.body, fontSize: fs(13), fontWeight: 700, cursor: "pointer" }
    }, t("Close"))
  ]);

  const guideSheet = () => sheet(() => setGuideOpen(false), [
    h("div", { key: "t", style: { fontFamily: font.display, fontSize: fs(20), color: T.heading, marginBottom: 3 } }, t("The first two weeks")),
    h("div", { key: "b", style: { fontSize: fs(11.5), color: T.inkSoft, marginBottom: 14, lineHeight: 1.45 } },
      t("The handful of things that are time-sensitive or expensive to get wrong. Every one checked against the government's own pages, the same standard as the Help numbers.")),

    guideSections(province).map((s) => h("div", { key: s.id, style: { marginBottom: 14 } },
      h("div", { style: { background: T.card, border: "1px solid " + T.line, borderRadius: 10, padding: "11px 13px" } },
        h("div", { style: { fontFamily: font.body, fontSize: fs(13), fontWeight: 800, color: T.ink } }, t(s.title)),
        h("div", { style: { fontSize: fs(11.5), color: T.inkSoft, marginTop: 4, lineHeight: 1.55 } }, t(s.body)),
        s.links.map((l) => h("a", {
          key: l.url, href: frUrl(l.url).url, target: "_blank", rel: "noopener noreferrer",
          style: { display: "inline-block", fontSize: fs(11), color: T.blue, fontWeight: 700, marginTop: 6, textDecoration: "none" }
        }, frUrl(l.url).english ? (t(l.label) + t(" (page in English)")) : t(l.label)))
      ))),

    h("div", { key: "so", style: { background: T.goldSoft, border: "1px solid " + T.gold, borderRadius: 10, padding: "12px 14px", fontSize: fs(12), color: T.ink, lineHeight: 1.55 } },
      h("b", null, t("None of this is legal, tax or financial advice.")),
      t(" The guide identifies common early tasks and official sources. Whether a step applies, what the will means, how an asset passes, and what should be filed are questions for the appropriate government office or a qualified professional.")),

    h("button", {
      key: "x", onClick: () => setGuideOpen(false),
      style: { width: "100%", marginTop: 12, padding: "13px", borderRadius: 10, border: "1px solid " + T.line, background: T.btn2, fontFamily: font.body, fontSize: fs(13), fontWeight: 700, cursor: "pointer" }
    }, t("Close"))
  ]);

  const conditionEditor = () => sheet(() => setCondOpen(false), [
    h("div", { key: "t", style: { fontFamily: font.display, fontSize: fs(20), color: T.heading, marginBottom: 12 } },
      condEditingId ? t("Edit this item") : t("Add to the inventory")),
    h(Field, { key: "n", label: t("What it is") },
      h("input", {
        value: bName, onInput: (e) => setBName(e.currentTarget.value),
        placeholder: t("The account, the property, the debt \u2014 in your own words"),
        style: { ...inputStyle(), width: "100%" }, autoComplete: "off"
      })),
    h(Field, { key: "a", label: t("What kind of thing") },
      h("select", { value: bArea, onChange: (e) => setBArea(e.currentTarget.value), style: { ...inputStyle(), width: "100%" } },
        BODY_AREAS.map((a) => h("option", { key: a.id, value: a.id }, t(a.label))))),
    h(Field, { key: "s", label: t("How it passes") },
      h("select", { value: bStatus, onChange: (e) => setBStatus(e.currentTarget.value), style: { ...inputStyle(), width: "100%" } },
        CONDITION_STATUSES.map((s) => h("option", { key: s.id, value: s.id }, t(s.label))))),
    h(Field, { key: "l", label: t("Institution or holder"), hint: t("Optional. Which bank, insurer, registry or company holds it.") },
      h("input", { value: bLinked, onInput: (e) => setBLinked(e.currentTarget.value), placeholder: t("Optional"), style: { ...inputStyle(), width: "100%" }, autoComplete: "off" })),
    h(Field, { key: "sy", label: t("Where it is held"), hint: t("Account number, address, or where to find it.") },
      h("textarea", { value: bSymptoms, onInput: (e) => setBSymptoms(e.currentTarget.value), rows: 3, style: { ...inputStyle(), width: "100%", resize: "vertical", lineHeight: 1.5 } })),
    h(Field, { key: "im", label: t("Value at the date of death"), hint: t("The balance or appraised value on the day of death. Write down where the figure came from.") },
      h("textarea", { value: bImpacts, onInput: (e) => setBImpacts(e.currentTarget.value), rows: 4, style: { ...inputStyle(), width: "100%", resize: "vertical", lineHeight: 1.5 } })),
    h("div", { key: "acts", style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 6 } },
      h("button", {
        onClick: () => setCondOpen(false),
        style: { padding: "13px", borderRadius: 10, border: "1px solid " + T.line, background: T.btn2, fontFamily: font.body, fontSize: fs(13), fontWeight: 700, cursor: "pointer" }
      }, t("Cancel")),
      h("button", {
        onClick: saveCondition, disabled: !bName.trim(),
        style: {
          padding: "13px", borderRadius: 10, border: "none", fontFamily: font.body, fontSize: fs(13), fontWeight: 800,
          cursor: bName.trim() ? "pointer" : "default",
          background: bName.trim() ? T.primary : "#B9BDCB", color: "#fff"
        }
      }, t("Save"))),
    condEditingId ? h("button", {
      key: "del",
      onClick: () => deleteCondition(condEditingId),
      style: { width: "100%", marginTop: 10, padding: "12px", borderRadius: 10, border: "1px solid " + T.red, background: T.btn2, color: T.red, fontFamily: font.body, fontSize: fs(12.5), fontWeight: 700, cursor: "pointer" }
    }, t("Remove this item")) : null
  ]);

  const condExportSheet = () => sheet(() => setCondExportOpen(false), [
    h("div", { key: "t", style: { fontFamily: font.display, fontSize: fs(20), color: T.heading, marginBottom: 3 } }, t("Your list, as text")),
    h("div", { key: "b", style: { fontSize: fs(11.5), color: T.inkSoft, marginBottom: 12, lineHeight: 1.45 } },
      t("Ready to paste into an email, a message or a form, or to read from in an appointment. It says at the top that these are your own words.")),
    h("textarea", { key: "ta", value: condExportText, readOnly: true, rows: 14,
      style: { ...inputStyle(), width: "100%", resize: "vertical", fontSize: fs(11), lineHeight: 1.45, fontFamily: "ui-monospace, Menlo, Consolas, monospace" } }),
    h("div", { key: "a", style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 } },
      h("button", { onClick: () => setCondExportOpen(false), style: { padding: "13px", borderRadius: 10, border: "1px solid " + T.line, background: T.btn2, fontFamily: font.body, fontSize: fs(13), fontWeight: 700, cursor: "pointer" } }, t("Close")),
      h("button", { onClick: copyCondExport, style: { padding: "13px", borderRadius: 10, border: "none", background: T.primary, color: "#fff", fontFamily: font.body, fontSize: fs(13), fontWeight: 800, cursor: "pointer" } }, t("Copy")))
  ]);

  const helpSheet = () => sheet(() => setHelpOpen(false), [
    h("div", { key: "t", style: { fontFamily: font.display, fontSize: fs(20), color: T.heading, marginBottom: 3 } }, t("Help")),
    h("div", { key: "b", style: { fontSize: fs(11.5), color: T.inkSoft, marginBottom: 14, lineHeight: 1.45 } },
      t("Tap any number to call it. These are kept in the app, so they are here with no signal and no data.")),

    helpSections(province).map((sec) => h("div", { key: sec.id, style: { marginBottom: 16 } },
      h("div", {
        style: {
          fontFamily: font.display, fontSize: fs(16),
          color: sec.tone === "urgent" ? T.red : T.heading, marginBottom: 3
        }
      }, t(sec.label)),
      h("div", { style: { fontSize: fs(11), color: T.inkSoft, marginBottom: 8, lineHeight: 1.45 } }, t(sec.note)),
      h("div", {
        style: {
          background: T.card, borderRadius: 10, overflow: "hidden",
          border: "1px solid " + (sec.tone === "urgent" ? T.red : T.line)
        }
      },
        sec.items.map((item, i) => h("div", {
          key: item.name,
          style: { padding: "12px 13px", borderTop: i === 0 ? "none" : "1px solid " + T.line }
        },
          h("div", { style: { fontFamily: font.body, fontSize: fs(13), fontWeight: 800, color: T.ink } }, t(item.name)),
          h("div", { style: { fontSize: fs(11.5), color: T.inkSoft, marginTop: 3, lineHeight: 1.5 } }, t(item.detail)),
          item.tel ? h("a", {
            href: telHref(item.tel),
            style: {
              display: "block", textAlign: "center", marginTop: 9, padding: "11px",
              borderRadius: 9, textDecoration: "none",
              background: sec.tone === "urgent" ? T.red : T.blue, color: T.onAccent,
              fontFamily: font.body, fontSize: fs(15), fontWeight: 800, letterSpacing: 0.3
            }
          }, item.tel) : null,
          item.url ? h("a", {
            href: item.url, target: "_blank", rel: "noopener noreferrer",
            style: {
              display: "block", textAlign: "center", marginTop: 9, padding: "11px",
              borderRadius: 9, textDecoration: "none", background: T.blueSoft, color: T.blue,
              fontFamily: font.body, fontSize: fs(12.5), fontWeight: 800
            }
          }, frUrl(item.url).english ? (t("Open their contact page") + t(" (page in English)")) : t("Open their contact page")) : null,
          item.alt ? h("div", {
            style: { fontSize: fs(10.5), color: T.inkSoft, marginTop: 6, textAlign: "center", lineHeight: 1.45, overflowWrap: "anywhere" }
          }, t(item.alt)) : null
        ))
      )
    )),

    h("div", { key: "c", style: { fontSize: fs(10.5), color: T.inkSoft, lineHeight: 1.45, marginTop: 4 } },
      t("Estate File is not affiliated with any government department, law firm or organisation on this page. These numbers are published by the organisations themselves.")),

    h("div", { key: "guide", style: { marginTop: 18 } },
      h("div", { style: { fontFamily: font.display, fontSize: fs(16), color: T.heading, marginBottom: 3 } },
        t("Using Estate File")),
      h("div", { style: { fontSize: fs(11.5), color: T.inkSoft, marginBottom: 8, lineHeight: 1.5 } },
        t("Your own organised record of estate steps, inventory items, documents, dates, benefits and probate progress. It is not connected to any government service.")),
      h("div", { style: { background: T.card, border: "1px solid " + T.line, borderRadius: 10, overflow: "hidden" } },
        TABS.map((tb, i) => h("div", {
          key: tb.id,
          style: { padding: "10px 13px", borderTop: i === 0 ? "none" : "1px solid " + T.line }
        },
          h("span", { style: { fontFamily: font.body, fontSize: fs(12.5), fontWeight: 800, color: T.ink } },
            tb.label.replace(/ ?\(\d+\)$/, "")),
          h("span", { style: { fontSize: fs(11.5), color: T.inkSoft, lineHeight: 1.5 } },
            " \u2014 " + t(tb.about))
        ))),
      h("div", { style: { fontSize: fs(10.5), color: T.inkSoft, marginTop: 8, lineHeight: 1.5 } },
        t("Privacy, backups and appearance all live under Settings, and the introduction shown on first launch covers the rest."))),

    h("button", {
      key: "x", onClick: () => setHelpOpen(false),
      style: { width: "100%", marginTop: 12, padding: "13px", borderRadius: 10, border: "1px solid " + T.line, background: T.btn2, fontFamily: font.body, fontSize: fs(13), fontWeight: 700, cursor: "pointer" }
    }, t("Close"))
  ]);

  const settingsScreen = () => h("div", { style: { padding: 16 } },
    h("div", { style: { fontFamily: font.display, fontSize: fs(20), color: T.heading, marginBottom: 3 } }, t("Estate province or territory")),
    h("div", { style: { fontSize: fs(11.5), color: T.inkSoft, marginBottom: 8, lineHeight: 1.45 } },
      t("Choose the province or territory whose estate rules apply. All 13 Canadian jurisdictions are supported. Federal information stays Canada-wide; Quebec uses QPP survivor benefits, and Probate / Succession, local estate information, Help and the guide change with this choice.")),
    provincePicker(24),

    // Language is kept independent of the estate record. Each option is
    // written in its own language so it remains findable from either side.
    h("div", { style: { fontFamily: font.display, fontSize: fs(20), color: T.heading, marginBottom: 3 } }, t("Language")),
    h("div", { style: { fontSize: fs(11.5), color: T.inkSoft, marginBottom: 8, lineHeight: 1.45 } },
      t("Your estate record and everything you have written stay exactly as they are.")),
    h("div", { role: "group", "aria-label": t("Language"), style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 24 } },
      [["en", "English"], ["fr", "Fran\u00e7ais"]].map((pair) => h("button", {
        key: pair[0],
        onClick: () => chooseLang(pair[0]),
        "aria-pressed": lang === pair[0] ? "true" : "false",
        lang: pair[0],
        style: {
          padding: "12px", borderRadius: 10, cursor: "pointer",
          border: "1.5px solid " + (lang === pair[0] ? T.primary : T.line),
          background: lang === pair[0] ? T.primary : "#fff",
          color: lang === pair[0] ? "#fff" : T.ink,
          fontFamily: font.body, fontSize: fs(13.5), fontWeight: lang === pair[0] ? 800 : 600
        }
      }, pair[1]))),

    h("div", { style: { fontFamily: font.display, fontSize: fs(20), color: T.heading, marginBottom: 3 } }, t("Appearance")),
    h("div", { style: { fontSize: fs(11.5), color: T.inkSoft, marginBottom: 8, lineHeight: 1.45 } },
      t("Night is easier on the eyes in the dark, and on light sensitivity generally. Follow the phone switches when it does.")),
    h("div", { role: "group", "aria-label": t("Appearance"), style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 24 } },
      THEMES.map((s) => h("button", {
        key: s.id,
        onClick: () => chooseTheme(s.id),
        "aria-pressed": themeChoice === s.id ? "true" : "false",
        style: {
          padding: "12px 6px", borderRadius: 10, cursor: "pointer",
          border: "1.5px solid " + (themeChoice === s.id ? T.heading : T.line),
          background: themeChoice === s.id ? T.primary : T.btn2,
          color: themeChoice === s.id ? "#fff" : T.ink,
          fontFamily: font.body, fontSize: fs(12), fontWeight: themeChoice === s.id ? 800 : 600
        }
      }, t(s.label)))),

    h("div", { style: { fontFamily: font.display, fontSize: fs(20), color: T.heading, marginBottom: 3 } }, t("Text size")),
    h("div", { style: { fontSize: fs(11.5), color: T.inkSoft, marginBottom: 8, lineHeight: 1.45 } },
      t("Everything in the app grows together. Your record is not affected.")),
    // Each option is drawn at the size it sets, so the choice is made by
    // looking rather than by guessing what a word means.
    h("div", { role: "group", "aria-label": t("Text size"), style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 24 } },
      TEXT_SIZES.map((s) => h("button", {
        key: s.id,
        onClick: () => chooseTextSize(s.id),
        "aria-pressed": textSize === s.id ? "true" : "false",
        style: {
          padding: "12px 10px", borderRadius: 10, cursor: "pointer",
          border: "1.5px solid " + (textSize === s.id ? T.primary : T.line),
          background: textSize === s.id ? T.primary : "#fff",
          color: textSize === s.id ? "#fff" : T.ink,
          fontFamily: font.body, fontSize: Math.round(13 * s.scale * 10) / 10,
          fontWeight: textSize === s.id ? 800 : 600
        }
      }, t(s.label)))),

    h("div", { style: { fontFamily: font.display, fontSize: fs(20), color: T.heading, marginBottom: 3 } }, t("Your record")),
    h("div", { style: { fontSize: fs(11.5), color: T.inkSoft, marginBottom: 12, lineHeight: 1.45 } },
      t("All of it lives on this device. There is no account and no server, which is why it works with no signal, and also why a reinstall would take it with it.")),
    h("div", { style: { background: T.card, border: "1px solid " + T.line, borderRadius: 10, padding: "12px 14px", marginBottom: 10 } },
      [[t("Steps"), claims.length],
       [t("Estate inventory"), conditions.length],
       [t("Documents"), docMeta.length],
       [t("Contact log entries"), contacts.length],
       [t("Reminders"), reminders.length]].map(([label, n], i) =>
        h("div", { key: label, style: { display: "flex", justifyContent: "space-between", gap: 10, padding: "5px 0", borderTop: i === 0 ? "none" : "1px solid " + T.line, fontFamily: font.body, fontSize: fs(12.5) } },
          h("span", { style: { color: T.ink } }, label),
          h("span", { style: { color: T.inkSoft } }, n)))
    ),
    h("button", {
      onClick: openWholeFile,
      disabled: !(claims.length || conditions.length || contacts.length),
      style: {
        width: "100%", padding: "12px", borderRadius: 10, border: "none",
        background: (claims.length || conditions.length || contacts.length) ? T.primary : "#B9BDCB",
        color: "#fff", fontFamily: font.body, fontWeight: 800, fontSize: fs(13.5),
        cursor: (claims.length || conditions.length || contacts.length) ? "pointer" : "default",
        marginBottom: 8
      }
    }, t("Print your whole file")),
    h("div", { style: { fontSize: fs(10.5), color: T.inkSoft, marginBottom: 16, lineHeight: 1.45 } },
      t("Everything in one document, useful for a lawyer, accountant, co-executor or your own paper records.")),

    h("button", {
      onClick: openBackup,
      style: { width: "100%", padding: "13px", borderRadius: 10, border: "none", background: T.primary, color: "#fff", fontFamily: font.body, fontWeight: 800, fontSize: fs(13.5), cursor: "pointer", marginBottom: 24 }
    }, t("Back up or restore")),

    h("div", { style: { fontFamily: font.display, fontSize: fs(20), color: T.heading, marginBottom: 3 } }, t("Lock")),
    h("div", { style: { fontSize: fs(11.5), color: T.inkSoft, marginBottom: 8, lineHeight: 1.45 } },
      lockRec
        ? t("A PIN is asked for when the app opens.")
        : t("Ask for a PIN when the app opens, so a phone left on a table does not show your file.")),
    // The limit is stated on the control itself, not buried in About. A
    // person deciding whether this protects them deserves the true answer
    // where they are making the decision.
    h("div", { style: { background: T.goldSoft, border: "1px solid " + T.gold, borderRadius: 10, padding: "10px 12px", fontSize: fs(11), color: T.ink, lineHeight: 1.5, marginBottom: 8 } },
      h("b", null, t("This is a screen, not encryption.")),
      t(" It stops someone picking up your phone and reading your file. It does not protect the record from anyone who knows their way around the device.")),
    h("button", {
      onClick: () => { setPinNew(""); setPinConfirm(""); setPinError(""); setLockSetupOpen(true); },
      style: {
        width: "100%", padding: "12px", borderRadius: 10, cursor: "pointer",
        border: "1px solid " + T.line, background: T.card, color: T.ink,
        fontFamily: font.body, fontWeight: 700, fontSize: fs(13), marginBottom: 24
      }
    }, lockRec ? t("Change or turn off the PIN") : t("Set a PIN")),

    h("div", { style: { fontFamily: font.display, fontSize: fs(20), color: T.heading, marginBottom: 3 } }, t("Getting help")),
    h("div", { style: { background: T.card, border: "1px solid " + T.line, borderRadius: 10, padding: "12px 14px", fontSize: fs(12), color: T.ink, lineHeight: 1.55, marginBottom: 24 } },
      t("Legal-help routes differ by province or territory. Help shows the current route for ") + t(provinceDef(province).label) + t(", along with the government numbers and grief supports that apply."),
      h("div", { style: { marginTop: 8, color: T.inkSoft } }, t("All the numbers are under Help, at the top of any screen."))
    ),

    h("div", { style: { fontFamily: font.display, fontSize: fs(20), color: T.heading, marginBottom: 3 } }, t("About")),
    h("div", { style: { background: T.card, border: "1px solid " + T.line, borderRadius: 10, padding: "12px 14px", fontSize: fs(12), color: T.inkSoft, lineHeight: 1.55 } },
      h("div", { style: { color: T.ink, fontFamily: font.body, fontSize: fs(13), marginBottom: 6 } }, t("Estate File "), APP_VERSION),
      // The app's address, written where somebody will look for it: for
      // putting it on another phone or sharing it with a co-executor. A link
      // and selectable text both, because a
      // person sharing it needs to copy it more often than visit it.
      h("div", { style: { marginBottom: 8 } },
        h("a", {
          href: "https://estate-file-wheat.vercel.app",
          target: "_blank", rel: "noopener noreferrer",
          style: { color: T.blue, fontFamily: font.body, fontSize: fs(12.5), fontWeight: 700, textDecoration: "none", userSelect: "text", WebkitUserSelect: "text" }
        }, "estate-file-wheat.vercel.app"),
        h("div", { style: { fontSize: fs(10.5), color: T.inkSoft, marginTop: 2, lineHeight: 1.45 } },
          t(t("The app's address. Open it in Safari on any phone and add it to the home screen.")))),
      t("Estate File is not affiliated with, endorsed by, or connected to any government department, court, law firm or accountancy practice. It reads no file and submits nothing on your behalf. It is a private place to keep your own record."),
      h("div", { style: { marginTop: 8 } },
        province === "QC" ? t("The Succession tab uses published Quebec succession rules checked in ") + RATES_READ + t(". Quebec has no estate-value probate tax; the app records the civil-law process and known public registration fees without pretending to price notary or court work.") : t("The Probate tab uses the published ") + t(provinceDef(province).label) + t(" fee rules checked in ") + RATES_READ + t(". It shows arithmetic on a value you enter. It does not decide what the estate is worth, whether a court grant is needed, or how any asset passes. Those are legal questions.")),
      h("div", { style: { marginTop: 8 } },
        t("Nothing here is legal, tax or financial advice. Benefit eligibility is decided by the responsible government authority; legal questions about the will, probate or a Quebec succession belong with a qualified legal professional.")),
      h("div", { style: { marginTop: 8 } },
        t("No account, no server, no adverts, and nothing leaves this device.")),
      // The one line saying whose this is. The app states in five places what
      // it is not (not the government, not a law firm); this is where it says what
      // it IS: one person's work, owned. Anyone doing due diligence - a
      // clinic, a lawyer, a department - looks here first.
      h("div", { style: { marginTop: 8, color: T.ink, fontWeight: 700 } },
        "\u00a9 2026 Richard J. Allinson. ", t("All rights reserved."))
    )
  );

  // ---------- sheets ----------

  const sheet = (onClose, children) => h("div", {
    onClick: onClose,
    style: { position: "fixed", inset: 0, background: resolveTheme(themeChoiceRef.current) === "dark" ? "rgba(0,0,0,0.6)" : "rgba(20,26,51,0.55)", display: "flex", alignItems: "flex-end", zIndex: 75 }
  },
    h("div", {
      onClick: (e) => e.stopPropagation(),
      style: { background: T.cream, width: "100%", maxHeight: "90vh", overflowY: "auto", borderRadius: "16px 16px 0 0", padding: 18, paddingBottom: "calc(18px + env(safe-area-inset-bottom))" }
    }, children)
  );

  const claimEditor = () => sheet(() => setEditorOpen(false), [
    h("div", { key: "t", style: { fontFamily: font.display, fontSize: fs(20), color: T.heading, marginBottom: 12 } },
      editingId ? t("Edit step") : t("Add a step")),
    h(Field, { key: "cond", label: t("What it is") },
      h("input", {
        value: cCondition, onInput: (e) => setCCondition(e.currentTarget.value),
        placeholder: t("e.g. Cancel CPP and OAS"),
        style: { ...inputStyle(), width: "100%" }, autoComplete: "off"
      })),
    h(Field, { key: "type", label: t("Category") },
      h("select", { value: cType, onChange: (e) => setCType(e.currentTarget.value), style: { ...inputStyle(), width: "100%" } },
        BENEFIT_TYPES.map((bt) => h("option", { key: bt, value: bt }, t(bt))))),
    h(Field, { key: "applied", label: t("Date started"), hint: t("The date you began, sent or made this step. Elapsed time on the card is counted from here.") },
      h("input", { type: "date", value: cApplied, onInput: (e) => setCApplied(e.currentTarget.value), style: { ...inputStyle(), width: "100%" } })),
    h(Field, { key: "stage", label: t("Where it stands") },
      h("select", { value: cStage, onChange: (e) => setCStage(e.currentTarget.value), style: { ...inputStyle(), width: "100%" } },
        STAGES.map((s) => h("option", { key: s.id, value: s.id }, t(s.label))))),
    h(Field, { key: "file", label: t("Reference number"), hint: t("Optional. A file or confirmation number, handy when you call back.") },
      h("input", { value: cFile, onInput: (e) => setCFile(e.currentTarget.value), placeholder: t("Optional"), style: { ...inputStyle(), width: "100%" }, autoComplete: "off" })),
    h(Field, { key: "notes", label: t("Notes") },
      h("textarea", { value: cNotes, onInput: (e) => setCNotes(e.currentTarget.value), rows: 4, placeholder: t("Anything you want to remember about this one"), style: { ...inputStyle(), width: "100%", resize: "vertical", lineHeight: 1.5 } })),
    h("div", { key: "acts", style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 6 } },
      h("button", {
        onClick: () => setEditorOpen(false),
        style: { padding: "13px", borderRadius: 10, border: "1px solid " + T.line, background: T.btn2, fontFamily: font.body, fontSize: fs(13), fontWeight: 700, cursor: "pointer" }
      }, t("Cancel")),
      h("button", {
        onClick: saveClaim, disabled: !cCondition.trim(),
        style: {
          padding: "13px", borderRadius: 10, border: "none", fontFamily: font.body, fontSize: fs(13), fontWeight: 800,
          cursor: cCondition.trim() ? "pointer" : "default",
          background: cCondition.trim() ? T.primary : "#B9BDCB", color: "#fff"
        }
      }, editingId ? t("Save changes") : t("Add step"))),
    editingId ? h("button", {
      key: "del",
      onClick: () => deleteClaim(editingId),
      style: { width: "100%", marginTop: 10, padding: "12px", borderRadius: 10, border: "1px solid " + T.red, background: T.btn2, color: T.red, fontFamily: font.body, fontSize: fs(12.5), fontWeight: 700, cursor: "pointer" }
    }, t("Delete this step and everything in it")) : null
  ]);

  const reminderSheet = () => sheet(() => setRemOpen(false), [
    h("div", { key: "t", style: { fontFamily: font.display, fontSize: fs(20), color: T.heading, marginBottom: 12 } }, t("Add a reminder")),
    h(Field, { key: "l", label: t("What is it") },
      h("input", { value: remLabel, onInput: (e) => setRemLabel(e.currentTarget.value), placeholder: t("e.g. Reconsideration letter must be in"), style: { ...inputStyle(), width: "100%" }, autoComplete: "off" })),
    h(Field, { key: "d", label: t("Date"), hint: t("Take this from the letter or the certificate. The app does not work out deadlines for you.") },
      h("input", { type: "date", value: remDate, onInput: (e) => setRemDate(e.currentTarget.value), style: { ...inputStyle(), width: "100%" } })),
    h(Field, { key: "c", label: t("Step") },
      h("select", { value: remClaim, onChange: (e) => setRemClaim(e.currentTarget.value), style: { ...inputStyle(), width: "100%" } },
        [h("option", { key: "none", value: "" }, t("Not tied to a step"))].concat(
          claims.map((c) => h("option", { key: c.id, value: c.id }, c.condition))))),
    h("div", { key: "a", style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 6 } },
      h("button", { onClick: () => setRemOpen(false), style: { padding: "13px", borderRadius: 10, border: "1px solid " + T.line, background: T.btn2, fontFamily: font.body, fontSize: fs(13), fontWeight: 700, cursor: "pointer" } }, t("Cancel")),
      h("button", {
        onClick: addReminder, disabled: !remLabel.trim(),
        style: { padding: "13px", borderRadius: 10, border: "none", fontFamily: font.body, fontSize: fs(13), fontWeight: 800, cursor: remLabel.trim() ? "pointer" : "default", background: remLabel.trim() ? T.primary : "#B9BDCB", color: "#fff" }
      }, t("Add reminder")))
  ]);

  const logSheet = () => sheet(() => setLogOpen(false), [
    h("div", { key: "t", style: { fontFamily: font.display, fontSize: fs(20), color: T.heading, marginBottom: 3 } }, t("Log a contact")),
    h("div", { key: "b", style: { fontSize: fs(11.5), color: T.inkSoft, marginBottom: 12, lineHeight: 1.45 } },
      t("Write it down while it is fresh. Who you spoke to, when, and what they told you.")),
    h(Field, { key: "w", label: t("Who you spoke to") },
      h("input", { value: logWho, onInput: (e) => setLogWho(e.currentTarget.value), placeholder: t("e.g. bank, CRA agent, first name"), style: { ...inputStyle(), width: "100%" }, autoComplete: "off" })),
    h(Field, { key: "d", label: t("Date") },
      h("input", { type: "date", value: logDate, onInput: (e) => setLogDate(e.currentTarget.value), style: { ...inputStyle(), width: "100%" } })),
    h(Field, { key: "s", label: t("What was said") },
      h("textarea", { value: logSummary, onInput: (e) => setLogSummary(e.currentTarget.value), rows: 5, placeholder: t("What you asked, what they said, anything they promised to do"), style: { ...inputStyle(), width: "100%", resize: "vertical", lineHeight: 1.5 } })),
    h(Field, { key: "c", label: t("Step") },
      h("select", { value: logClaim, onChange: (e) => setLogClaim(e.currentTarget.value), style: { ...inputStyle(), width: "100%" } },
        [h("option", { key: "none", value: "" }, t("Not tied to a step"))].concat(
          claims.map((c) => h("option", { key: c.id, value: c.id }, c.condition))))),
    h("div", { key: "a", style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 6 } },
      h("button", { onClick: () => setLogOpen(false), style: { padding: "13px", borderRadius: 10, border: "1px solid " + T.line, background: T.btn2, fontFamily: font.body, fontSize: fs(13), fontWeight: 700, cursor: "pointer" } }, t("Cancel")),
      h("button", {
        onClick: addContact, disabled: !logWho.trim(),
        style: { padding: "13px", borderRadius: 10, border: "none", fontFamily: font.body, fontSize: fs(13), fontWeight: 800, cursor: logWho.trim() ? "pointer" : "default", background: logWho.trim() ? T.primary : "#B9BDCB", color: "#fff" }
      }, t("Save entry")))
  ]);

  const docViewer = () => sheet(() => setViewingDoc(null), [
    h("div", { key: "t", style: { fontFamily: font.display, fontSize: fs(18), color: T.heading, marginBottom: 8, overflowWrap: "anywhere" } }, viewingDoc.title),
    viewingDoc.kind === "pdf"
      // A data-url PDF will not reliably render inside a web view, and an
      // embedded viewer would be a large dependency for something the phone
      // already does well. Opening it hands the file to the system viewer,
      // where the person can also print it or send it on.
      ? h("div", { key: "p" },
          h("div", {
            style: {
              background: T.blueSoft, border: "1px solid " + T.line, borderRadius: 10,
              padding: "26px 16px", textAlign: "center"
            }
          },
            h("div", { style: { fontFamily: font.body, fontSize: fs(15), fontWeight: 900, color: T.blue, letterSpacing: 0.5 } }, "PDF"),
            h("div", { style: { fontSize: fs(11.5), color: T.inkSoft, marginTop: 6, lineHeight: 1.5 } },
              t("Kept on this phone. Opening it uses your normal PDF viewer, where you can also print it or send it on."))
          ),
          h("a", {
            href: viewingDoc.full, target: "_blank", rel: "noopener noreferrer",
            style: {
              display: "block", textAlign: "center", marginTop: 10, padding: "12px",
              borderRadius: 9, background: T.blue, color: T.onAccent, textDecoration: "none",
              fontFamily: font.body, fontSize: fs(13), fontWeight: 800
            }
          }, t("Open this PDF"))
        )
      : h("img", { key: "i", src: viewingDoc.full, alt: viewingDoc.title, style: { display: "block", width: "100%", borderRadius: 10, border: "1px solid " + T.line } }),
    h("div", { key: "d", style: { fontSize: fs(11), color: T.inkSoft, marginTop: 8 } }, t("Added "), formatDate(viewingDoc.addedAt)),
    h("div", { key: "a", style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 } },
      h("button", { onClick: () => setViewingDoc(null), style: { padding: "13px", borderRadius: 10, border: "1px solid " + T.line, background: T.btn2, fontFamily: font.body, fontSize: fs(13), fontWeight: 700, cursor: "pointer" } }, t("Close")),
      h("button", {
        onClick: () => deleteDocument(viewingDoc.id),
        style: { padding: "13px", borderRadius: 10, border: "1px solid " + T.red, background: T.btn2, color: T.red, fontFamily: font.body, fontSize: fs(13), fontWeight: 700, cursor: "pointer" }
      }, t("Remove")))
  ]);

  const backupSheet = () => sheet(() => setBackupOpen(false), [
    h("div", { key: "t", style: { fontFamily: font.display, fontSize: fs(20), color: T.heading, marginBottom: 3 } }, t("Back up your record")),
    h("div", { key: "b", style: { fontSize: fs(11.5), color: T.inkSoft, marginBottom: 12, lineHeight: 1.45 } },
      t("Everything lives on this device. A backup is the only thing standing between a lost phone and starting again.")),

    // The file backup is first and is the recommended one, because it is the
    // only one that carries the documents. The paste-a-text version stays
    // below it: it needs no file handling, no storage app and no
    // understanding of where a download went, and for somebody who just wants
    // their claims safe in an email to themselves it is still the shorter road.
    h("div", { key: "fb", style: { background: T.card, border: "1px solid " + T.line, borderRadius: 10, padding: "12px 14px", marginBottom: 14 } },
      h("div", { style: { fontFamily: font.body, fontSize: fs(13), fontWeight: 800, color: T.ink } }, t("A file, with your documents")),
      h("div", { style: { fontSize: fs(11.5), color: T.inkSoft, marginTop: 3, lineHeight: 1.5 } },
        t("Everything you have typed and every letter you have photographed, in one file. Save it to iCloud or Files, or email it to yourself. This is the one that survives a lost phone.")),
      h("button", {
        onClick: downloadFullBackup,
        disabled: fullBackupBusy,
        style: {
          width: "100%", marginTop: 10, padding: "13px", borderRadius: 10, border: "none",
          background: fullBackupBusy ? "#B9BDCB" : T.primary, color: "#fff",
          fontFamily: font.body, fontSize: fs(13), fontWeight: 800,
          cursor: fullBackupBusy ? "default" : "pointer"
        }
      }, fullBackupBusy ? t("Working...") : t("Make a backup file")),
      h("label", {
        style: {
          display: "block", width: "100%", marginTop: 8, padding: "13px", borderRadius: 10,
          border: "1px solid " + T.line, background: T.btn2, color: T.ink, textAlign: "center",
          fontFamily: font.body, fontSize: fs(13), fontWeight: 700, cursor: "pointer"
        }
      },
        t("Restore from a backup file"),
        h("input", {
          type: "file", accept: "application/json,.json",
          style: { display: "none" },
          onChange: (e) => {
            const f = e.currentTarget.files && e.currentTarget.files[0];
            e.currentTarget.value = "";
            restoreFromFile(f);
          }
        })),
      h("div", { style: { fontSize: fs(10.5), color: T.inkSoft, marginTop: 8, lineHeight: 1.45 } },
        t("Restoring replaces what is on this device. It does not merge."))
    ),

    h("div", { key: "tl", style: { ...labelStyle() } }, t("Or copy the text")),
    h("div", { key: "b2", style: { fontSize: fs(11), color: T.inkSoft, marginBottom: 8, lineHeight: 1.45 } },
      t("Steps, inventory items, calls and notes, but not the documents. Small enough to paste into an email or a note.")),
    h("textarea", { key: "ta", value: backupText, readOnly: true, rows: 5, style: { ...inputStyle(), width: "100%", resize: "vertical", fontSize: fs(11), lineHeight: 1.4 } }),
    h("button", {
      key: "copy", onClick: copyBackup,
      style: { width: "100%", marginTop: 8, padding: "12px", borderRadius: 10, border: "none", background: T.primary, color: "#fff", fontFamily: font.body, fontSize: fs(13), fontWeight: 800, cursor: "pointer" }
    }, t("Copy backup")),
    h("div", { key: "rl", style: { ...labelStyle(), marginTop: 20 } }, t("Restore")),
    h("textarea", {
      key: "rt", value: restoreText, onInput: (e) => setRestoreText(e.currentTarget.value), rows: 4,
      placeholder: t("Paste a backup here to replace what is on this device"),
      style: { ...inputStyle(), width: "100%", resize: "vertical", fontSize: fs(11), lineHeight: 1.4 }
    }),
    h("button", {
      key: "rb", onClick: runRestore, disabled: !restoreText.trim(),
      style: { width: "100%", marginTop: 8, padding: "12px", borderRadius: 10, border: "1px solid " + T.line, background: restoreText.trim() ? "#fff" : "#F4F1E8", color: T.ink, fontFamily: font.body, fontSize: fs(12.5), fontWeight: 700, cursor: restoreText.trim() ? "pointer" : "default" }
    }, t("Replace everything with this backup"))
  ]);


  // ---------- Start Here ----------
  const updateStartTask = (id, patch) => {
    setStartChecklist((cur) => ({ ...cur, [id]: { ...(cur[id] || {}), ...patch } }));
  };
  const toggleStartTask = (id) => {
    const cur = startChecklist[id] || {};
    const done = !cur.done;
    updateStartTask(id, { done, date: done && !cur.date ? todayISO() : (cur.date || "") });
  };
  const startScreen = () => {
    const doneCount = START_TASKS.filter((task) => (startChecklist[task.id] || {}).done).length;
    const pct = Math.round((doneCount / START_TASKS.length) * 100);
    return h("main", { style: { padding: "18px 16px 28px", maxWidth: 760, margin: "0 auto" } },
      h("div", { style: { background: T.card, border: "1px solid " + T.line, borderRadius: 16, padding: 16, marginBottom: 16 } },
        h("div", { style: { fontFamily: font.display, fontWeight: 700, fontSize: fs(25), color: T.heading } }, t("Start Here")),
        h("div", { style: { marginTop: 6, fontSize: fs(13), color: T.inkSoft, lineHeight: 1.55 } },
          t("You do not need to know how to settle an estate before you begin. Work down this list in order, one item at a time. Some steps overlap or may not apply to every estate.")),
        h("div", { style: { marginTop: 14, display: "flex", alignItems: "center", gap: 12 } },
          h("div", { style: { flex: 1, height: 9, borderRadius: 99, background: T.line, overflow: "hidden" } },
            h("div", { style: { width: pct + "%", height: "100%", background: T.green, borderRadius: 99, transition: "width .2s ease" } })
          ),
          h("div", { style: { fontSize: fs(12), fontWeight: 800, color: T.ink, whiteSpace: "nowrap" } }, doneCount + " / " + START_TASKS.length)
        ),
        h("div", { style: { marginTop: 10, fontSize: fs(10.5), color: T.inkSoft, lineHeight: 1.45 } },
          t("This checklist is an organizer, not legal, tax or financial advice. Requirements and timing depend on the estate and jurisdiction."))
      ),
      START_GROUPS.map((group) => {
        const tasks = START_TASKS.filter((task) => task.group === group.id);
        return h("section", { key: group.id, style: { marginBottom: 22 } },
          h("div", { style: { margin: "0 2px 10px" } },
            h("div", { style: { fontFamily: font.display, fontSize: fs(19), fontWeight: 700, color: T.heading } }, t(group.title)),
            h("div", { style: { fontSize: fs(11.5), color: T.inkSoft, marginTop: 3, lineHeight: 1.4 } }, t(group.blurb))
          ),
          tasks.map((task) => {
            const rec = startChecklist[task.id] || {};
            const open = startOpen === task.id;
            return h("div", { key: task.id, style: { background: T.card, border: "1px solid " + (rec.done ? T.green : T.line), borderRadius: 13, marginBottom: 9, overflow: "hidden" } },
              h("div", { style: { display: "flex", alignItems: "stretch" } },
                h("button", {
                  onClick: () => toggleStartTask(task.id),
                  "aria-label": t(rec.done ? "Mark incomplete: " : "Mark complete: ") + t(task.title),
                  "aria-pressed": rec.done ? "true" : "false",
                  style: { width: 58, flex: "0 0 58px", border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }
                }, h("span", { "aria-hidden": "true", style: { width: 27, height: 27, borderRadius: 7, border: "2px solid " + (rec.done ? T.green : T.inkSoft), background: rec.done ? T.green : "transparent", color: rec.done ? T.onAccent : "transparent", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: fs(18), lineHeight: 1 } }, "✓")),
                h("button", {
                  onClick: () => setStartOpen(open ? null : task.id),
                  "aria-expanded": open ? "true" : "false",
                  style: { flex: 1, minWidth: 0, textAlign: "left", border: "none", background: "transparent", padding: "13px 12px 13px 0", cursor: "pointer", color: T.ink }
                },
                  h("div", { style: { fontSize: fs(13.5), fontWeight: 750, lineHeight: 1.35, textDecoration: rec.done ? "line-through" : "none", opacity: rec.done ? .72 : 1 } }, t(task.title)),
                  h("div", { style: { fontSize: fs(10.5), color: T.inkSoft, marginTop: 4 } },
                    rec.date ? t("Date: ") + rec.date : t("Tap for date, notes and details"))
                )
              ),
              open ? h("div", { style: { borderTop: "1px solid " + T.line, padding: "13px 14px 15px 58px" } },
                h("div", { style: { fontSize: fs(11.5), color: T.inkSoft, lineHeight: 1.5, marginBottom: 12 } }, t(task.detail)),
                h(Field, { label: t("Date completed / action date") },
                  h("input", { type: "date", value: rec.date || "", onInput: (e) => updateStartTask(task.id, { date: e.currentTarget.value }), style: { ...inputStyle(), width: "100%" } })
                ),
                h(Field, { label: t("Notes") },
                  h("textarea", { value: rec.notes || "", rows: 3, placeholder: t("Add a note, reference number, person you spoke with, or what still needs to happen"), onInput: (e) => updateStartTask(task.id, { notes: e.currentTarget.value }), style: { ...inputStyle(), width: "100%", resize: "vertical", lineHeight: 1.45 } })
                )
              ) : null
            );
          })
        );
      })
    );
  };

  // ---------- shell ----------

  // Settings is app configuration rather than estate work, so it lives in the
  // persistent header cog. The work navigation below contains only the
  // executor-facing sections and has more room on narrow phones.
  const TABS = [
    { id: "start", label: t("Start Here"),
      about: "An ordered checklist for getting started and keeping track of what has been completed." },
    { id: "claims", label: t("Steps"),
      about: "Every notification and filing: where each one stands, your notes, documents, and every call logged." },
    { id: "body", label: t("Estate"),
      about: "The estate inventory: every account, property and debt, what it is worth, and how it passes. Courts, provincial or territorial filings and the CRA can all need parts of this same record." },
    { id: "reminders", label: dueCount ? t("Dates (") + dueCount + ")" : t("Dates"),
      about: "Dates you have been given: a 180-day return, a court date, a form due back. The app keeps the ones you enter; it does not work out your deadlines for you." },
    { id: "documents", label: t("Docs"),
      about: "Photographs and PDFs of statements of death, the will, certificates and letters, kept on this phone." },
    { id: "benefits", label: t("Benefits"),
      about: province === "QC" ? "Quebec Pension Plan survivor benefits, federal support and Quebec succession information. It does not decide eligibility; use Retraite Québec and the responsible government authority." : "Benefits and support that may be available to a survivor or the estate, plus the calls that stop payments going out incorrectly. It does not decide eligibility; the responsible government authority does." },
    { id: "estimate", label: t(province === "QC" ? "Succession" : "Probate"),
      about: province === "QC" ? "Quebec succession / will-verification information, RDPRM steps and liquidator process tracking. Information, not legal advice." : provinceDef(province).label + " probate / grant fees from an estate value, plus the jurisdiction-specific process tracker. Arithmetic, not legal advice." }
  ];

  // First run sits in front of the app, after the lock rather than before it:
  // somebody restoring onto a new phone should be asked for their PIN first,
  // not walked through an introduction they have seen.
  const introScreen = () => {
    const card = INTRO_CARDS[introStep];
    const last = introStep === INTRO_CARDS.length - 1;
    return h("div", {
      style: {
        fontFamily: font.body, color: T.cream, background: T.header,
        minHeight: "100vh", display: "flex", flexDirection: "column",
        justifyContent: "space-between", padding: "calc(28px + env(safe-area-inset-top)) 22px calc(24px + env(safe-area-inset-bottom))"
      }
    },
      h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
        h(MapleLeaf, { size: fs(30) }),
        // Skip is on every card, not hidden behind the last one. Nobody
        // should have to page through an introduction to reach their file.
        h("button", {
          onClick: dismissIntro,
          style: {
            background: "transparent", border: "none", cursor: "pointer",
            color: T.cream, opacity: 0.7, fontFamily: font.body, fontSize: fs(12.5), fontWeight: 700,
            padding: "6px 2px"
          }
        }, t("Skip"))),

      h("div", { style: { maxWidth: 420 } },
        h("div", { style: { fontFamily: font.display, fontWeight: 700, fontSize: fs(28), lineHeight: 1.2, marginBottom: 10 } }, t(card.title)),
        h("div", { style: { fontSize: fs(14), lineHeight: 1.6, opacity: 0.85 } }, t(card.body))),

      h("div", null,
        h("div", { role: "group", "aria-label": t("Progress"), style: { display: "flex", gap: 6, justifyContent: "center", marginBottom: 16 } },
          INTRO_CARDS.map((c, i) => h("span", {
            key: c.id,
            "aria-hidden": "true",
            style: {
              width: i === introStep ? 18 : 6, height: 6, borderRadius: 999,
              background: i === introStep ? T.gold : "rgba(251,248,240,0.35)"
            }
          }))),
        h("button", {
          onClick: () => { if (last) dismissIntro(); else setIntroStep(introStep + 1); },
          style: {
            width: "100%", padding: "14px", borderRadius: 10, border: "none",
            background: T.gold, color: "#141A33", cursor: "pointer",
            fontFamily: font.body, fontSize: fs(14.5), fontWeight: 800
          }
        }, last ? t("Open my file") : t("Next")))
    );
  };

  if (!locked && introStep >= 0) return introScreen();

  // The lock screen replaces the app entirely rather than covering it, so
  // there is no layer underneath holding a rendered file that a screenshot,
  // a screen reader or a stray scroll could reach.
  if (locked) {
    return h("div", {
      style: {
        fontFamily: font.body, color: T.cream, background: T.header,
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px"
      }
    },
      h("div", { style: { width: "100%", maxWidth: 340, textAlign: "center" } },
        h(MapleLeaf, { size: fs(54), style: { margin: "0 auto 14px" } }),
        h("div", { style: { fontFamily: font.display, fontWeight: 700, fontSize: fs(26), marginBottom: 4 } }, t("Estate File")),
        h("div", { style: { fontSize: fs(12), opacity: 0.72, marginBottom: 20, lineHeight: 1.5 } },
          t("Enter your PIN to open your file.")),
        h("input", {
          type: "password",
          inputMode: "numeric",
          autoComplete: "off",
          value: pinEntry,
          "aria-label": t("PIN"),
          onInput: (e) => { setPinEntry(e.currentTarget.value.replace(/\D/g, "").slice(0, 8)); setPinError(""); },
          onKeyDown: (e) => { if (e.key === "Enter") tryUnlock(); },
          style: {
            width: "100%", padding: "14px", borderRadius: 10, textAlign: "center",
            border: "1px solid rgba(251,248,240,0.35)", background: "rgba(251,248,240,0.08)",
            color: T.cream, fontFamily: font.body, fontSize: fs(22), letterSpacing: 6
          }
        }),
        pinError ? h("div", { role: "alert", style: { fontSize: fs(11.5), color: "#FFB4A8", marginTop: 8 } }, pinError) : null,
        h("button", {
          onClick: tryUnlock,
          disabled: pinEntry.length < 4,
          style: {
            width: "100%", marginTop: 12, padding: "13px", borderRadius: 10, border: "none",
            background: pinEntry.length < 4 ? "rgba(251,248,240,0.25)" : T.gold,
            color: pinEntry.length < 4 ? "rgba(251,248,240,0.6)" : "#141A33",
            fontFamily: font.body, fontSize: fs(14), fontWeight: 800,
            cursor: pinEntry.length < 4 ? "default" : "pointer"
          }
        }, t("Unlock")),
        // The crisis line must never sit behind a PIN. Someone in trouble at
        // two in the morning who cannot remember four digits still needs the
        // number, so Help opens from the lock screen exactly as it does from
        // every other screen.
        h("button", {
          onClick: () => setHelpOpen(true),
          style: {
            width: "100%", marginTop: 10, padding: "12px", borderRadius: 10, cursor: "pointer",
            background: "transparent", border: "1px solid rgba(251,248,240,0.4)",
            color: T.cream, fontFamily: font.body, fontSize: fs(13), fontWeight: 800
          }
        }, t("Help and phone numbers")),
        h("div", { style: { fontSize: fs(10.5), opacity: 0.6, marginTop: 14, lineHeight: 1.5 } },
          t("Forgotten it? There is no reset. Clearing the app's data removes the lock and your record together.")),
        helpOpen ? helpSheet() : null
      )
    );
  }

  return h("div", { style: { fontFamily: font.body, color: T.ink, background: T.cream, minHeight: "100vh" } },
    h("input", {
      ref: fileRef, type: "file", accept: "image/*,application/pdf,.pdf", multiple: true, onChange: onFileChosen,
      style: { display: "none" }
    }),

    // The one line of flag red in the chrome: a hairline under the navy
    // header. Enough to say where the app is from; anything louder would
    // start to look like it was issued by the government, which it must not.
    h("div", { style: { background: T.header, color: T.cream, padding: "calc(10px + env(safe-area-inset-top)) 16px 0", borderBottom: "2px solid " + T.maple } },
      // Title and Help sit on one row. Help is reachable from every screen
      // rather than buried in a tab, because the moment someone needs the
      // crisis line is not the moment to go looking for it.
      h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 } },
        h("div", { style: { minWidth: 0, display: "flex", alignItems: "flex-start", gap: 11 } },
          h(MapleLeaf, { size: 28, style: { marginTop: 5 } }),
          h("div", { style: { minWidth: 0 } },
            // The wordmark must not break in half. Keep it on one line and
            // let it shrink on narrow phones rather than wrapping the title.
            h("div", { style: { display: "flex", alignItems: "center", gap: 8, minWidth: 0 } },
              h("div", { style: { fontFamily: font.display, fontWeight: 700, fontSize: "clamp(" + fs(21) + "px, " + fs(5.6) + "vw, " + fs(30) + "px)", lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, t("Estate File")),
              h("span", { "aria-label": t("Estate province or territory") + ": " + t(provinceDef(province).label), style: { flex: "0 0 auto", padding: "3px 7px", borderRadius: 7, border: "1px solid " + T.gold, color: T.gold, fontFamily: font.body, fontSize: fs(9.5), fontWeight: 800, lineHeight: 1.2, letterSpacing: 0.3 } }, province === "ON" ? "ONT" : t(provinceDef(province).short))
            ),
            h("div", { style: { fontSize: fs(12.5), opacity: 0.72, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, t("An executor's own record"))
          )
        ),
        h("div", { style: { flex: "0 0 auto", display: "flex", alignItems: "center", gap: 10, marginTop: 4 } },
          h("div", {
            role: "group",
            "aria-label": t("Language"),
            style: { display: "flex", alignItems: "center", gap: 5 }
          },
            [["en", "EN"], ["fr", "FR"]].map((pair, i) => [
              i ? h("span", { key: "sep", "aria-hidden": "true", style: { color: T.cream, opacity: 0.3, fontFamily: font.body, fontSize: fs(11) } }, "|") : null,
              h("button", {
                key: pair[0], onClick: () => chooseLang(pair[0]),
                "aria-pressed": lang === pair[0] ? "true" : "false", lang: pair[0],
                style: {
                  cursor: "pointer", background: "transparent", border: "none",
                  padding: "15px 6px", margin: "-9px -2px", color: T.cream, fontFamily: font.body, fontSize: fs(11.5),
                  fontWeight: lang === pair[0] ? 800 : 600, opacity: lang === pair[0] ? 1 : 0.55,
                  textDecoration: lang === pair[0] ? "underline" : "none"
                }
              }, pair[1])
            ])
          ),
          h("button", {
            onClick: () => setHelpOpen(true),
            "aria-label": t("Help and phone numbers"),
            style: {
              flex: "0 0 auto", cursor: "pointer",
              background: "transparent", border: "1px solid rgba(251,248,240,0.4)",
              borderRadius: 999, padding: "0 12px", minHeight: 44,
              display: "inline-flex", alignItems: "center",
              color: T.cream, fontFamily: font.body, fontSize: fs(12), fontWeight: 800
            }
          }, t("Help")),
          h("button", {
            onClick: () => { setTab("settings"); setOpenClaim(null); },
            "aria-label": t("Settings"),
            "aria-current": tab === "settings" ? "page" : undefined,
            title: t("Settings"),
            style: {
              flex: "0 0 auto", cursor: "pointer", width: 44, height: 44, padding: 0,
              background: tab === "settings" ? "rgba(197,154,39,0.14)" : "transparent",
              border: "1px solid " + (tab === "settings" ? T.gold : "rgba(251,248,240,0.4)"),
              borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center",
              color: tab === "settings" ? T.gold : T.cream, fontFamily: font.body, fontSize: fs(21), fontWeight: 700, lineHeight: 1
            }
          }, h("span", { "aria-hidden": "true" }, "⚙︎"))
        )
      ),
      // The tab strip sits in its own relative box so a fade can be laid over
      // the right edge. If the labels ever do overflow, on a smaller phone or
      // at a larger accessibility text size, the fade is the cue that there is
      // more to scroll to. The version moved to Settings; a version number in
      // the header of a shipping app reads as unfinished.
      h("div", { style: { position: "relative", marginTop: 9 } },
        h("div", { className: "hscroll", style: { display: "flex", gap: 14 } },
          TABS.map((tb) => h("button", {
            key: tb.id,
            onClick: () => { setTab(tb.id); setOpenClaim(null); },
            style: {
              flex: "0 0 auto", border: "none", background: "transparent", cursor: "pointer",
              // 14 above + text + 10 below + the underline clears 44pt of
              // tappable height without the strip reading as taller.
              padding: "14px 2px 10px", fontFamily: font.body, fontSize: fs(12.5), letterSpacing: 0.2,
              fontWeight: tab === tb.id ? 800 : 600,
              color: tab === tb.id ? T.gold : T.tabIdle,
              borderBottom: "3px solid " + (tab === tb.id ? T.gold : "transparent")
            }
          }, tb.label))
        ),
        h("div", {
          "aria-hidden": "true",
          style: {
            position: "absolute", top: 0, right: -16, width: 26, bottom: 0,
            pointerEvents: "none",
            background: "linear-gradient(to right, transparent, " + T.header + ")"
          }
        })
      )
    ),

    tab === "start" ? startScreen() : null,
    tab === "claims" ? (openClaim ? claimDetail() : claimsScreen()) : null,
    tab === "body" ? bodyScreen() : null,
    tab === "reminders" ? remindersScreen() : null,
    tab === "documents" ? documentsScreen() : null,
    tab === "benefits" ? benefitsScreen() : null,
    tab === "estimate" ? estimateScreen() : null,
    tab === "settings" ? settingsScreen() : null,

    editorOpen ? claimEditor() : null,
    remOpen ? reminderSheet() : null,
    logOpen ? logSheet() : null,
    viewingDoc ? docViewer() : null,
    redressOpen ? redressSheet() : null,
    helpOpen ? helpSheet() : null,
    guideOpen ? guideSheet() : null,
    searchOpen ? searchSheet() : null,
    timelineOpen ? timelineSheet() : null,
    lockSetupOpen ? lockSetupSheet() : null,
    condOpen ? conditionEditor() : null,
    condExportOpen ? condExportSheet() : null,
    stmtOpen ? statementSheet() : null,
    summaryOpen ? summarySheet() : null,
    backupOpen ? backupSheet() : null,

    toast ? h("div", {
      style: {
        position: "fixed", left: 16, right: 16, bottom: "calc(18px + env(safe-area-inset-bottom))",
        background: T.primary, color: T.cream, borderRadius: 10, padding: "11px 13px",
        fontSize: fs(12.5), textAlign: "center", zIndex: 90, boxShadow: "0 6px 20px rgba(20,26,51,0.28)"
      }
    }, toast) : null,

    h("div", { style: { height: 40 } })
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(h(EstateFile));
