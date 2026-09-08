/** Canonical region keys. Order here is the order rows appear on the sheet. */
export const REGION_ORDER = [
  'DHAKA_NORTH_CITY',
  'DHAKA_SOUTH_CITY',
  'DHAKA_DIVISION',
  'MYMENSINGH',
  'CHATTOGRAM',
  'KHULNA',
  'RAJSHAHI',
  'RANGPUR',
  'BARISHAL',
  'SYLHET',
] as const;

export type RegionKey = (typeof REGION_ORDER)[number];

/** English labels, used in the UI and in the AI brief. */
export const REGION_EN: Record<RegionKey, string> = {
  DHAKA_NORTH_CITY: 'Dhaka North City Corporation',
  DHAKA_SOUTH_CITY: 'Dhaka South City Corporation',
  DHAKA_DIVISION: 'Dhaka Division',
  MYMENSINGH: 'Mymensingh',
  CHATTOGRAM: 'Chattogram',
  KHULNA: 'Khulna',
  RAJSHAHI: 'Rajshahi',
  RANGPUR: 'Rangpur',
  BARISHAL: 'Barishal',
  SYLHET: 'Sylhet',
};

/** Which rows count as "Dhaka city" for the Dhaka vs. outside-Dhaka split. */
export const DHAKA_CITY_KEYS: RegionKey[] = ['DHAKA_NORTH_CITY', 'DHAKA_SOUTH_CITY'];

export interface RegionRow {
  key: RegionKey;
  /** Admissions in the last 24 hours. */
  admitted24h: number | null;
  /** Deaths in the last 24 hours. */
  deaths24h: number | null;
  /** Cumulative admissions since 01 January. */
  totalAdmitted: number | null;
  /** Cumulative deaths since 01 January. */
  totalDeaths: number | null;
  /** Cumulative discharges since 01 January. */
  discharged: number | null;
  /** Patients currently occupying a bed. */
  currentlyAdmitted: number | null;
}

export interface YearComparison {
  year: number;
  cases: number | null;
  deaths: number | null;
  remarks?: string;
}

export interface DengueReport {
  /** ISO date the report covers, e.g. "2026-09-02". */
  date: string;
  /** Direct link to the source PDF on the DGHS server. */
  sourceUrl: string;
  /** The label as it appears on the DGHS index page. */
  sourceLabel: string;
  rows: RegionRow[];
  totals: Omit<RegionRow, 'key'>;
  comparison: YearComparison[];
  /** How the numbers were obtained. */
  extraction: {
    method: 'pattern' | 'model' | 'mixed';
    /** 0-1. Below 0.6 the UI shows a "verify before circulating" warning. */
    confidence: number;
    notes: string[];
  };
  /** Raw PDF text, kept so the analyst can check anything that looks wrong. */
  rawText?: string;
  /**
   * Dhaka North + South City Corporation combined discharged/currently-admitted,
   * read from the PDF's district-level tables. The two corporations are never
   * broken out from each other there — only their combined "ঢাকা মহানগর" row
   * exists — so `rows` leaves DHAKA_NORTH_CITY/DHAKA_SOUTH_CITY's discharged
   * and currentlyAdmitted `null` rather than guessing a split; this combined
   * figure is what completes the merged ঢাকা বিভাগ row on the official report.
   */
  dhakaCityDischarged?: { discharged: number; currentlyAdmitted: number } | null;
}

export interface ManagementBrief {
  language: 'en' | 'bn';
  headline: string;
  situation: string;
  keyFindings: string[];
  geographicPattern: string;
  riskFlags: { level: 'high' | 'moderate' | 'watch'; text: string }[];
  recommendations: string[];
  dataCaveats: string[];
  generatedAt: string;
}

export type PipelineStepId =
  | 'resolve'
  | 'locate'
  | 'download'
  | 'extract'
  | 'compose';

export interface PipelineStep {
  id: PipelineStepId;
  label: string;
  detail?: string;
  state: 'pending' | 'running' | 'done' | 'failed' | 'skipped';
}
