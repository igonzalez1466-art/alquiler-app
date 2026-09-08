"use server";

import Stripe from "stripe";
import { redirect } from "next/navigation";
import { getSession } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("Brak STRIPE_SECRET_KEY");
  }

  return new Stripe(secretKey, {
    apiVersion: "2025-09-30.clover",
  });
}

function getAppUrl() {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.AUTH_URL;

  if (!baseUrl) {
    throw new Error("Brak adresu aplikacji");
  }

  return baseUrl.replace(/\/$/, "");
}

export async function startStripeConnectOnboarding() {
  const session = await getSession();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/login?callbackUrl=/account");
  }

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      email: true,
      stripeAccountId: true,
    },
  });

  if (!user) {
    throw new Error("Użytkownik nie istnieje");
  }

  const stripe = getStripe();

  let stripeAccountId = user.stripeAccountId;

  if (!stripeAccountId) {
    const account = await stripe.accounts.create({
      type: "express",
      country: "PL",
      email: user.email ?? undefined,
      capabilities: {
        transfers: {
          requested: true,
        },
      },
      metadata: {
        userId: user.id,
      },
    });

    stripeAccountId = account.id;

    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        stripeAccountId,
      },
    });
  }

  const appUrl = getAppUrl();

  const accountLink = await stripe.accountLinks.create({
    account: stripeAccountId,
    refresh_url: `${appUrl}/account?stripe=refresh`,
    return_url: `${appUrl}/account?stripe=return`,
    type: "account_onboarding",
  });

  redirect(accountLink.url);
}