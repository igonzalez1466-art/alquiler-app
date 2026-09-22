"use server";

import { getSession } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { checkPhoneCode, normalizePhone, sendPhoneCode } from "@/app/lib/phoneVerification";
import { revalidatePath } from "next/cache";

const RESEND_WAIT_MS = 30_000;

export async function startPhoneVerification(rawPhone: string) {
  const session = await getSession();
  if (!session?.user?.id) return { ok: false as const, message: "Zaloguj się ponownie." };
  let phone: string;
  try { phone = normalizePhone(rawPhone); }
  catch (error) { return { ok: false as const, message: error instanceof Error ? error.message : "Nieprawidłowy numer." }; }
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { phone: true, phoneVerifiedAt: true, phoneVerificationSentAt: true } });
  if (!user) return { ok: false as const, message: "Nie znaleziono konta." };
  if (user.phone === phone && user.phoneVerifiedAt) return { ok: true as const, alreadyVerified: true as const, maskedPhone: phone };
  if (user.phoneVerificationSentAt && Date.now() - user.phoneVerificationSentAt.getTime() < RESEND_WAIT_MS) {
    return { ok: false as const, message: "Poczekaj 30 sekund przed wysłaniem kolejnego kodu." };
  }
  try { await sendPhoneCode(phone); }
  catch (error) { return { ok: false as const, message: error instanceof Error ? error.message : "Nie udało się wysłać kodu." }; }
  await prisma.user.update({ where: { id: session.user.id }, data: { phoneVerificationTarget: phone, phoneVerificationSentAt: new Date() } });
  return { ok: true as const, alreadyVerified: false as const, maskedPhone: phone };
}

export async function confirmPhoneVerification(code: string) {
  const session = await getSession();
  if (!session?.user?.id) return { ok: false as const, message: "Zaloguj się ponownie." };
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { phoneVerificationTarget: true, phoneVerificationSentAt: true } });
  if (!user?.phoneVerificationTarget || !user.phoneVerificationSentAt || Date.now() - user.phoneVerificationSentAt.getTime() > 10 * 60_000) {
    return { ok: false as const, message: "Kod wygasł. Wyślij nowy kod." };
  }
  let approved = false;
  try { approved = await checkPhoneCode(user.phoneVerificationTarget, code.trim()); }
  catch (error) { return { ok: false as const, message: error instanceof Error ? error.message : "Nie udało się sprawdzić kodu." }; }
  if (!approved) return { ok: false as const, message: "Kod jest nieprawidłowy lub wygasł." };
  try {
    await prisma.user.update({ where: { id: session.user.id }, data: {
      phone: user.phoneVerificationTarget, phoneVerifiedAt: new Date(), phoneVerificationTarget: null, phoneVerificationSentAt: null,
    } });
  } catch {
    return { ok: false as const, message: "Ten numer telefonu jest już przypisany do innego konta." };
  }
  revalidatePath("/account");
  return { ok: true as const };
}
