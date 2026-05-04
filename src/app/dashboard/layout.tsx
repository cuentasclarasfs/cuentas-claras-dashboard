import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import type { Role } from "@/lib/roles";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await currentUser();
  const role = ((user?.publicMetadata?.role as Role) ?? "ops") as Role;

  return (
    <div className="min-h-screen flex">
      <Sidebar role={role} />
      <main
        className="flex-1 min-h-screen overflow-y-auto"
        style={{ marginLeft: "var(--sidebar-width)" }}
      >
        <div className="max-w-7xl mx-auto px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
