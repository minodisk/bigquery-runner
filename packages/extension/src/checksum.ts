import { createHash } from "crypto";

export const checksum = (text: string): string =>
  createHash("md5")
    .update(text.trimStart().trimEnd().replace(/\s+/g, " "))
    .digest("hex");
