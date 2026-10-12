"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import type { ActionResult, ErrorCode } from "@/lib/result";

type Failure = { ok: false; code: ErrorCode; message: string };

/**
 * Runs a Server Action and applies the caller rules of 01-CONTRACTS §5:
 * UNAUTHENTICATED ⇒ /login · CONFLICT ⇒ message + refresh · others ⇒ message.
 * `onFail` may handle a failure inline (return true) instead, e.g. a form error box.
 */
export function useAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const run = useCallback(
    <T,>(fn: () => Promise<ActionResult<T>>, onOk?: (data: T) => void, onFail?: (r: Failure) => boolean) => {
      setError("");
      startTransition(async () => {
        try {
          const r = await fn();
          if (r.ok) {
            onOk?.(r.data);
            return;
          }
          if (onFail?.(r)) return;
          if (r.code === "UNAUTHENTICATED") {
            router.push("/login");
            return;
          }
          setError(r.message);
          if (r.code === "CONFLICT") router.refresh();
        } catch {
          setError("Không kết nối được máy chủ, vui lòng thử lại.");
        }
      });
    },
    [router],
  );

  return { pending, error, setError, run };
}
