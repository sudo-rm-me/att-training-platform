import { Award, Download, Eye } from "lucide-react";
import { requireUser } from "@/lib/session";
import { certificateNumber, certificatesFor } from "@/lib/certificates";
import { getTheme } from "@/lib/themes";
import { Card, EmptyState, LinkButton, PageHeader, buttonClass } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Certificates" };

export default async function CertificatesPage() {
  const user = await requireUser();
  const certs = await certificatesFor(user.id);

  return (
    <div>
      <PageHeader
        eyebrow="Achievements"
        title="Certificates"
        subtitle="Every course you pass earns a certificate. View it, download it, or share it with whoever needs proof."
      />
      {certs.length === 0 ? (
        <EmptyState
          icon={<Award className="h-6 w-6" />}
          title="No certificates yet"
          body="Pass a course to earn your first certificate."
          action={<LinkButton href="/courses">Browse courses</LinkButton>}
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {certs.map((c) => {
            const theme = getTheme(c.theme);
            const href = `/api/certificates/${c.courseId}`;
            return (
              <Card key={c.courseId} className="group overflow-hidden">
                <div className="relative p-1.5" style={{ background: theme.background }}>
                  <div className="relative rounded-[1.1rem] bg-card-solid/95 px-5 py-6 text-center">
                    <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-brand">Certificate of completion</div>
                    <div className="mt-3 text-4xl transition-transform duration-500 group-hover:scale-110">{c.courseIcon}</div>
                    <div className="mt-2 line-clamp-2 font-display text-lg font-bold leading-snug">{c.courseTitle}</div>
                    <div className="mt-1 text-sm text-muted">{user.name}</div>
                    <div className="mx-auto mt-4 flex w-fit items-center gap-3 text-xs">
                      <span className="rounded-full bg-success/12 px-2.5 py-0.5 font-bold text-success">{c.bestScore}%</span>
                      <span className="text-muted">{formatDate(c.issuedAt)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-4">
                  <span className="flex-1 truncate font-mono text-xs text-muted" title="Certificate number">
                    {certificateNumber(c.attemptId)}
                  </span>
                  <a href={href} target="_blank" rel="noopener" className={buttonClass("secondary", "sm")}>
                    <Eye className="h-4 w-4" /> View
                  </a>
                  <a href={`${href}?download=1`} className={buttonClass("primary", "sm")}>
                    <Download className="h-4 w-4" /> PDF
                  </a>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
