"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ReferenceDrawerProvider } from "@/context/ReferenceDrawerContext";
import {
  assignmentStatus,
  getAssignmentContent,
  submitAttempt,
  subscribeAssignment,
  type Assignment,
  type AssignmentContent,
} from "@/lib/assignments";
import { ExamRunner } from "@/components/exam/ExamRunner";
import { uploadQuestionImage } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/text-field";
import { SpinnerScreen } from "@/components/ui/spinner";

const ReferenceDrawer = dynamic(
  () => import("@/components/ReferenceDrawer").then((m) => ({ default: m.ReferenceDrawer })),
  { ssr: false },
);

/** What this browser remembers after submitting, so a reload shows the score instead of a new attempt. */
interface Done {
  name: string;
  raw: number;
  max: number;
}
const doneKey = (id: string) => `formlq-attempt:${id}`;
function readDone(id: string): Done | null {
  try {
    const v = localStorage.getItem(doneKey(id));
    return v ? (JSON.parse(v) as Done) : null;
  } catch {
    return null;
  }
}

const fmt = (ms: number) =>
  new Date(ms).toLocaleString("uk", { weekday: "short", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

function countdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d) return `${d} д ${h} год`;
  if (h) return `${h} год ${m} хв`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/**
 * A test given by link for a time window: waits for the start, asks for the student's
 * name, runs the test and submits automatically when the window closes.
 */
export default function AssignmentPage() {
  const { id } = useParams<{ id: string }>();
  const { userProfile, user } = useAuth();
  const [a, setA] = useState<Assignment | null | undefined>(undefined);
  const [now, setNow] = useState(() => Date.now());
  const [done, setDone] = useState<Done | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [content, setContent] = useState<AssignmentContent | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [contentError, setContentError] = useState(false);

  useEffect(() => subscribeAssignment(id, setA), [id]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  // Restore after a reload (browser storage is read after mount: it does not exist on the server).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of browser storage
    setDone(readDone(id));
  }, [id]);
  // A signed-in student's name is filled in for them.
  const [prefilled, setPrefilled] = useState(false);
  if (!prefilled && userProfile?.displayName) {
    const [f = "", ...rest] = userProfile.displayName.trim().split(/\s+/);
    setFirstName(f);
    setLastName(rest.join(" "));
    setPrefilled(true);
  }

  if (a === undefined) return <SpinnerScreen />;
  if (a === null) return <Screen emoji="🫥" title="Тестування не знайдено" text="Перевірте посилання у вчителя." />;

  const status = assignmentStatus(a, now);

  if (done && !content) {
    return (
      <Screen emoji="✅" title="Роботу здано" text={`${done.name}, ваш результат: ${done.raw} з ${done.max} балів.`}>
        <p className="text-xs text-muted-foreground">{a.title}</p>
      </Screen>
    );
  }

  if (status === "scheduled") {
    return (
      <Screen emoji="⏳" title={a.title} text={`Тест відкриється ${fmt(a.opensAt.toMillis())}.`}>
        <p className="text-3xl font-heading font-extrabold tabular-nums">{countdown(a.opensAt.toMillis() - now)}</p>
        <p className="text-xs text-muted-foreground">
          {a.ownerName ? `Вчитель: ${a.ownerName} · ` : ""}Сторінка оновиться сама.
        </p>
      </Screen>
    );
  }

  if (status === "closed" && !content) {
    return <Screen emoji="🔒" title={a.title} text={`Тестування завершилося ${fmt(a.closesAt.toMillis())}.`} />;
  }

  if (!content) {
    const ready = firstName.trim().length > 0 && lastName.trim().length > 0;
    async function start(e: React.FormEvent) {
      e.preventDefault();
      if (!ready) return;
      setLoadingContent(true);
      setContentError(false);
      try {
        const c = await getAssignmentContent(id);
        if (c) setContent(c);
        else setContentError(true);
      } catch {
        // Usually a clock a little ahead of the server's: the window has not opened there yet.
        setContentError(true);
      } finally {
        setLoadingContent(false);
      }
    }
    return (
      <Screen emoji="📝" title={a.title} text={`${a.questionCount} завдань · до ${fmt(a.closesAt.toMillis())}`}>
        <form onSubmit={start} className="w-full space-y-3 text-left">
          <TextInput value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Імʼя" maxLength={40} autoFocus />
          <TextInput value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Прізвище" maxLength={40} />
          {contentError && <p className="text-sm text-red-600 dark:text-red-400">Не вдалося відкрити тест. Спробуйте ще раз за хвилину.</p>}
          <Button type="submit" size="lg" className="w-full" disabled={!ready || loadingContent}>
            {loadingContent ? "Відкриваю…" : "Почати тест"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Час на тест — до {a.durationMinutes} хв. Коли час завершиться, відповіді надішлються автоматично.
          </p>
        </form>
      </Screen>
    );
  }

  const name = `${firstName.trim()} ${lastName.trim()}`;
  return (
    <ReferenceDrawerProvider>
      <ReferenceDrawer />
      <ExamRunner
        config={{
          id: a.id,
          title: a.title,
          subtitle: content.subtitle,
          questions: content.questions,
          scoreTable: content.scoreTable,
          scaleType: content.scaleType,
          durationMinutes: a.durationMinutes,
        }}
        deadline={a.closesAt.toMillis()}
        allowAnswerImages
        photoOnAll
        uploadImage={(questionId, file) => uploadQuestionImage(id, questionId, file)}
        backHref={null}
        introNote={`${name} · тест закриється ${fmt(a.closesAt.toMillis())}, тоді відповіді надішлються автоматично.`}
        startLabel="Почати →"
        onSubmit={async (p) => {
          const attemptId = await submitAttempt(id, {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            uid: user?.uid,
            answers: p.answers,
            answerImages: p.answerImages,
            questions: p.questions,
            rawScore: p.rawScore,
            nmtScore: p.nmtScore,
            maxRaw: p.maxRaw,
            timeSpent: p.timeSpent,
            auto: Date.now() >= a.closesAt.toMillis() - 2000 || p.timeSpent >= a.durationMinutes * 60 - 2,
          });
          const d: Done = { name, raw: p.rawScore, max: p.maxRaw };
          try {
            localStorage.setItem(doneKey(id), JSON.stringify(d));
          } catch {
            // private mode: the score is still shown now
          }
          setDone(d);
          return attemptId;
        }}
        resultsHref="/"
        resultsLabel="formlq"
      />
    </ReferenceDrawerProvider>
  );
}

function Screen({ emoji, title, text, children }: { emoji: string; title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-[2rem] border border-glass-edge bg-popover shadow-glass-lg p-6 text-center space-y-3 flex flex-col items-center">
        <span className="mb-logo text-[1.6rem] select-none">formlq</span>
        <p className="text-4xl">{emoji}</p>
        <h1 className="font-heading font-bold text-xl">{title}</h1>
        <p className="text-sm text-muted-foreground">{text}</p>
        {children}
      </div>
    </div>
  );
}
