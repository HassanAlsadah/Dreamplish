import type { BriefErrorCode } from "./types";

export class BriefingError extends Error {
  constructor(
    public code: BriefErrorCode,
    message: string,
  ) {
    super(message);
  }
}
