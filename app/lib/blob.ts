// app/lib/blob.ts
"use server";

import { put } from "@vercel/blob";

export async function uploadImageToBlob(file: File) {
  if (!file || file.size === 0) {
    throw new Error("No file provided");
  }

  const blob = await put(file.name, file, {
    access: "public",
  });

  return blob.url; // ⬅️ ESTA URL se guarda en la BD
}
