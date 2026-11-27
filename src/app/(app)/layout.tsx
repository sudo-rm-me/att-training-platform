import { listNotifications } from "@/lib/notifications";
import { requireUser, can } from "@/lib/session";
import { buildNav } from "@/components/shell/nav";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { APP_NAME } from "@/lib/brand";
import { getMyAssignments } from "@/lib/assignments";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const sections = buildNav({
    author: can.author(user.role),
    manage: can.manage(user.role),
    admin: can.admin(user.role),
  });

  const reminders = (await getMyAssignments(user.id, user.department, user.teamId))
    .filter((a) => a.state === "overdue" || a.state === "due_soon" || a.state === "renew")
    .map((a) => ({
      courseId: a.course.id,
      title: a.course.title,
      icon: a.course.icon,
      state: a.state,
      text: a.text,
    }));

  const updates = (await listNotifications(user.id, 15)).map((n) => ({
    id: n.id,
    kind: n.kind,
    title: n.title,
    body: n.body,
    link: n.link,
    unread: !n.readAt,
    at: n.createdAt.toISOString(),
  }));

  return (
    <div className="flex min-h-screen">
      <Sidebar sections={sections} appName={APP_NAME} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} sections={sections} appName={APP_NAME} reminders={reminders} updates={updates} />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 md:px-8">{children}</main>
      </div>
    </div>
  );
}
