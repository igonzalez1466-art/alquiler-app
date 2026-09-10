"use client";

import { useState } from "react";

export default function PhotosField() {
  const [count, setCount] = useState(0);
  return (
    <div className="flex-1">
      <label htmlFor="photos" className="sr-only">Dodaj co najmniej 3 zdjęcia</label>
      <input
        id="photos"
        type="file"
        name="photos"
        accept="image/*"
        multiple
        required
        aria-describedby="photos-hint"
        onChange={(event) => {
          const input = event.currentTarget;
          const files = Array.from(input.files ?? []);
          setCount(files.length);
          input.setCustomValidity(
            files.length < 3
              ? "Dodaj co najmniej 3 zdjęcia, aby opublikować ogłoszenie."
              : files.some((file) => file.size === 0 || !file.type.startsWith("image/"))
                ? "Wybierz niepuste pliki ze zdjęciami."
                : ""
          );
        }}
        className="block w-full text-sm text-gray-700 file:mr-4 file:rounded-lg file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-gray-700 hover:file:bg-gray-200"
      />
      <p id="photos-hint" aria-live="polite" className="mt-2 text-xs text-gray-500">
        Wybrane zdjęcia: {count}. Minimum: 3. Wybierz wszystkie zdjęcia jednocześnie.
      </p>
    </div>
  );
}
