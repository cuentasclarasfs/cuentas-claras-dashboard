"use client";

import { useState, useTransition } from "react";
import { validatePatrimonioPin } from "@/app/dashboard/patrimonio/actions";
import { Lock } from "lucide-react";

interface Props {
  onUnlock: () => void;
}

export function PinGate({ onUnlock }: Props) {
  const [pin, setPin]     = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const ok = await validatePatrimonioPin(pin);
      if (ok) {
        onUnlock();
      } else {
        setError("PIN incorrecto");
        setPin("");
      }
    });
  }

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="card w-full max-w-sm text-center">
        <div className="flex justify-center mb-4">
          <div className="p-3 rounded-full bg-surface-700/50">
            <Lock size={22} className="text-slate-400" />
          </div>
        </div>
        <h2 className="text-base font-bold text-white mb-1">Sección protegida</h2>
        <p className="text-xs text-slate-500 mb-6">Ingresá tu PIN para acceder a Patrimonio</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            autoFocus
            placeholder="••••••"
            className="w-full text-center text-lg tracking-[0.4em] bg-surface-800 border border-surface-700
                       text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-600
                       placeholder:tracking-normal placeholder:text-slate-600"
          />
          {error && (
            <p className="text-xs text-rose-400 font-medium">{error}</p>
          )}
          <button
            type="submit"
            disabled={isPending || !pin}
            className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-semibold
                       rounded-lg py-2.5 text-sm transition-colors"
          >
            {isPending ? "Verificando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}
