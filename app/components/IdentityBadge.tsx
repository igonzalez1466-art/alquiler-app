import { publicIdentityVerified } from "@/app/lib/identityVerification";
export default function IdentityBadge({ user }: { user: { identityStatus?: string; identityLivemode?: boolean | null; identityVerifiedAt?: Date | null } }) {
  if (!publicIdentityVerified(user)) return null;
  return <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">✓ Tożsamość zweryfikowana</span>;
}
