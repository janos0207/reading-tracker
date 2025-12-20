import { ask } from "@tauri-apps/plugin-dialog";

/**
 * Confirmation dialog using Tauri's native API.
 * Returns true when the user confirms, false otherwise.
 */
export async function askConfirm(message: string): Promise<boolean> {
  return await ask(message);
}
