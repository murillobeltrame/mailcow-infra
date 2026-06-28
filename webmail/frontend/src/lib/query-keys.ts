export const mailKeys = {
  all: ["mail"] as const,
  folders: ["mail", "folders"] as const,
  messages: (folder: string, query?: string) => ["mail", "messages", folder, query ?? ""] as const,
  message: (folder: string, uid: number) => ["mail", "message", folder, uid] as const,
};
