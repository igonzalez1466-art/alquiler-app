export async function prepareBookingPhoto(file: File): Promise<File> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Wybierz zdjęcia JPG, PNG lub WebP.");
  if (file.size <= 700_000) return file;
  const url = URL.createObjectURL(file);
  const image = new window.Image();
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Nie udało się odczytać zdjęcia."));
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Nie udało się przygotować zdjęcia.");
    for (const side of [1600, 1280, 1024, 800]) {
      const scale = Math.min(1, side / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.82, 0.7, 0.58]) {
        const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error("Nie udało się przygotować zdjęcia.")), "image/jpeg", quality));
        if (blob.size <= 700_000) return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
      }
    }
    throw new Error("Zdjęcie jest zbyt duże. Wybierz mniejszy plik.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
