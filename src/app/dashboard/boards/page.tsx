"use client";

import { usePageHeader } from "@/context/HeaderContext";
import { BoardsList } from "@/components/boards/BoardsList";

export default function StudentBoardsPage() {
  usePageHeader("Дошки", "Мої дошки та дошки уроків");
  return (
    <BoardsList
      fallbackName="Учень"
      emptyHint="Створіть дошку для чернеток чи розвʼязків — нею можна поділитися за посиланням."
    />
  );
}
