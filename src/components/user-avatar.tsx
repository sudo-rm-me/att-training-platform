import type { AvatarConfig } from "@/db/schema";
import { starterAvatar } from "@/lib/avatar";
import { cn } from "@/lib/utils";
import { AvatarSvg } from "./avatar-svg";

export function UserAvatar({
  name,
  avatar,
  className,
}: {
  name: string;
  avatar?: AvatarConfig | null;
  className?: string;
}) {
  return (
    <div className={cn("h-10 w-10 shrink-0 overflow-hidden rounded-full", className)}>
      <AvatarSvg config={avatar ?? starterAvatar(name)} title={name} className="h-full w-full" />
    </div>
  );
}
