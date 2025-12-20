declare module "@tauri-apps/api/dialog" {
  export function ask(message: string, options?: unknown): Promise<boolean>;
}
