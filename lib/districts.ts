import type { RegionKey } from './types';

/**
 * Bangladesh's 64 districts with their Bangla names and divisions, plus the
 * spelling variants DGHS death lists actually use (Chittagong/Chattogram,
 * Comilla/Cumilla, ...). Used to fold whatever the list's "District/City
 * Corporation" column says into one canonical district, and to print it in
 * Bangla on the official report.
 */
export interface District {
  en: string;
  bn: string;
  division: RegionKey;
}

const D = (en: string, bn: string, division: RegionKey): District => ({ en, bn, division });

export const DISTRICTS: District[] = [
  // Dhaka
  D('Dhaka', 'ঢাকা', 'DHAKA_DIVISION'),
  D('Faridpur', 'ফরিদপুর', 'DHAKA_DIVISION'),
  D('Gazipur', 'গাজীপুর', 'DHAKA_DIVISION'),
  D('Gopalganj', 'গোপালগঞ্জ', 'DHAKA_DIVISION'),
  D('Kishoreganj', 'কিশোরগঞ্জ', 'DHAKA_DIVISION'),
  D('Madaripur', 'মাদারীপুর', 'DHAKA_DIVISION'),
  D('Manikganj', 'মানিকগঞ্জ', 'DHAKA_DIVISION'),
  D('Munshiganj', 'মুন্সীগঞ্জ', 'DHAKA_DIVISION'),
  D('Narayanganj', 'নারায়ণগঞ্জ', 'DHAKA_DIVISION'),
  D('Narsingdi', 'নরসিংদী', 'DHAKA_DIVISION'),
  D('Rajbari', 'রাজবাড়ী', 'DHAKA_DIVISION'),
  D('Shariatpur', 'শরীয়তপুর', 'DHAKA_DIVISION'),
  D('Tangail', 'টাঙ্গাইল', 'DHAKA_DIVISION'),
  // Mymensingh
  D('Mymensingh', 'ময়মনসিংহ', 'MYMENSINGH'),
  D('Jamalpur', 'জামালপুর', 'MYMENSINGH'),
  D('Netrokona', 'নেত্রকোনা', 'MYMENSINGH'),
  D('Sherpur', 'শেরপুর', 'MYMENSINGH'),
  // Chattogram
  D('Chattogram', 'চট্টগ্রাম', 'CHATTOGRAM'),
  D('Bandarban', 'বান্দরবান', 'CHATTOGRAM'),
  D('Brahmanbaria', 'ব্রাহ্মণবাড়িয়া', 'CHATTOGRAM'),
  D('Chandpur', 'চাঁদপুর', 'CHATTOGRAM'),
  D('Cumilla', 'কুমিল্লা', 'CHATTOGRAM'),
  D("Cox's Bazar", 'কক্সবাজার', 'CHATTOGRAM'),
  D('Feni', 'ফেনী', 'CHATTOGRAM'),
  D('Khagrachhari', 'খাগড়াছড়ি', 'CHATTOGRAM'),
  D('Lakshmipur', 'লক্ষ্মীপুর', 'CHATTOGRAM'),
  D('Noakhali', 'নোয়াখালী', 'CHATTOGRAM'),
  D('Rangamati', 'রাঙ্গামাটি', 'CHATTOGRAM'),
  // Khulna
  D('Khulna', 'খুলনা', 'KHULNA'),
  D('Bagerhat', 'বাগেরহাট', 'KHULNA'),
  D('Chuadanga', 'চুয়াডাঙ্গা', 'KHULNA'),
  D('Jashore', 'যশোর', 'KHULNA'),
  D('Jhenaidah', 'ঝিনাইদহ', 'KHULNA'),
  D('Kushtia', 'কুষ্টিয়া', 'KHULNA'),
  D('Magura', 'মাগুরা', 'KHULNA'),
  D('Meherpur', 'মেহেরপুর', 'KHULNA'),
  D('Narail', 'নড়াইল', 'KHULNA'),
  D('Satkhira', 'সাতক্ষীরা', 'KHULNA'),
  // Rajshahi
  D('Rajshahi', 'রাজশাহী', 'RAJSHAHI'),
  D('Bogura', 'বগুড়া', 'RAJSHAHI'),
  D('Chapainawabganj', 'চাঁপাইনবাবগঞ্জ', 'RAJSHAHI'),
  D('Joypurhat', 'জয়পুরহাট', 'RAJSHAHI'),
  D('Naogaon', 'নওগাঁ', 'RAJSHAHI'),
  D('Natore', 'নাটোর', 'RAJSHAHI'),
  D('Pabna', 'পাবনা', 'RAJSHAHI'),
  D('Sirajganj', 'সিরাজগঞ্জ', 'RAJSHAHI'),
  // Rangpur
  D('Rangpur', 'রংপুর', 'RANGPUR'),
  D('Dinajpur', 'দিনাজপুর', 'RANGPUR'),
  D('Gaibandha', 'গাইবান্ধা', 'RANGPUR'),
  D('Kurigram', 'কুড়িগ্রাম', 'RANGPUR'),
  D('Lalmonirhat', 'লালমনিরহাট', 'RANGPUR'),
  D('Nilphamari', 'নীলফামারী', 'RANGPUR'),
  D('Panchagarh', 'পঞ্চগড়', 'RANGPUR'),
  D('Thakurgaon', 'ঠাকুরগাঁও', 'RANGPUR'),
  // Barishal
  D('Barishal', 'বরিশাল', 'BARISHAL'),
  D('Barguna', 'বরগুনা', 'BARISHAL'),
  D('Bhola', 'ভোলা', 'BARISHAL'),
  D('Jhalokathi', 'ঝালকাঠি', 'BARISHAL'),
  D('Patuakhali', 'পটুয়াখালী', 'BARISHAL'),
  D('Pirojpur', 'পিরোজপুর', 'BARISHAL'),
  // Sylhet
  D('Sylhet', 'সিলেট', 'SYLHET'),
  D('Habiganj', 'হবিগঞ্জ', 'SYLHET'),
  D('Moulvibazar', 'মৌলভীবাজার', 'SYLHET'),
  D('Sunamganj', 'সুনামগঞ্জ', 'SYLHET'),
];

