/* Estate File. An executor's private record of settling an estate.
   Everything is on the device. Nothing is sent anywhere, there is no account
   and no server. This app is not affiliated with any government department and
   does not give legal, tax or financial advice; it keeps the executor's own record. */

const { useState, useMemo, useEffect, useRef } = React;
const h = React.createElement;

const APP_VERSION = "v1B";

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
const BENEFIT_CATEGORIES = [
  { id: "cpp", label: "From the Canada Pension Plan" },
  { id: "other", label: "Other federal support" },
  { id: "prov", label: "Ontario",
    note: "Provincial, not federal. Ontario only; other provinces run their own." }
];

// Figures are the published 2026 amounts. The death benefit figure is the one
// most guides get wrong: the base is $2,500, and the extra $2,500 applies only
// in the narrow case set out below, which is why it is spelled out here rather
// than advertised as "up to $5,000".
const RATES_READ = "August 2026";

// Benefit-screen helpers. These are deliberately small and deterministic so
// the Benefits tab cannot fail simply because a display helper is missing.
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
  return t(label) + (info.english ? t(" (page in English)") : "");
}
const BENEFITS = [
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
    url: "https://www.canada.ca/en/services/life-events/death/notify.html" },
  { id: "eat", cat: "prov", name: "Estate Administration Tax",
    what: "Ontario's probate tax, paid to the court when you apply for a Certificate of Appointment of Estate Trustee. The Probate tab works out the figure from an estate value.",
    rate: "Nothing on the first $50,000. $15 for every $1,000 above it.",
    url: "https://www.ontario.ca/page/estate-administration-tax" },
  { id: "eir", cat: "prov", name: "Estate Information Return",
    what: "A separate filing to the Ministry of Finance listing what the estate was worth. It is required even when no tax is owed and even for small estates. Missing the deadline is an offence under the Estate Administration Tax Act.",
    rate: "Due within 180 calendar days of the certificate being issued.",
    url: "https://www.ontario.ca/page/estate-administration-tax" }
];

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
const REDRESS_LEVELS = [
  { id: "prep", short: "Preparation", label: "Getting the application ready",
    blurb: "The original will, proof of death, the asset values, and the court forms. Most executors spend the first month here." },
  { id: "filed", short: "Filed", label: "Application filed with the court",
    blurb: "Submitted to the Superior Court of Justice with the Estate Administration Tax paid." },
  { id: "certificate", short: "Certificate", label: "Certificate of Appointment issued",
    blurb: "The court has appointed you. Note the date it was ISSUED: the Estate Information Return is due 180 days from it." },
  { id: "eir", short: "Return filed", label: "Estate Information Return filed",
    blurb: "Filed with the Ministry of Finance. Required even where no tax was payable." },
  { id: "clearance", short: "Clearance", label: "CRA clearance certificate requested",
    blurb: "Form TX19, after every return is filed and assessed. Distributing before it arrives can leave you personally liable." }
];
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
const EVIDENCE_ITEMS = [
  { id: "statement", label: "Statements of Death from the funeral director",
    note: "Ask for several originals at the outset. Institutions each keep one." },
  { id: "certificate", label: "The provincial death certificate",
    note: "Ordered from ServiceOntario, and slower than the funeral director's statement. Start it early." },
  { id: "will", label: "The original will",
    note: "The original, not a copy. The court requires it." },
  { id: "id", label: "Your own photo identification",
    note: "Every institution will ask you to prove who you are as well." },
  { id: "appointment", label: "Certificate of Appointment of Estate Trustee",
    note: "If probate is needed. Some institutions will release nothing without it." },
  { id: "sin", label: "The deceased's Social Insurance Number",
    note: "The CRA and Service Canada both ask for it on the first call." },
  { id: "values", label: "Written values for each asset at the date of death",
    note: "Bank balances, appraisals, statements. Needed for probate, the Estate Information Return and the CRA." },
  { id: "assessments", label: "Notices of Assessment and past returns",
    note: "For the final return and the clearance certificate request." }
];

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
const HELP_SECTIONS = [
  {
    id: "crisis", tone: "urgent",
    label: "If you need to talk to someone now",
    note: "Free, confidential, and answered any hour of any day.",
    items: [
      { name: "9-8-8 Suicide Crisis Helpline", tel: "988",
        detail: "Call or text, anywhere in Canada. For anyone in distress, not only for thoughts of suicide.",
        alt: "Text 988" },
      { name: "Emergency", tel: "911",
        detail: "If someone is in immediate danger." }
    ]
  },
  {
    id: "grief", tone: "normal",
    label: "Grief support",
    note: "Bereavement support is a service in its own right, and most of it costs nothing.",
    items: [
      { name: "ConnexOntario", tel: "1-866-531-2600",
        detail: "Free, confidential, around the clock. Connects you to mental health and bereavement services near you in Ontario.",
        url: "https://www.connexontario.ca/" },
      { name: "Your family doctor",
        detail: "Grief that stops you sleeping, eating or functioning is a medical matter, not a weakness. It is worth saying out loud at an appointment." }
    ]
  },
  {
    id: "official", tone: "normal",
    label: "The calls you will have to make",
    note: "These are the published numbers. Have the Social Insurance Number in front of you before you dial.",
    items: [
      { name: "Service Canada, to cancel CPP and OAS", tel: "1-800-277-9914",
        detail: "The first call to make. Payments after the month of death have to be repaid, and the demand lands on the executor.",
        url: "https://www.canada.ca/en/services/life-events/death/notify.html" },
      { name: "Canada Revenue Agency", tel: "1-800-959-8281",
        detail: "Report the date of death, stop benefit payments, and ask what they need to recognise you as the legal representative.",
        url: "https://www.canada.ca/en/revenue-agency/services/tax/individuals/life-events/what-when-someone-died.html" },
      { name: "Employment Insurance", tel: "1-800-206-7218",
        detail: "If the person was receiving or might have been eligible for EI." }
    ]
  },
  {
    id: "legal", tone: "normal",
    label: "If you need legal help",
    note: "Estate work is one of the places where paying for an hour of advice is often cheaper than the mistake it prevents.",
    items: [
      { name: "Law Society Referral Service",
        detail: "A free half-hour consultation with a lawyer in the relevant field. Run by the Law Society of Ontario.",
        url: "https://lso.ca/public-resources/finding-a-lawyer-or-paralegal/law-society-referral-service" },
      { name: "Office of the Public Guardian and Trustee", tel: "1-800-366-0335",
        detail: "Ontario. Steps in where there is no one else able or willing to administer an estate." }
    ]
  }
];

