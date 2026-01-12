"use client";
import { useState } from "react";

export default function StarRating({
  name = "rating",
  defaultValue = 0,
}: { name?: string; defaultValue?: number }) {
  const [hover, setHover] = useState(0);
  const [value, setValue] = useState(defaultValue);

  return (
    <div className="flex items-center gap-1">
      <input type="hidden" name={name} value={value} />
      {[1, 2, 3, 4, 5].map((n) => {
        const active = (hover || value) >= n;
        return (
          <button
            key={n}
            type="button"
            aria-label={`${n} estrellas`}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setValue(n)}
            className={active ? "text-yellow-500" : "text-gray-300"}
          >
            ★
          </button>
        );
      })}
    </div>
  );
}
