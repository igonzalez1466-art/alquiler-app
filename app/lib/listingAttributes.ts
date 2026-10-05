export const SPORT_OPTIONS = [
  { value: "BIEGANIE", label: "Bieganie" },
  { value: "FITNESS", label: "Fitness" },
  { value: "JOGA", label: "Joga" },
  { value: "PILATES", label: "Pilates" },
  { value: "ROWER", label: "Jazda na rowerze" },
  { value: "PILKA_NOZNA", label: "Piłka nożna" },
  { value: "KOSZYKOWKA", label: "Koszykówka" },
  { value: "TENIS", label: "Tenis" },
  { value: "PLYWANIE", label: "Pływanie" },
  { value: "NARCIARSTWO", label: "Narciarstwo" },
  { value: "SNOWBOARD", label: "Snowboard" },
  { value: "TURYSTYKA", label: "Turystyka i trekking" },
  { value: "WSPINACZKA", label: "Wspinaczka" },
  { value: "TANIEC", label: "Taniec" },
  { value: "SPORTY_WALKI", label: "Sporty walki" },
  { value: "INNY", label: "Inny sport" },
] as const;

export type SportCode = (typeof SPORT_OPTIONS)[number]["value"];

export function isSportCode(value: string): value is SportCode {
  return SPORT_OPTIONS.some((option) => option.value === value);
}

export function sportLabel(value: string | null | undefined): string | null {
  return SPORT_OPTIONS.find((option) => option.value === value)?.label ?? null;
}

export const ACCESSORY_OPTIONS = [
  { value: "PASEK", label: "Pasek" },
  { value: "TOREBKA", label: "Torebka" },
  { value: "PLECAK", label: "Plecak" },
  { value: "PORTFEL", label: "Portfel" },
  { value: "BIZUTERIA", label: "Biżuteria" },
  { value: "ZEGAREK", label: "Zegarek" },
  { value: "OKULARY", label: "Okulary przeciwsłoneczne" },
  { value: "SZAL", label: "Szal / chusta" },
  { value: "KAPELUSZ", label: "Kapelusz / czapka" },
  { value: "REKAWICZKI", label: "Rękawiczki" },
  { value: "KRAWAT", label: "Krawat" },
  { value: "MUCHA", label: "Muszka" },
  { value: "SPINKI", label: "Spinki do mankietów" },
  { value: "WLOSY", label: "Ozdoby do włosów" },
  { value: "INNE", label: "Inne akcesoria" },
] as const;
export function isAccessoryCode(value: string): boolean { return ACCESSORY_OPTIONS.some(o => o.value === value); }
export function accessoryLabel(value: string | null | undefined): string | null { return ACCESSORY_OPTIONS.find(o => o.value === value)?.label ?? null; }
