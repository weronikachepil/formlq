import {
  ArrowLeftRight,
  CircleDot,
  ListChecks,
  ListOrdered,
  PenLine,
  ToggleRight,
  type LucideIcon,
} from "lucide-react";
import type { TestQuestion } from "@/lib/tests";

export type QuestionType = TestQuestion["type"];

/** What «+ …» buttons add: a type, or «Так / Ні» (a two-option choice question). */
export type AddKind = QuestionType | "truefalse";

/** The «Додати завдання» menu, in groups; `hint` says what the student does. */
export const ADD_GROUPS: { title: string; kinds: { kind: AddKind; label: string; hint: string }[] }[] = [
  {
    title: "Вибір з варіантів",
    kinds: [
      { kind: "mcq", label: "Один варіант", hint: "Одна правильна відповідь з кількох" },
      { kind: "multi", label: "Кілька варіантів", hint: "Дві й більше правильних" },
      { kind: "truefalse", label: "Так / Ні", hint: "Чи правильне твердження" },
    ],
  },
  {
    title: "Учень відповідає сам",
    kinds: [
      { kind: "open", label: "Відповідь", hint: "Вписує число чи слово" },
      { kind: "matching", label: "Відповідність", hint: "Зʼєднує пари 1 → А" },
      { kind: "order", label: "Послідовність", hint: "Розставляє кроки по порядку" },
    ],
  },
];

export const TYPE_ICON: Record<QuestionType, LucideIcon> = {
  mcq: CircleDot,
  multi: ListChecks,
  open: PenLine,
  matching: ArrowLeftRight,
  order: ListOrdered,
};

export const KIND_ICON: Record<AddKind, LucideIcon> = { ...TYPE_ICON, truefalse: ToggleRight };

/** Compact type labels (lists, badges, filters). */
export const TYPE_LABELS: Record<QuestionType, string> = {
  mcq: "Один варіант",
  open: "Відповідь",
  matching: "Відповідність",
  multi: "Кілька відповідей",
  order: "Послідовність",
};

/** Descriptive type labels (editor header). */
export const TYPE_LABELS_LONG: Record<QuestionType, string> = {
  mcq: "Вибір відповіді",
  open: "Вписати відповідь",
  matching: "Відповідність",
  multi: "Кілька правильних відповідей",
  order: "Встановити послідовність",
};

export const DIFFICULTIES = [1, 2, 3, 4, 5] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
