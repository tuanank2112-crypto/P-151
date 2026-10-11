import "server-only";
import { MAX_PHOTO_BYTES } from "@/lib/constants";
import { BackendError } from "./backend-error";

/** Files from a browser FormData entry list, ignoring empty file inputs */
export function filesOf(fd: FormData, field: string): File[] {
  return fd
    .getAll(field)
    .filter((f): f is File => typeof f === "object" && f !== null && "arrayBuffer" in f && (f as File).size > 0);
}

/**
 * Forwards the browser's files as the backend's multipart field `files`. The backend is the authority on count,
 * size and real image type; this only fails early with a clear message (SPEC-P02 §5).
 */
export function photoForm(files: File[], max = 5): FormData {
  if (files.length > max) throw new BackendError(422, "INVALID_INPUT", `Tối đa ${max} ảnh.`);
  const out = new FormData();
  for (const f of files) {
    if (f.size > MAX_PHOTO_BYTES) throw new BackendError(422, "INVALID_INPUT", `Ảnh "${f.name}" lớn hơn 5 MB.`);
    out.append("files", f, f.name);
  }
  return out;
}
