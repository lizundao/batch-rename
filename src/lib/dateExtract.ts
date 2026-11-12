export interface ExtractedDate {
  date: string;
  time: string;
}

const PATTERNS: { re: RegExp; map: (m: RegExpMatchArray) => ExtractedDate }[] = [
  {
    re: /(\d{4})(\d{2})(\d{2})[_-](\d{2})(\d{2})(\d{2})/,
    map: (m) => ({
      date: `${m[1]}${m[2]}${m[3]}`,
      time: `${m[4]}${m[5]}${m[6]}`,
    }),
  },
  {
    re: /(\d{4})-(\d{2})-(\d{2})[_\s](\d{2}):(\d{2}):(\d{2})/,
    map: (m) => ({
      date: `${m[1]}${m[2]}${m[3]}`,
      time: `${m[4]}${m[5]}${m[6]}`,
    }),
  },
  {
    re: /(\d{4})-(\d{2})-(\d{2})/,
    map: (m) => ({ date: `${m[1]}${m[2]}${m[3]}`, time: "" }),
  },
  {
    re: /(\d{4})(\d{2})(\d{2})/,
    map: (m) => ({ date: `${m[1]}${m[2]}${m[3]}`, time: "" }),
  },
];

export function extractDateFromStem(stem: string): ExtractedDate | null {
  for (const { re, map } of PATTERNS) {
    const match = stem.match(re);
    if (match) return map(match);
  }
  return null;
}
