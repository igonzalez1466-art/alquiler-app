import type { ReactNode } from "react";

export type AccountIconName = "shield" | "phone" | "wallet" | "box" | "listing" | "calendar" | "flag" | "receipt" | "star" | "edit" | "arrow";
const paths: Record<AccountIconName, ReactNode> = {
  shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" /><path d="m8 12 3 3 5-6" /></>,
  phone: <><rect x="7" y="2" width="10" height="20" rx="3" /><path d="M10 5h4M11 18h2" /></>,
  wallet: <><rect x="3" y="5" width="18" height="15" rx="3" /><path d="M3 9h18M16 14h2M6 5V3h12" /></>,
  box: <><path d="m12 3 9 5-9 5-9-5 9-5ZM3 8v9l9 5 9-5V8M12 13v9M7 5l10 5" /></>,
  listing: <><rect x="4" y="3" width="16" height="18" rx="3" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4M17 3v4M3 11h18M8 15h2M14 15h2" /></>,
  flag: <><path d="M5 21V3m0 1c5-3 9 3 14 0v10c-5 3-9-3-14 0" /></>,
  receipt: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
  star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z" />,
  edit: <><path d="m15 4 5 5-11 11H4v-5L15 4Z" /><path d="m12 7 5 5" /></>,
  arrow: <><path d="M5 12h14m-5-5 5 5-5 5" /></>,
};
export default function AccountIcon({ name, className = "h-5 w-5" }: { name: AccountIconName; className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" focusable="false">{paths[name]}</svg>;
}
