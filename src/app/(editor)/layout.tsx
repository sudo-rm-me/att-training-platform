import { requirePermission } from "@/lib/session";

export default async function EditorLayout({ children }: { children: React.ReactNode }) {
  await requirePermission("author");
  return <>{children}</>;
}
