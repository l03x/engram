import { useRef, type ReactElement } from "react";

// A hidden file input opened from any button or menu item, so the trigger can be styled freely.
// Several deck files can be picked at once.
export function useFilePicker(onFiles: (files: File[]) => void): {
  open: () => void;
  input: ReactElement;
} {
  const ref = useRef<HTMLInputElement>(null);
  const input = (
    <input
      ref={ref}
      type="file"
      accept=".json,application/json"
      multiple
      hidden
      onChange={(event) => {
        const files = [...(event.target.files ?? [])];
        // Cleared so picking the same files again (after fixing them) fires another change.
        event.target.value = "";
        if (files.length > 0) onFiles(files);
      }}
    />
  );
  return { open: () => ref.current?.click(), input };
}
