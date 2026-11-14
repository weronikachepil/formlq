"use client";

import { usePageHeader } from "@/context/HeaderContext";
import { BoardsList } from "@/components/boards/BoardsList";

export default function TutorBoardsPage() {
  usePageHeader("Дошки", "Інтерактивні дошки для уроків");
  return (
    <BoardsList
      fallbackName="Вчитель"
      emptyHint="Створіть першу дошку і поділіться посиланням з учнями."
    />
  );
}
