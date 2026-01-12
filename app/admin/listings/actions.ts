"use server";

import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "../_lib/requireAdmin";
import { revalidatePath } from "next/cache";

export async function adminToggleListingAvailable(formData: FormData) {
  await requireAdmin();

  const listingId = String(formData.get("listingId") || "");
  const next = String(formData.get("next") || ""); // "true" | "false"
  const available = next === "true";

  if (!listingId) return;

  await prisma.listing.update({
    where: { id: listingId },
    data: { available },
  });

  revalidatePath("/admin/listings");
  revalidatePath("/listing");
  revalidatePath(`/listing/${listingId}`);
}
