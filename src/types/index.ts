import type { Timestamp } from "firebase/firestore";

export type UserRole = "student" | "editor" | "tutor";

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: Timestamp | null;
  lastActivity: Timestamp | null;
  totalXP: number;
  role: UserRole;
  /** A teacher's invite code for students (src/lib/invites.ts). */
  inviteCode?: string;
  /** When they solved all 24 advent windows: the gift imitations show in «Тести» (lib/advent-gift.ts). */
  adventGiftAt?: Timestamp | null;
}

export interface Topic {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  order: number;
  questionCount: number;
}
