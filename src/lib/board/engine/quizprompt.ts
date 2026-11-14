// AI prompt that converts a test (text, PDF or photo) into the import format.
export const QUIZ_PROMPT = `Convert the test below into a plain-text import format for an educational platform.

OUTPUT LANGUAGE: Ukrainian. All question text, options, matching items and explanations must be written in Ukrainian (keep the original wording if the test is already in Ukrainian; translate otherwise). The field labels and type names below are part of the format and must be copied EXACTLY as shown, in Ukrainian.

Output ONLY the file content — no comments before or after it, no markdown code fences.

FORMAT RULES
1. Every question starts with a header line: ### <number> | <type> | <points>
   Allowed types (copy verbatim): "Вибір відповіді" (1 point), "Відповідність" (3 points), "Вписати відповідь" (2 points).
2. Each field starts on a new line with its UPPERCASE label followed by a colon. A value may span several lines.
3. All math must be LaTeX inside $...$ (e.g. $\\sqrt{x}$, $\\frac{a}{b}$, $x^2$). Never use \\( \\) or \\[ \\].
4. Option letters must be CYRILLIC only: А, Б, В, Г, Д (not Latin A, B).
5. If a question has a picture/graph, add the line "ЗОБРАЖЕННЯ: <file-name>.png" with a short Latin file name (e.g. q5.png). List the pictures to be saved under these names at the VERY BEGINNING, before the first ###. If there is no picture, omit the line.
6. If no explanation is given, solve the question and write a short solution in Ukrainian. Double-check that the correct answer matches your solution.

MULTIPLE CHOICE
### 1 | Вибір відповіді | 1
ТЕКСТ: <question text>
ЗОБРАЖЕННЯ: <file>   (only if there is a picture)
А) <option>
Б) <option>
В) <option>
Г) <option>
Д) <option>
ПРАВИЛЬНА: <one letter>
ПОЯСНЕННЯ: <solution>
ЗОБРАЖЕННЯ ДО ПОЯСНЕННЯ: <file>   (only if there is a picture)

MATCHING
### 2 | Відповідність | 3
ТЕКСТ: <question text>
ЛІВА КОЛОНКА:
1. <item>
2. <item>
3. <item>
ПРАВА КОЛОНКА:
А. <option>
Б. <option>
В. <option>
Г. <option>
Д. <option>
ПРАВИЛЬНІ ПАРИ: 1-Г, 2-В, 3-А
ПОЯСНЕННЯ: <solution>

SHORT ANSWER
### 3 | Вписати відповідь | 2
ТЕКСТ: <question text>
ПРАВИЛЬНА ВІДПОВІДЬ: <a number only, no units; use a comma as the decimal separator, e.g. 2,5>
ПОЯСНЕННЯ: <solution>

TEST:
<paste the test here or attach a PDF/photo>`;