/** Lower-case letters and digits only: "Cox's Bazar" -> "coxsbazar". */
function key(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Spelling variants seen across DGHS lists, keyed by `key()` of the variant. */
const ALIASES: Record<string, string> = {
  // Dhaka city corporations and Dhaka-city hospital rows are all "Dhaka" district.
  dncc: 'Dhaka',
  dscc: 'Dhaka',
  dhakanorth: 'Dhaka',
  dhakasouth: 'Dhaka',
  dhakacity: 'Dhaka',
  dhakametro: 'Dhaka',
  chittagong: 'Chattogram',
  chattagram: 'Chattogram',
  comilla: 'Cumilla',
  kumilla: 'Cumilla',
  barisal: 'Barishal',
  jessore: 'Jashore',
  bogra: 'Bogura',
  nawabganj: 'Chapainawabganj',
  chapainababganj: 'Chapainawabganj',
  chapai: 'Chapainawabganj',
  coxbazar: "Cox's Bazar",
  khagrachari: 'Khagrachhari',
  jhalakathi: 'Jhalokathi',
  jhalokati: 'Jhalokathi',
  jhalakati: 'Jhalokathi',
  maulvibazar: 'Moulvibazar',
  moulvibazar: 'Moulvibazar',
  netrakona: 'Netrokona',
  munshiganj: 'Munshiganj',
  munsiganj: 'Munshiganj',
  narsinghdi: 'Narsingdi',
  laxmipur: 'Lakshmipur',
  jaipurhat: 'Joypurhat',
  joypurhat: 'Joypurhat',
  jhenidah: 'Jhenaidah',
  jhenaidah: 'Jhenaidah',
  brahmanbaria: 'Brahmanbaria',
  brahmmanbaria: 'Brahmanbaria',
  nilphamari: 'Nilphamari',
  gaibandha: 'Gaibandha',
  sirajgonj: 'Sirajganj',
  bagerhat: 'Bagerhat',
};

const BY_KEY = new Map<string, District>(DISTRICTS.map((d) => [key(d.en), d]));

/** Words that follow a district name but are not part of it. */
const NOISE = /(citycorporation|metropolitan|district|zila|city|corporation)$/;

/**
 * Fold the text of a list's "District/City Corporation" cell into one of the
 * 64 districts. Returns null for text that isn't recognisably a district, so
 * the caller can show it as written rather than guess.
 */
export function resolveDistrict(raw: string): District | null {
  let k = key(raw);
  if (!k) return null;
  // Drop a trailing "city corporation" / "district" so "Khulna City Corporation" matches Khulna.
  for (let i = 0; i < 2; i++) k = k.replace(NOISE, '');
  const aliased = ALIASES[key(raw)] ?? ALIASES[k];
  if (aliased) return BY_KEY.get(key(aliased)) ?? null;
  return BY_KEY.get(k) ?? null;
}

/** Match a "Reporting Division" cell ("Dhaka", "Barisal", "Chittagong"...) to a division key. */
export function resolveDivision(raw: string): RegionKey | null {
  const k = key(raw).replace(/division$/, '');
  if (!k) return null;
  // Every division shares its name with its headquarters district, so the
  // district lookup doubles as a division lookup.
  return resolveDistrict(k)?.division ?? null;
}
