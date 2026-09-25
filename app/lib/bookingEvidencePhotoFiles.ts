export const MAX_PHOTOS_PER_PERSON_AND_STAGE = 3;

const MAX_PHOTO_BYTES = 750_000;

function validImage(type: string, bytes: Uint8Array) {
  if (type === "image/jpeg") return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes.length > 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
  if (type === "image/webp") return bytes.length > 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  return false;
}

export async function prepareBookingEvidencePhotoFiles(files: File[]) {
  return Promise.all(files.map(async file => {
    if (file.size > MAX_PHOTO_BYTES) throw new Error("Każde zdjęcie może mieć maksymalnie 750 KB.");
    const data = new Uint8Array(await file.arrayBuffer());
    if (!validImage(file.type, data)) throw new Error("Dodaj zdjęcia JPG, PNG lub WebP.");
    return { mimeType: file.type, data };
  }));
}
