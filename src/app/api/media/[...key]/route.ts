import { auth } from "@/auth";
import { getFile, typeForKey } from "@/lib/storage";

export async function GET(_req: Request, ctx: RouteContext<"/api/media/[...key]">) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const { key } = await ctx.params;
  const k = key.join("/");
  const file = await getFile(k);
  if (!file) return new Response("Not found", { status: 404 });

  const type = typeForKey(k);
  return new Response(file.body as BodyInit, {
    headers: {
      "Content-Type": type,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      // SVGs can carry script; never let them run in our origin.
      ...(type === "image/svg+xml" && { "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox" }),
      ...(file.size && { "Content-Length": String(file.size) }),
    },
  });
}
