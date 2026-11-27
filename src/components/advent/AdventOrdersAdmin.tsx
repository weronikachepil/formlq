"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { JAR_URL, approveOrder, getAllOrders, rejectOrder, type AdventOrder } from "@/lib/advent-shop";

const STATUS: Record<AdventOrder["status"], { label: string; cls: string }> = {
  pending: { label: "чекає", cls: "bg-[#fdf3d3] text-[#14262a]" },
  paid: { label: "підтверджено", cls: "bg-mint/60 text-[#14262a]" },
  rejected: { label: "відхилено", cls: "bg-muted text-muted-foreground" },
};

function when(o: AdventOrder) {
  return o.createdAt?.toDate().toLocaleString("uk-UA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) ?? "";
}

/**
 * Editors: orders paid into the Monobank jar. Match each by its reference in the jar
 * comment and amount, then confirm (grants access / creates the teacher's codes) or reject.
 */
export function AdventOrdersAdmin() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showAll, setShowAll] = useState(false);
  const { data: orders = [], isLoading } = useQuery({ queryKey: ["adventOrdersAll"], queryFn: getAllOrders });
  const pending = orders.filter((o) => o.status === "pending");
  const list = showAll ? orders : pending;
  const paidSum = orders.filter((o) => o.status === "paid").reduce((s, o) => s + o.amount, 0);

  const decide = useMutation({
    mutationFn: ({ o, ok }: { o: AdventOrder; ok: boolean }) => (ok ? approveOrder(o, user!.uid) : rejectOrder(o)),
    onSuccess: (_, { o, ok }) => {
      toast.success(ok ? `${o.ref}: доступ видано` : `${o.ref}: відхилено`);
      qc.invalidateQueries({ queryKey: ["adventOrdersAll"] });
    },
    onError: () => toast.error("Не вдалося. Перевірте, що правила Firestore опубліковані."),
  });

  return (
    <section className="space-y-4 rounded-[18px] bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl font-bold">Замовлення календаря</h2>
          <p className="text-sm text-muted-foreground">
            Нових: {pending.length} · підтверджено на {paidSum} грн.{" "}
            {JAR_URL ? (
              <a href={JAR_URL} target="_blank" rel="noopener noreferrer" className="underline">Відкрити банку</a>
            ) : (
              <span className="font-semibold text-[#c2410c]">Посилання на банку ще не задане (JAR_URL у lib/advent-shop.ts).</span>
            )}
          </p>
        </div>
        <Button variant="outline" className="h-10 rounded-xl" onClick={() => setShowAll(!showAll)}>
          {showAll ? "Лише нові" : `Усі замовлення (${orders.length})`}
        </Button>
      </div>

      {isLoading ? (
        <div className="h-20 animate-pulse rounded-xl bg-muted/60" />
      ) : list.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          {showAll ? "Замовлень ще немає." : "Нових замовлень немає."}
        </p>
      ) : (
        <ul className="divide-y divide-border/50 overflow-hidden rounded-xl border border-border/50">
          {list.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <span className="font-mono text-base font-bold">{o.ref}</span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{o.name} <span className="font-normal text-muted-foreground">{o.email}</span></span>
                <span className="block text-xs text-muted-foreground">
                  {o.kind === "self" ? "Учень, для себе" : `Викладач, ${o.qty} код(ів)`} · {when(o)}
                </span>
              </span>
              <span className="font-heading text-lg font-bold tabular-nums">{o.amount} грн</span>
              <span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", STATUS[o.status].cls)}>{STATUS[o.status].label}</span>
              {o.status === "pending" && (
                <span className="ml-auto flex gap-2">
                  <Button className="h-10 rounded-xl" disabled={decide.isPending} onClick={() => decide.mutate({ o, ok: true })}>
                    <Check size={16} /> Підтвердити
                  </Button>
                  <Button variant="outline" className="h-10 rounded-xl" disabled={decide.isPending} onClick={() => decide.mutate({ o, ok: false })}>
                    <X size={16} /> Відхилити
                  </Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
