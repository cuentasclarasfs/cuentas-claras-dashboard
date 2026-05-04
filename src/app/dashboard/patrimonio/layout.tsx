"use client";

import { useState } from "react";
import { PinGate } from "@/components/patrimonio/PinGate";

export default function PatrimonioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [unlocked, setUnlocked] = useState(false);

  if (!unlocked) {
    return <PinGate onUnlock={() => setUnlocked(true)} />;
  }

  return <>{children}</>;
}
