# Фіча «Учень ↔ Вчитель»

Взаємодія репетитора з учнями: вчитель призначає домашні завдання (готові тести або власні набори з банку), бачить результати, учень проходить, прикріплює фото, позначає питання «качкою», обидва мають спільний календар занять.

---

## 1. Ролі

`UserRole = "student" | "editor" | "tutor"` — [src/types/index.ts](../src/types/index.ts)

| Роль | Доступ |
|------|--------|
| `student` | `/dashboard` — тести, домашні, календар (read-only) |
| `tutor` | усе студентське + острів «ВЧ» → `/tutor/*` |
| `editor` | усе + острів «ADM» → `/admin/*` (editor може все, що tutor) |

**Призначення ролі:** editor у `/admin/users` — кнопка циклює `Учень → Вчитель → Редактор` ([cycleRole](../src/app/admin/users/page.tsx)).

**Навігація:** один сайдбар [AppSidebar](../src/components/AppSidebar.tsx) з секціями через розділювачі (студент / ВЧ / ADM). `/tutor` використовує той самий dashboard-layout ([src/app/tutor/layout.tsx](../src/app/tutor/layout.tsx)), гейт — роль tutor/editor.

---

## 2. Модель даних (Firestore)

### `tutorStudents/{tutorId}_{studentId}`
Звʼязок вчитель↔учень. ID детермінований (запобігає дублям).
```
{ tutorId, studentId, studentEmail, studentName, createdAt }
```

### `groups/{autoId}`
Група учнів вчителя (клас, «НМТ вечірня»). Склад — список на групі; учень може бути в кількох групах. — [src/lib/groups.ts](../src/lib/groups.ts)
```
{ tutorId, name, studentIds: string[], boardId?, createdAt }
```
Домашка й уроки для групи **копіюються кожному учню** (окремий `homework` / `lessons` документ з позначкою групи), тому запити й правила учня не змінюються. Учень, доданий у групу пізніше, отримує лише нові завдання й уроки. Видалення групи не чіпає вже виданого.

### `homework/{autoId}`
Домашнє завдання. — [src/lib/tutor.ts](../src/lib/tutor.ts)
```
{
  tutorId, tutorName, studentId, studentName,
  title, note?,
  source: "test" | "custom",
  testId?,                     // source=test → посилання на TestDoc
  questions?: TestQuestion[],  // source=custom → знімок питань
  scoreTable, scaleType, durationMinutes,
  assignedAt, dueAt?,
  status: "assigned" | "in_progress" | "completed",
  resultId?,                   // лінк на testResult після здачі
  progress?: { answers, answerImages }  // автозбереження для resume
  groupId?, groupName?, assignId?       // видано групі: копії всіх учнів мають спільний assignId
}
```
Домашка групі (`assignHomeworkToGroup`) — одна копія на кожного учня групи одним batch. Сторінка [`/tutor/groups/[groupId]`](../src/app/tutor/groups/[groupId]/page.tsx) будує таблицю «учні × завдання» з копій із цим `groupId` (стовпець = `assignId`); бали — з `testResults` по `resultId` кожної копії (по одному документу: правило `ownsHomework` не дозволяє list-запит).

### `testResults/{autoId}` (розширено)
Існуюча колекція + поля для домашки — [src/lib/tests.ts](../src/lib/tests.ts)
```
homeworkId?, answerImages?, flaggedQuestions?, tutorComments?, tutorNote?
```

### `lessons/{autoId}`
Заняття календаря. — [src/lib/lessons.ts](../src/lib/lessons.ts)
```
{
  tutorId, tutorName, studentId, studentName, title, start: Timestamp, durationMin,
  note?, meetingUrl?, seriesId?,            // seriesId — спільний для щотижневої серії
  status?: "planned" | "done" | "canceled" | "missed", price?, paid?,
  boardId?,                                 // дошка учня (або групи для групового уроку)
  groupId?, groupName?                      // груповий урок
}
```
**Груповий урок** — копія на кожного учня групи (`createGroupLessons`): своя ціна й оплата, спільні `groupId` + `start` (одне заняття, `groupMembersOf`); щотижнева групова серія має один `seriesId` на всіх, тож «цей і наступні» охоплює всю групу. У календарі вчителя, «Найближчих уроках» і адмінці копії згортаються в один блок (`collapseGroupLessons`); перенесення, статус і видалення діють на всі копії, оплата — на кожного окремо; статистика рахує урок один раз, а гроші — за кожного учня. Дошка групи — `groups.boardId` (створюється при першому «Відкрити дошку»); власна дошка учня ігнорує його групові уроки.

---

## 3. Сценарій вчителя

1. **`/tutor/students`** — додати учня за email ([addStudentByEmail](../src/lib/tutor.ts)): пошук user у `users`, перевірка дублю, створення лінку. Realtime-список ([subscribeTutorStudents](../src/lib/tutor.ts)).
2. **`/tutor/homework/new`** — конструктор:
   - **Готовий тест** — вибір з опублікованих тестів (вкл. імітації НМТ). Зберігає `testId` + знімок `scoreTable/scaleType`.
   - **З банку завдань** — вибір окремих питань (фільтри тема/тип/пошук), конвертація [bankToTestQuestion](../src/lib/tests.ts), власна лінійна шкала.
   - + учень, дедлайн, коментар.