// ---- The first two weeks.
//
// Not a complete checklist, and it says so. It covers the handful of things
// that are time-sensitive or expensive to get wrong, each one verified against
// the government page that says it.
const GUIDE_SECTIONS = [
  {
    id: "first", title: "The first calls",
    body: "Service Canada first, to stop CPP and OAS: benefits are payable for the month of the death and no further, and anything paid after that has to be repaid out of the estate. Then the Canada Revenue Agency, to report the date of death and stop benefit payments. In most provinces the Social Insurance Number is cancelled automatically by the provincial registrar, so that is one call you do not have to make.",
    links: [{ label: "Who to notify, on canada.ca", url: "https://www.canada.ca/en/services/life-events/death/notify.html" }]
  },
  {
    id: "poa", title: "A power of attorney does not survive the death",
    body: "Every power of attorney and every pre-death authorisation ends the moment the person dies. If you were managing their affairs before, you are not authorised to continue on that basis. Your authority now comes from the will, or from the court, and institutions will ask you to prove it.",
    links: []
  },
  {
    id: "docs", title: "Statements of death, and how many",
    body: "The funeral director provides Statements of Death, and you should ask for several originals: banks, insurers and registries each keep one. The provincial death certificate from ServiceOntario is a separate document, is what some institutions insist on, and has run to weeks or months at times. Order it early even if you think you will not need it.",
    links: []
  },
  {
    id: "money", title: "The 60-day one",
    body: "Service Canada asks for the CPP death benefit application within 60 days of the death, on form ISP1200. The base amount is $2,500. A further $2,500 is added only where the person died before ever collecting a CPP retirement or disability pension and left no surviving spouse or common-law partner, which is narrower than most guides suggest.",
    links: [{ label: "CPP amounts, on canada.ca", url: "https://www.canada.ca/en/services/benefits/publicpensions/cpp/payment-amounts.html" }]
  },
  {
    id: "fraud", title: "Tell the credit bureaus",
    body: "Equifax and TransUnion should both be told, so that credit cannot be taken out in the name of the person who died. It is a short call, it is free, and almost nobody is told to do it.",
    links: [{ label: "Notifying a death, on canada.ca", url: "https://www.canada.ca/en/services/life-events/death/notify.html" }]
  },
  {
    id: "probate", title: "Two deadlines that follow the certificate",
    body: "If probate is needed in Ontario, the Estate Information Return must reach the Ministry of Finance within 180 calendar days of the certificate being ISSUED, and it is required even where the estate is small enough that no tax is payable. Separately, the CRA clearance certificate on form TX19 comes only after every return is filed and assessed: distributing the estate before it arrives can leave you personally liable for what is owed.",
    links: [{ label: "Estate Administration Tax, on ontario.ca", url: "https://www.ontario.ca/page/estate-administration-tax" }]
  },
  {
    id: "notadvice", title: "None of this is advice",
    body: "Whether an estate needs probate at all, how an asset passes, what the will means, and what should be filed are legal and tax questions. This app keeps your record of the process. It does not tell you what to do, and a half-hour with a lawyer through the Law Society Referral Service costs nothing.",
    links: []
  }
];


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
const redressLevel = (id) => REDRESS_LEVELS.find((r) => r.id === id) || REDRESS_LEVELS[0];
const redressOutcome = (id) => REDRESS_OUTCOMES.find((r) => r.id === id) || REDRESS_OUTCOMES[0];

