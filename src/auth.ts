import NextAuth, { type NextAuthConfig } from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Credentials from "next-auth/providers/credentials";
import { upsertUserFromSignIn } from "@/lib/users";

export const devLoginEnabled =
  process.env.AUTH_DEV_LOGIN === "true" && process.env.NODE_ENV !== "production";

export const entraConfigured = Boolean(
  process.env.AUTH_MICROSOFT_ENTRA_ID_ID && process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
);

type GraphMe = { department?: string | null; jobTitle?: string | null };

async function fetchGraphProfile(accessToken?: string): Promise<GraphMe> {
  if (!accessToken) return {};
  try {
    const res = await fetch(
      "https://graph.microsoft.com/v1.0/me?$select=department,jobTitle",
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) return {};
    return (await res.json()) as GraphMe;
  } catch {
    return {};
  }
}

const providers: NextAuthConfig["providers"] = [];

if (entraConfigured) {
  providers.push(
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
      // Skip the default profile-photo download; we use in-app avatars.
      profile(profile) {
        return {
          id: (profile.oid as string) ?? profile.sub,
          name: profile.name,
          email: (profile.email as string) ?? (profile.preferred_username as string),
        };
      },
    }),
  );
}

if (devLoginEnabled) {
  providers.push(
    Credentials({
      id: "dev",
      name: "Developer login",
      credentials: {
        name: { label: "Name" },
        email: { label: "Email" },
        department: { label: "Department" },
      },
      async authorize(creds) {
        const email = String(creds?.email ?? "").trim().toLowerCase();
        if (!email) return null;
        return {
          id: `dev:${email}`,
          email,
          name: String(creds?.name || email.split("@")[0]),
          department: String(creds?.department || "") || null,
        } as { id: string; email: string; name: string; department: string | null };
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  trustHost: true,
  pages: { signIn: "/signin" },
  callbacks: {
    async jwt({ token, account, profile, user }) {
      // Only on the initial sign-in: create/refresh the local user record.
      if (account) {
        if (account.provider === "microsoft-entra-id") {
          const graph = await fetchGraphProfile(account.access_token);
          const p = (profile ?? {}) as Record<string, unknown>;
          const dbUser = await upsertUserFromSignIn({
            entraOid: (p.oid as string) ?? user?.id ?? null,
            email: String(p.email ?? p.preferred_username ?? user?.email ?? ""),
            name: String(p.name ?? user?.name ?? ""),
            department: graph.department ?? null,
            jobTitle: graph.jobTitle ?? null,
          });
          token.uid = dbUser.id;
        } else if (account.provider === "dev" && user?.email) {
          const dbUser = await upsertUserFromSignIn({
            entraOid: null,
            email: user.email,
            name: user.name ?? user.email,
            department: (user as { department?: string | null }).department ?? null,
            jobTitle: null,
          });
          token.uid = dbUser.id;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.uid) (session.user as { id?: string }).id = token.uid as string;
      return session;
    },
  },
});
