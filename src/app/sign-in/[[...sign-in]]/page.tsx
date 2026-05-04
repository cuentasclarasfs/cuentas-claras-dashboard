import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-surface-950 flex flex-col items-center justify-center gap-6">
      <div className="flex flex-col items-center gap-2 mb-2">
        <span className="text-2xl font-bold tracking-tight text-white">
          Cuentas Claras
        </span>
        <span className="text-sm text-slate-400">Panel interno de métricas</span>
      </div>
      <SignIn
        appearance={{
          variables: {
            colorPrimary: "#0ea5e9",
            colorBackground: "#1e293b",
            colorText: "#f1f5f9",
            colorInputBackground: "#0f172a",
            colorInputText: "#f1f5f9",
          },
        }}
      />
    </div>
  );
}
