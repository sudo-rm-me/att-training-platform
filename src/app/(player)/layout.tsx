import { requireUser } from "@/lib/session";

export default async function PlayerLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return <div className="min-h-screen">{children}</div>;
}
