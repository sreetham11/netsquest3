// Flag emoji for the Overseas page's country label only. Transaction.country
// is a free-text display string (see src/lib/data/seed.ts), not an ISO code
// or a relation, so this maps the exact strings the app writes — plus a few
// common others for robustness — rather than deriving from a country code
// that doesn't exist anywhere in the schema.
//
// Deliberately scoped to this one page: the rest of the icon system
// (src/components/Icon.tsx) is explicitly "no emoji" and stays that way —
// this is a narrow, requested exception, not a precedent to reuse elsewhere.
const COUNTRY_FLAG: Record<string, string> = {
  Japan: "🇯🇵",
  Thailand: "🇹🇭",
  Malaysia: "🇲🇾",
  Singapore: "🇸🇬",
  Indonesia: "🇮🇩",
  Vietnam: "🇻🇳",
  "South Korea": "🇰🇷",
  China: "🇨🇳",
  "United States": "🇺🇸",
  "United Kingdom": "🇬🇧",
  Australia: "🇦🇺",
};

// Returns "🇯🇵 " (with trailing space) for a mapped country, or "" for an
// unmapped/missing one — safe to prepend directly, never a broken glyph.
export function flagForCountry(country: string | null | undefined): string {
  if (!country) return "";
  const flag = COUNTRY_FLAG[country];
  return flag ? `${flag} ` : "";
}
