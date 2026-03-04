export const api = {
  inquiries: {
    create: {
      path: "/api/inquiries",
      method: "POST" as const,
    },
  },
} as const;

export type { InsertInquiry } from "./schema";
