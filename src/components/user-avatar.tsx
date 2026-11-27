import type { AvatarConfig } from "@/db/schema";
import { cn, initials } from "@/lib/utils";

export function UserAvatar({
  name,
  className,
}: {
  name: string;
  avatar?: AvatarConfig | null;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-gradient text-sm font-bold text-white",
        className,
      )}
      aria-label={name}
    >
      {initials(name)}
    </div>
  );
}
