// app/reset-password/page.tsx
import { Suspense } from "react";
import ResetPasswordClient from "./ResetPasswordClient";

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-sm mx-auto mt-10">
          <h1 className="text-xl font-bold mb-4">Resetowanie hasła</h1>
          <p className="text-gray-600">Ładuję…</p>
        </div>
      }
    >
      <ResetPasswordClient />
    </Suspense>
  );
}
