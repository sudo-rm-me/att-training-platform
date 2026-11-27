import { redirect } from "next/navigation";
import { GraduationCap, Sparkles, Trophy, Gamepad2 } from "lucide-react";
import { signIn, devLoginEnabled, entraConfigured } from "@/auth";
import { getCurrentUser } from "@/lib/session";
import { Button, Card, Input, Label } from "@/components/ui";
import { APP_NAME } from "@/lib/brand";

export const metadata = { title: "Sign in" };

function MicrosoftLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden>
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

export default async function SignInPage(props: PageProps<"/signin">) {
  if (await getCurrentUser()) redirect("/");
  const sp = await props.searchParams;
  const callbackUrl = typeof sp.callbackUrl === "string" && sp.callbackUrl.startsWith("/") ? sp.callbackUrl : "/";
  const error = typeof sp.error === "string" ? sp.error : null;

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between overflow-hidden p-12 lg:flex">
        <div className="absolute inset-0 bg-brand-gradient opacity-95" />
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/15 blur-3xl" />
        <div className="absolute -bottom-32 left-10 h-96 w-96 rounded-full bg-[var(--accent)]/30 blur-3xl" />
        <div className="relative flex items-center gap-3 text-white">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/20 backdrop-blur">
            <GraduationCap className="h-6 w-6" />
          </div>
          <span className="font-display text-xl font-bold">{APP_NAME}</span>
        </div>
        <div className="relative text-white">
          <h1 className="font-display text-5xl font-bold leading-[1.05]">
            Learn something new.
            <br />
            Level up for it.
          </h1>
          <p className="mt-4 max-w-md text-white/80">
            Bite-sized courses, quick quizzes, points, badges and a leaderboard to climb.
          </p>
          <div className="mt-10 grid max-w-md grid-cols-3 gap-3">
            {[
              { icon: Sparkles, label: "Earn XP" },
              { icon: Trophy, label: "Win badges" },
              { icon: Gamepad2, label: "Build your avatar" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="rounded-2xl bg-white/12 p-4 backdrop-blur">
                <Icon className="h-5 w-5" />
                <div className="mt-2 text-sm font-semibold">{label}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative text-sm text-white/60">Sign in with your work account.</div>
      </section>

      <section className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md p-8">
          <div className="mb-6 lg:hidden">
            <span className="font-display text-2xl font-bold text-gradient">{APP_NAME}</span>
          </div>
          <h2 className="font-display text-2xl font-bold">Welcome back 👋</h2>
          <p className="mt-1 text-sm text-muted">Use your company Microsoft account to continue.</p>

          {error && (
            <div className="mt-4 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
              Sign-in failed ({error}). Please try again or contact your administrator.
            </div>
          )}

          {entraConfigured ? (
            <form
              className="mt-6"
              action={async () => {
                "use server";
                await signIn("microsoft-entra-id", { redirectTo: callbackUrl });
              }}
            >
              <Button size="lg" className="w-full">
                <span className="grid h-6 w-6 place-items-center rounded bg-white">
                  <MicrosoftLogo />
                </span>
                Sign in with Microsoft
              </Button>
            </form>
          ) : (
            <div className="mt-6 rounded-xl border border-dashed border-border p-4 text-sm text-muted">
              Microsoft sign-in isn&apos;t configured yet. Set <code>AUTH_MICROSOFT_ENTRA_ID_ID</code>,{" "}
              <code>AUTH_MICROSOFT_ENTRA_ID_SECRET</code> and <code>AUTH_MICROSOFT_ENTRA_ID_ISSUER</code>.
            </div>
          )}

          {devLoginEnabled && (
            <form
              className="mt-8 space-y-3 border-t border-border pt-6"
              action={async (fd: FormData) => {
                "use server";
                await signIn("dev", {
                  name: fd.get("name"),
                  email: fd.get("email"),
                  department: fd.get("department"),
                  redirectTo: callbackUrl,
                });
              }}
            >
              <div className="text-xs font-bold uppercase tracking-widest text-accent">Local development login</div>
              <div>
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" placeholder="Ada Lovelace" />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" required placeholder="ada@example.com" />
              </div>
              <div>
                <Label htmlFor="department">Department</Label>
                <Input id="department" name="department" placeholder="Engineering" />
              </div>
              <Button variant="secondary" className="w-full">
                Continue as dev user
              </Button>
            </form>
          )}
        </Card>
      </section>
    </main>
  );
}
