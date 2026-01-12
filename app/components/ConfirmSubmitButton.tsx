// app/components/ConfirmSubmitButton.tsx
"use client";

import React from "react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  confirmText: string;
};

export default function ConfirmSubmitButton({ confirmText, onClick, ...rest }: Props) {
  return (
    <button
      type="submit" // 👈 IMPRESCINDIBLE
      onClick={(e) => {
        // si el usuario cancela, evitamos que el form se envíe
        if (!confirm(confirmText)) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        onClick?.(e);
      }}
      {...rest}
    />
  );
}
