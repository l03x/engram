import { api, ApiError, UserFacingError } from "@/lib/api";
import { readJsonFile } from "@/lib/form";

// Mirrors MAX_FILES_PER_IMPORT in backend/app/deck_format.py.
export const MAX_FILES_PER_IMPORT = 50;

// The server names a bad file by its position (files[2].cards[0].front: …); people know it by
// its name.
export function nameTheFile(error: unknown, files: readonly File[]): unknown {
  if (!(error instanceof ApiError)) return error;
  const match = /^files\[(\d+)\]\.?/.exec(error.message);
  const file = match ? files[Number(match[1])] : undefined;
  if (!match || !file) return error;
  const rest = error.message.slice(match[0].length);
  return new ApiError(error.status, `${file.name}${rest.startsWith(":") ? "" : ": "}${rest}`);
}

// Several deck files go up in one request, and the server imports all of them or none.
export async function importDeckFiles<T>(path: string, files: readonly File[]): Promise<T> {
  if (files.length > MAX_FILES_PER_IMPORT) {
    throw new UserFacingError(
      `You picked ${String(files.length)} files. Import at most ${String(MAX_FILES_PER_IMPORT)} at a time.`,
    );
  }
  const decks = await Promise.all(files.map(readJsonFile));
  try {
    return await api<T>(path, { method: "POST", body: { files: decks } });
  } catch (error) {
    throw nameTheFile(error, files);
  }
}
