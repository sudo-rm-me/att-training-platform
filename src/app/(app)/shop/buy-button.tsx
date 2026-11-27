"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { Coins, Loader2 } from "lucide-react";
import { Button } from "@/components/ui";
import { buyItemAction } from "../avatar/actions";

export function BuyButton({ itemKey, price, label, affordable }: { itemKey: string; price: number; label: string; affordable: boolean }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  return (
    <Button
      size="sm"
      className="w-full"
      variant={affordable ? "primary" : "secondary"}
      disabled={pending || !affordable}
      onClick={() =>
        start(async () => {
          const res = await buyItemAction(itemKey);
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          confetti({ particleCount: 70, spread: 60, origin: { y: 0.7 }, colors: ["#ffb547", "#6d4aff", "#ff7ab6"] });
          toast.success(`${label} unlocked! Equip it in the character creator.`);
          for (const b of res.badges) toast.success(`Badge unlocked: ${b} 🏅`);
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />}
      {price}
    </Button>
  );
}