3. **`/tutor/homework`** — список призначених, статуси (realtime).
4. **`/tutor/homework/[id]`** — перевірка: бали ([ScoreHeader](../src/components/exam/ScoreHeader.tsx)), пер-питання розбір ([QuestionCard](../src/components/exam/QuestionCard.tsx)), фото учня, питання з 🦆, коментарі (зберігаються onBlur у `tutorComments`/`tutorNote`).
5. **`/tutor/calendar`** — місячна сітка ([MonthCalendar](../src/components/calendar/MonthCalendar.tsx)), CRUD занять на учня.

---

## 4. Сценарій учня

1. **`/dashboard`** — блок «Найближче домашнє завдання» (найближчий дедлайн серед невиконаних).
2. **`/dashboard/homework`** — список (статуси, прострочені — червоним).
3. **`/dashboard/homework/[id]`** — раннер на спільному [ExamRunner](../src/components/exam/ExamRunner.tsx):
   - **Без таймера** (`untimed`).
   - До відкритих питань — **фото** (Cloudinary, [uploadQuestionImage](../src/lib/storage.ts)).
   - **Автозбереження** прогресу (debounce 800мс → `homework.progress` + статус `in_progress`). Вихід → продовжити пізніше (кнопка «Продовжити»).
   - Автооцінка як у звичайному тесті.
   - Після здачі — пояснення + флаг 🦆 (`flaggedQuestions`, зберігається одразу).
   - Завершено → `status: completed` + `resultId`; повторний вхід відкриває результат у режимі перегляду.
4. **`/dashboard/calendar`** — read-only календар + список найближчих занять.

---

## 5. Спільний ExamRunner

[src/components/exam/ExamRunner.tsx](../src/components/exam/ExamRunner.tsx) — єдине джерело логіки іспиту (фази intro/exam/results, таймер, confetti, підрахунок). Звичайний іспит і домашка — обидва через нього.

Ключові пропси:
| Проп | Призначення |
|------|-------------|
| `config` | `{ id, title, questions, scoreTable, scaleType, durationMinutes }` |
| `untimed` | без таймера (домашка) |
| `allowAnswerImages` + `uploadImage` | фото до відкритих питань |
| `allowFlags` + `onToggleFlag` | 🦆-прапорці на екрані результатів |
| `onProgress` | автозбереження (resume) |
| `initialAnswers/initialAnswerImages` | відновлення прогресу |
| `initialResult` | відкрити одразу в режимі перегляду |
| `onSubmit` | персист результату (повертає resultId) |

---

## 6. Безпека (Firestore Rules)

[firestore.rules](../firestore.rules):
- `users` — читання будь-який залогінений (пошук учня за email), запис — власник/editor.
- `homework` — читання/запис tutor-власник або студент-адресат; create лише tutor зі своїм tutorId.
- `tutorStudents` — tutor керує своїми; `resource == null` дозволяє читання неіснуючого доку (перевірка дублю перед create).
- `testResults` — власник читає/оновлює свій (флаги); tutor читає/коментує результати своїх домашок (через `ownsHomework()`).
- `lessons` — tutor керує своїми, студент читає свої.
- `groups` — лише tutor-власник (і editor); учням доступ не потрібен.

> **Деплой:** правила діють лише після Publish у Firebase Console (або `firebase deploy --only firestore:rules`). Локальний файл застосунок не читає.

---

## 7. Карта файлів

**Бібліотеки**
- [src/lib/tutor.ts](../src/lib/tutor.ts) — звʼязки, домашні (CRUD + subscribe)
- [src/lib/lessons.ts](../src/lib/lessons.ts) — заняття
- [src/lib/groups.ts](../src/lib/groups.ts) — групи учнів (CRUD + subscribe); діалог — [GroupDialog](../src/components/tutor/GroupDialog.tsx)
- [src/lib/tests.ts](../src/lib/tests.ts) — `bankToTestQuestion`, `recalcStreak`, `updateResult`, розширений `TestResult`
- [src/lib/users.ts](../src/lib/users.ts) — `getUserByEmail`, `updateUserRole`

**Компоненти**
- [ExamRunner](../src/components/exam/ExamRunner.tsx), [MonthCalendar](../src/components/calendar/MonthCalendar.tsx), [AppSidebar](../src/components/AppSidebar.tsx), [MobileNav](../src/components/MobileNav.tsx)

**Сторінки вчителя** — `src/app/tutor/`: `students`, `groups/[groupId]`, `homework`, `homework/new`, `homework/[id]`, `calendar`
**Сторінки учня** — `src/app/dashboard/`: `homework`, `homework/[id]`, `calendar`, `page.tsx` (блок домашки)

---

## 8. Поза скоупом (можливі доповнення)
- Аналітика успішності учня / звіт для батьків (згадано в ТЗ як add-on).
- Нормалізація `users.email` у lowercase (зараз пошук має fallback зі скануванням колекції).
