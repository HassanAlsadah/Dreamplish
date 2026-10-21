import { z } from "zod";
import { optionalText } from "./common";

export const profileSchema = z.object({
  name: optionalText(100),
  cvText: optionalText(50_000),
});