// ---- Dates. Everything is stored as YYYY-MM-DD, parsed as local rather than
// UTC. new Date("2026-03-01") is midnight UTC, which in Ontario is the evening
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

// ---- Storage. Text in localStorage, document images in IndexedDB. The same
// split as the recipe app, for the same reason: localStorage is about 5MB and
// a handful of photographed letters would fill it and take the claims with it. --
const STORAGE_KEY = "estate-file-v1";

// ---- Language.
// V1A ships in English only. The previous prototype exposed a partially
// translated French interface, which was more misleading than useful. Keep
// the preference key reserved so a future complete translation can be added
// without colliding with estate data.
const LANG_KEY = "estate-file-lang";
function loadLangPref() { return "en"; }
function saveLangPref() {
  try { localStorage.setItem(LANG_KEY, "en"); } catch {}
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
    body: t("The Help button at the top of every screen has crisis and grief support first, then the government numbers you may need and a route to a free half-hour with an Ontario lawyer. Those details are kept in the app, so they are available with no signal.")
  },
  {
    id: "start",
    title: t("Start with one step"),
    body: t("Add the first thing you have to do and the date. Everything else can wait: the letters, the calls, the inventory, the questions. It is built to be filled in slowly.")
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
  const [claims, setClaims] = useState([]);
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
  useEffect(() => { try { document.documentElement.lang = lang; } catch {} }, [lang]);

  const [tab, setTab] = useState("claims");
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
      if (Array.isArray(data.claims)) setClaims(data.claims);
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
    saveState({ claims, reminders, contacts, redress, evidence, statements, conditions });
  }, [claims, reminders, contacts, redress, evidence, statements, conditions, loaded]);

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
          title: t(redressLevel(r.level).label), sub: r.notes || "", date: r.dateRequested });
    });

    return out.map((r) => ({ ...r, claimName: r.claimId ? claimName(r.claimId) : null }));
  }, [searchQ, claims, conditions, contacts, reminders, statements, redress, lang]);


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
    const used = redress.filter((r) => r.claimId === claimId).map((r) => r.level);
    const furthest = used.reduce((max, id) => {
      const i = REDRESS_LEVELS.findIndex((l) => l.id === id);
      return i > max ? i : max;
    }, -1);
    const nextIdx = Math.min(furthest + 1, REDRESS_LEVELS.length - 1);
    setRdLevel(REDRESS_LEVELS[nextIdx].id);
    setRdRequested(todayISO()); setRdHeard(""); setRdDecided("");
    setRdOutcome("waiting"); setRdRep(REPRESENTATIVES[0]); setRdNotes("");
    setRedressOpen(true);
  };
  const openEditRedress = (r) => {
    setRdEditingId(r.id);
    setRdClaim(r.claimId || "");
    setRdLevel(r.level);
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
      flash(t(redressLevel(rdLevel).short) + t(" added"));
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
    if (c.type) L.push(t("Benefit: ") + c.type);
    if (c.fileNumber) L.push(t("Reference number: ") + c.fileNumber);
    if (c.dateApplied) L.push(t("Applied: ") + formatDate(c.dateApplied) + t("  (open ") + spanText(c.dateApplied) + ")");
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
        L.push("  " + redressLevel(r.level).label);
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
    const have = EVIDENCE_ITEMS.filter((i) => ev[i.id]);
    const missing = EVIDENCE_ITEMS.filter((i) => !ev[i.id]);
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
    setBackupText(JSON.stringify({ claims, reminders, contacts, redress, evidence, statements, conditions }));
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
    if (Array.isArray(data.claims)) setClaims(data.claims);
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
        record: { claims, reminders, contacts, redress, evidence, statements, conditions },
        documents: docs
      };
      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "estate-file-backup-" + todayISO() + ".json";
      document.body.appendChild(a);
      a.click();
      // Revoked on a delay rather than immediately: some browsers have not
      // finished with the URL by the time the click handler returns.
      setTimeout(() => { try { URL.revokeObjectURL(url); a.remove(); } catch {} }, 4000);
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
      if (r.dateRequested) rows.push({ kind: "redress", date: r.dateRequested, claimId: r.claimId, title: t(redressLevel(r.level).label), detail: t("Date started or filed") });
      if (r.dateHeard) rows.push({ kind: "redress", date: r.dateHeard, claimId: r.claimId, title: t(redressLevel(r.level).label), detail: t("Date received or issued") });
      if (r.dateDecided) rows.push({ kind: "outcome", date: r.dateDecided, claimId: r.claimId, title: t(redressOutcome(r.outcome).label), detail: t(redressLevel(r.level).label) });
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
  }, [claims, contacts, redress, reminders, docMeta, lang]);

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
        c.type || "",
        c.fileNumber ? "  ·  " + c.fileNumber : ""
      ),
      h(StageTrack, { claim: c }),
      h("div", { style: { fontFamily: font.body, fontSize: fs(11.5), color: T.ink, marginTop: 8 } },
        c.dateApplied
          ? h("span", null, t("Open "), h("b", null, spanText(c.dateApplied)), t(" · applied "), formatDate(c.dateApplied))
          : h("span", { style: { color: T.inkSoft } }, t("No application date set"))
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
        c.type || "", c.fileNumber ? "  ·  " + c.fileNumber : ""),
      c.dateApplied ? h("div", { style: { fontFamily: font.body, fontSize: fs(12.5), color: T.ink, marginTop: 6 } },
        t("Applied "), formatDate(c.dateApplied), t(". Open "), h("b", null, spanText(c.dateApplied)), ".") : null,

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
          EVIDENCE_ITEMS.filter((i) => (evidence[c.id] || {})[i.id]).length + t(" of ") + EVIDENCE_ITEMS.length)
      ),
      h("div", { style: { fontSize: fs(11), color: T.inkSoft, marginTop: 4, marginBottom: 8, lineHeight: 1.45 } },
        t("What institutions actually ask for. Not every estate needs every one, and a lawyer will tell you which yours does.")),
      h("div", { style: { background: T.card, border: "1px solid " + T.line, borderRadius: 10, overflow: "hidden" } },
        EVIDENCE_ITEMS.map((item, i) => {
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
        h("div", { style: { fontFamily: font.display, fontSize: fs(17), color: T.heading } }, t("Probate")),
        h("button", {
          onClick: () => openNewRedress(c.id),
          style: { border: "1px solid " + T.blue, borderRadius: 8, background: T.blueSoft, color: T.blue, fontSize: fs(11), fontWeight: 800, padding: "5px 10px", cursor: "pointer" }
        }, t("Add"))
      ),

      steps.length === 0
        ? h("div", { style: { marginTop: 7 } },
            h("div", { style: { fontSize: fs(11.5), color: T.inkSoft, lineHeight: 1.5, marginBottom: 9 } },
              t("If this estate needs probate, you can track the main milestones here. Record the dates from the court, Ministry of Finance and CRA paperwork rather than relying on memory.")),
            h("div", { style: { background: T.card, border: "1px solid " + T.line, borderRadius: 10, overflow: "hidden" } },
              REDRESS_LEVELS.map((l, i) => h("div", {
                key: l.id,
                style: { padding: "9px 12px", borderTop: i === 0 ? "none" : "1px solid " + T.line }
              },
                h("div", { style: { fontFamily: font.body, fontSize: fs(12.5), fontWeight: 700, color: T.ink } }, (i + 1) + ". " + l.label),
                h("div", { style: { fontSize: fs(10.5), color: T.inkSoft, marginTop: 2, lineHeight: 1.45 } }, t(l.blurb))
              ))
            ),
            h("div", { style: { background: T.goldSoft, border: "1px solid " + T.gold, borderRadius: 10, padding: "11px 13px", fontSize: fs(11.5), color: T.ink, lineHeight: 1.5, marginTop: 9 } },
              t("Probate has a sequence and each step has its own paperwork. Record where yours has got to, and the dates, because two deadlines run from them."),
              h("div", { style: { marginTop: 6, color: T.inkSoft } },
                t("The Estate Information Return is due 180 calendar days from the date the certificate was ISSUED, and the CRA clearance certificate comes only after every return is assessed.")))
          )
        : h("div", { style: { marginTop: 8 } },
            steps.map((r) => {
              const lvl = redressLevel(r.level);
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
      rdEditingId ? t("Edit this step") : t("Add a probate step")),
    h("div", { key: "b", style: { fontSize: fs(11.5), color: T.inkSoft, marginBottom: 12, lineHeight: 1.45 } },
      t("Your own record of the probate process. Nothing entered here is submitted to the court, the Ministry of Finance or the CRA.")),
    h(Field, { key: "lv", label: t("Which stage"), hint: redressLevel(rdLevel).blurb },
      h("select", { value: rdLevel, onChange: (e) => setRdLevel(e.currentTarget.value), style: { ...inputStyle(), width: "100%" } },
        REDRESS_LEVELS.map((l) => h("option", { key: l.id, value: l.id }, t(l.label))))),
    h(Field, { key: "cl", label: t("Step") },
      h("select", { value: rdClaim, onChange: (e) => setRdClaim(e.currentTarget.value), style: { ...inputStyle(), width: "100%" } },
        [h("option", { key: "none", value: "" }, t("Not tied to a step"))].concat(
          claims.map((c) => h("option", { key: c.id, value: c.id }, c.condition))))),
    h(Field, { key: "rq", label: t("Date started or filed") },
      h("input", { type: "date", value: rdRequested, onInput: (e) => setRdRequested(e.currentTarget.value), style: { ...inputStyle(), width: "100%" } })),
    h(Field, { key: "hd", label: t("Date received or issued"), hint: t("Leave blank if this probate stage does not produce a dated response or certificate.") },
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

  // ---- Ontario's Estate Administration Tax, worked out.
  //
  // The arithmetic is simple and the mistake people make is not: the tax is
  // banded, not a flat percentage of everything, and the value is rounded up
  // to the next thousand. Nothing on the first $50,000, then $15 for every
  // $1,000 above it.
  //
  // It shows a figure. It does not decide whether probate is needed at all,
  // which assets count towards the value, or what the estate is worth - all
  // three are legal questions, and all three are said plainly below.
  const estimateScreen = () => {
    const raw = estImpair === "" ? null : Number(estImpair);
    const hasInput = raw !== null && isFinite(raw) && raw >= 0;
    const rounded = hasInput ? Math.ceil(raw / 1000) * 1000 : null;
    const taxable = rounded === null ? null : Math.max(0, rounded - 50000);
    const tax = taxable === null ? null : (taxable / 1000) * 15;

    return h("div", { style: { padding: 16 } },
      h("div", { style: { fontFamily: font.display, fontSize: fs(20), color: T.heading, marginBottom: 3 } }, t("Work out the probate tax")),
      h("div", { style: { fontSize: fs(11.5), color: T.inkSoft, marginBottom: 12, lineHeight: 1.5 } },
        t("Ontario's Estate Administration Tax, from an estate value you enter. Arithmetic on the published rate, not a decision about what the estate is worth.")),

      h("div", { style: { background: T.card, border: "1px solid " + T.line, borderRadius: 12, padding: "14px 15px", marginBottom: 12 } },
        h(Field, { label: t("Value of the estate"), hint: t("The total value of the assets that pass through the estate, at the date of death.") },
          h("input", {
            type: "number", inputMode: "numeric", min: "0", value: estImpair,
            onInput: (e) => setEstImpair(e.currentTarget.value),
            placeholder: "0",
            style: { ...inputStyle(), width: "100%" }
          }))
      ),

      !hasInput
        ? h("div", { style: { padding: "14px 15px", borderRadius: 12, border: "1px solid " + T.line, background: T.card } },
            h("div", { style: { fontFamily: font.display, fontSize: fs(17), color: T.heading, marginBottom: 4 } }, t("Enter a value to see the tax")),
            h("div", { style: { fontSize: fs(12), color: T.inkSoft, lineHeight: 1.5 } },
              t("Nothing is payable on the first $50,000. Above that it is $15 for every $1,000, and the value is rounded up to the next $1,000.")))
        : h("div", { style: { background: T.card, border: "1px solid " + T.line, borderRadius: 12, padding: "14px 15px" } },
            h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 } },
              h("span", { style: { fontSize: fs(12), color: T.inkSoft } }, t("Value, rounded up")),
              h("span", { style: { fontFamily: font.body, fontSize: fs(14), fontWeight: 800, color: T.ink } }, money(rounded))),
            h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 } },
              h("span", { style: { fontSize: fs(12), color: T.inkSoft } }, t("Taxed above $50,000")),
              h("span", { style: { fontFamily: font.body, fontSize: fs(14), fontWeight: 800, color: T.ink } }, money(taxable))),
            h("div", { style: { borderTop: "1px solid " + T.line, marginTop: 6, paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "baseline" } },
              h("span", { style: { fontFamily: font.display, fontSize: fs(15), color: T.heading } }, t("Estate Administration Tax")),
              h("span", { style: { fontFamily: font.body, fontSize: fs(19), fontWeight: 800, color: T.gold } }, money(tax)))),

      h("div", { style: { marginTop: 12, background: T.goldSoft, border: "1px solid " + T.gold, borderRadius: 10, padding: "11px 13px", fontSize: fs(11.5), color: T.ink, lineHeight: 1.55 } },
        h("b", null, t("This does not decide what the estate is worth.")),
        t(" Which assets count towards the value, whether probate is needed at all, and how jointly held or beneficiary-designated property is treated are legal questions. Get them wrong and the figure above is wrong too. A half-hour with a lawyer, free through the Law Society Referral Service under Help, settles them.")),

      h("div", { style: { marginTop: 10, fontSize: fs(10.5), color: T.inkSoft, lineHeight: 1.5 } },
        t("The rate is the one published by Ontario for estate certificates applied for on or after 1 January 2020, read ") + RATES_READ + t(". Check ontario.ca before relying on it. The tax is paid to the court when the application is filed.")),

      h("div", { style: { marginTop: 14 } },
        h("button", {
          onClick: () => setGuideOpen(true),
          style: {
            width: "100%", padding: "13px", borderRadius: 10, border: "1px solid " + T.line,
            background: T.btn2, color: T.ink, fontFamily: font.body, fontSize: fs(13), fontWeight: 700, cursor: "pointer"
          }
        }, t("The first two weeks \u203a")))
    );
  };

  const statusToneColor = (tone) =>
    tone === "green" ? T.green : tone === "amber" ? T.amber : tone === "red" ? T.red : T.inkSoft;

  const bodyScreen = () => h("div", { style: { padding: 16 } },
    h("div", { style: { fontFamily: font.display, fontSize: fs(20), color: T.heading, marginBottom: 3 } }, t("The estate inventory")),
    h("div", { style: { fontSize: fs(11.5), color: T.inkSoft, marginBottom: 14, lineHeight: 1.5 } },
      t("Every account, property and debt, what it is worth at the date of death, and how it passes. The court, the Ministry of Finance and the CRA each ask for this same list. Build it once here and you are not doing it three times from memory.")),

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
    h("div", { style: { fontSize: fs(11.5), color: T.inkSoft, marginBottom: 14, lineHeight: 1.5 } },
      t("Benefits and support that may be available to a survivor or the estate, plus the calls that stop payments going out incorrectly. This does not decide eligibility; Service Canada and the CRA do.")),

    ratesAreStale() ? h("div", {
      style: { background: "#FBEBE8", border: "1px solid " + T.red, borderRadius: 9, padding: "10px 12px", fontSize: fs(11.5), color: T.red, marginBottom: 14, lineHeight: 1.45 }
    }, t("These amounts were read in ") + RATES_READ + t(". Check the government pages before relying on them.")) : null,

    BENEFIT_CATEGORIES.map((cat) => {
      const items = BENEFITS.filter((b) => b.cat === cat.id);
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
            }, benefitLinkText(b.url))
          ))
        )
      );
    }),

    h("div", { style: { background: T.goldSoft, border: "1px solid " + T.gold, borderRadius: 10, padding: "12px 14px", fontSize: fs(12), color: T.ink, lineHeight: 1.55, marginBottom: 10 } },
      h("b", null, t("Not sure which of these applies to you?")),
      t(" That is normal. Eligibility depends on the benefit and the person's circumstances. Use the official links for the rules, and ask Service Canada, the CRA, or a qualified professional when you are unsure."),
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
      t(" Crisis and grief support any hour of the day, the numbers you will have to ring, and a free half-hour with a lawyer. Tap here, or Help at the top of any screen."))
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

    GUIDE_SECTIONS.map((s) => h("div", { key: s.id, style: { marginBottom: 14 } },
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

    HELP_SECTIONS.map((sec) => h("div", { key: sec.id, style: { marginBottom: 16 } },
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
    // V1A is English-only; the language control returns when the estate-specific French translation is complete.
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
      t("The Law Society Referral Service gives you a free half-hour with a lawyer in the right field. For an estate, that half-hour is often the cheapest thing you will do."),
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
          href: "https://estate-file.vercel.app",
          target: "_blank", rel: "noopener noreferrer",
          style: { color: T.blue, fontFamily: font.body, fontSize: fs(12.5), fontWeight: 700, textDecoration: "none", userSelect: "text", WebkitUserSelect: "text" }
        }, "estate-file.vercel.app"),
        h("div", { style: { fontSize: fs(10.5), color: T.inkSoft, marginTop: 2, lineHeight: 1.45 } },
          t(t("The app's address. Open it in Safari on any phone and add it to the home screen.")))),
      t("Estate File is not affiliated with, endorsed by, or connected to any government department, court, law firm or accountancy practice. It reads no file and submits nothing on your behalf. It is a private place to keep your own record."),
      h("div", { style: { marginTop: 8 } },
        t("The Probate tab is arithmetic on Ontario's published Estate Administration Tax rate, read in "), RATES_READ, t(". It shows what the tax would be on a value you enter. It does not decide what the estate is worth, whether probate is needed, or how any asset passes. Those are legal questions.")),
      h("div", { style: { marginTop: 8 } },
        t("Nothing here is legal, tax or financial advice. Eligibility is decided by Service Canada and the CRA; what the will means and whether probate is needed are decided by a lawyer.")),
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
    h("div", { key: "d", style: { fontSize: fs(11), color: T.inkSoft, marginTop: 8 } }, "Added ", formatDate(viewingDoc.addedAt)),
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

  // ---------- shell ----------

  // Six tabs at full length ran off the right edge on a real phone, clipping
  // "Estimate" to "Est" and hiding Settings entirely. The bar scrolls, but
  // nothing on screen said so, which meant Settings simply looked absent.
  // Shorter labels plus a tighter gap fit all six, and the fade on the right
  // edge below makes it obvious when there is more to reach.
  const TABS = [
    { id: "claims", label: t("Steps"),
      about: "Every notification and filing: where each one stands, your notes, documents, and every call logged." },
    { id: "body", label: t("Estate"),
      about: "The estate inventory: every account, property and debt, what it is worth, and how it passes. The same list the court, the Ministry of Finance and the CRA each ask for." },
    { id: "reminders", label: dueCount ? t("Dates (") + dueCount + ")" : t("Dates"),
      about: "Dates you have been given: a 180-day return, a court date, a form due back. The app keeps the ones you enter; it does not work out your deadlines for you." },
    { id: "documents", label: t("Docs"),
      about: "Photographs and PDFs of statements of death, the will, certificates and letters, kept on this phone." },
    { id: "benefits", label: t("Benefits"),
      about: "Benefits and support that may be available to a survivor or the estate, plus the calls that stop payments going out incorrectly. It does not decide eligibility; Service Canada and the CRA do." },
    { id: "estimate", label: t("Probate"),
      about: "Ontario's Estate Administration Tax from an estate value, and the probate sequence with its deadlines. Arithmetic, not legal advice." },
    { id: "settings", label: t("Settings"),
      about: "Appearance, text size, the PIN lock, backups, and printing your whole file." }
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
            h("div", { style: { fontFamily: font.display, fontWeight: 700, fontSize: "clamp(" + fs(21) + "px, " + fs(5.6) + "vw, " + fs(30) + "px)", lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, t("Estate File")),
            h("div", { style: { fontSize: fs(12.5), opacity: 0.72, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, t("An executor's own record"))
          )
        ),
        h("button", {
          onClick: () => setHelpOpen(true),
          "aria-label": t("Help and phone numbers"),
          style: {
            flex: "0 0 auto", cursor: "pointer", marginTop: 4,
            background: "transparent", border: "1px solid rgba(251,248,240,0.4)",
            borderRadius: 999, padding: "0 16px", minHeight: 44,
            display: "inline-flex", alignItems: "center",
            color: T.cream, fontFamily: font.body, fontSize: fs(12), fontWeight: 800
          }
        }, t("Help"))
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
