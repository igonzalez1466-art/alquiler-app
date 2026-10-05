"use server";
import { getSession } from "@/app/lib/auth";
import { revalidatePath } from "next/cache";
import { cancelBookingByRenter } from "@/app/lib/renterCancellation";

export async function cancelByRenterAction(data: FormData) {
  const userId = (await getSession())?.user?.id;
  if (!userId) throw new Error("Zaloguj się, aby anulować rezerwację.");
  const id = String(data.get("bookingId") ?? "");
  if (!id || data.get("confirm") !== "yes") throw new Error("Potwierdź anulowanie rezerwacji.");
  const status = await cancelBookingByRenter(id, userId);
  for (const path of [`/bookings/${id}`, "/bookings", "/account", "/account/incidents", `/account/incidents/${id}`]) revalidatePath(path);
  return { status };
}
