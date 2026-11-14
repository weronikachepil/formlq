"use client";

import { createContext, useContext } from "react";
import { studentColor, type ColorOf } from "./colors";

const StudentColorsContext = createContext<ColorOf>(studentColor);

export const StudentColorsProvider = StudentColorsContext.Provider;

/** Colour lookup for the calendar's students. */
export function useStudentColor(): ColorOf {
  return useContext(StudentColorsContext);
}
