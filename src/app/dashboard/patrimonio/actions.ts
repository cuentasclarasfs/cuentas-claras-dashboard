"use server";

import { createHash } from "crypto";

export async function validatePatrimonioPin(pin: string): Promise<boolean> {
  if (!pin || !process.env.PATRIMONIO_PIN) return false;
  const expected = createHash("sha256").update(process.env.PATRIMONIO_PIN).digest("hex");
  const provided = createHash("sha256").update(pin.trim()).digest("hex");
  return expected === provided;
}
