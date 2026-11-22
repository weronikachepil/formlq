import { SectionLabel } from "@/components/ui/section-label";
import { TextInput } from "@/components/ui/text-field";
import { Select, SelectItem } from "@/components/ui/select";
import { GRADES, SUBJECT_LABEL, type TestSubject } from "@/lib/tests";
import { StepButton } from "./primitives";

const MIN_DURATION = 5;
const MAX_DURATION = 360;

const NONE = "none";

/** Description / grade / subject / duration of a test (the title is in the header). */
export function TestMetaCard({
  subtitle,
  onSubtitleChange,
  durationMinutes,
  onDurationChange,
  descriptionRequired = false,
  grade,
  onGradeChange,
  subject,
  onSubjectChange,
}: {
  subtitle: string;
  onSubtitleChange: (v: string) => void;
  durationMinutes: number;
  onDurationChange: (v: number) => void;
  /** Mark the description as required (a teacher publishing to the catalog). */
  descriptionRequired?: boolean;
  grade: number | null;
  onGradeChange: (v: number | null) => void;
  subject: TestSubject | null;
  onSubjectChange: (v: TestSubject | null) => void;
}) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-5">
      <div className="space-y-1.5">
        <SectionLabel as="label" htmlFor="test-subtitle">
          Короткий опис{descriptionRequired && <span className="text-destructive"> *</span>}
        </SectionLabel>
        <TextInput
          id="test-subtitle"
          value={subtitle}
          onChange={(e) => onSubtitleChange(e.target.value)}
          maxLength={140}
          placeholder="Тема, рівень, варіант — наприклад «Квадратні рівняння · базовий рівень»"
        />
      </div>

      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <div className="space-y-1.5">
          <SectionLabel>Клас</SectionLabel>
          <Select
            value={grade === null ? NONE : String(grade)}
            onValueChange={(v) => onGradeChange(v === NONE ? null : Number(v))}
            className="min-w-36"
          >
            <SelectItem value={NONE}>Не вказано</SelectItem>
            {GRADES.map((g) => (
              <SelectItem key={g} value={String(g)}>
                {g} клас
              </SelectItem>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <SectionLabel>Розділ</SectionLabel>
          <Select
            value={subject ?? NONE}
            onValueChange={(v) => onSubjectChange(v === NONE ? null : (v as TestSubject))}
            className="min-w-36"
          >
            <SelectItem value={NONE}>Не вказано</SelectItem>
            {(Object.keys(SUBJECT_LABEL) as TestSubject[]).map((s) => (
              <SelectItem key={s} value={s}>
                {SUBJECT_LABEL[s]}
              </SelectItem>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <SectionLabel as="label" htmlFor="test-duration">
            Тривалість
          </SectionLabel>
          <div className="flex items-center gap-1.5">
            <StepButton
              aria-label="Зменшити тривалість"
              onClick={() => onDurationChange(Math.max(MIN_DURATION, durationMinutes - 5))}
              disabled={durationMinutes <= MIN_DURATION}
              className="w-9 h-9"
            >
              −
            </StepButton>
            <div className="relative">
              <TextInput
                id="test-duration"
                type="number"
                min={MIN_DURATION}
                max={MAX_DURATION}
                value={durationMinutes}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v) && v >= MIN_DURATION) onDurationChange(Math.min(MAX_DURATION, v));
                }}
                className="w-24 pr-9 text-center tabular-nums font-semibold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                хв
              </span>
            </div>
            <StepButton
              aria-label="Збільшити тривалість"
              onClick={() => onDurationChange(Math.min(MAX_DURATION, durationMinutes + 5))}
              disabled={durationMinutes >= MAX_DURATION}
              className="w-9 h-9"
            >
              +
            </StepButton>
          </div>
        </div>

      </div>
    </div>
  );
}
