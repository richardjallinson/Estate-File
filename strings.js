/* Estate File v1D — language compatibility layer.

   V1A is intentionally English-only. A previous prototype exposed an
   incomplete French translation inherited from another project. Rather than
   present users with mixed or incorrect terminology, translation is disabled
   until an estate-specific French version has been reviewed end to end.
*/

const FR_URLS = {};
const FR = {};
const FR_MISSES = new Set();
let LANG = "en";
function setLang() { LANG = "en"; }
function getLang() { return "en"; }
function t(s) { return s; }
function frUrl(url) { return { url: url, english: false }; }

if (typeof module !== "undefined" && module.exports) {
  module.exports = { FR, FR_URLS, t, setLang, getLang, FR_MISSES, frUrl };
}
