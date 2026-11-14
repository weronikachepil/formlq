import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { queryKeys, STALE } from "@/lib/queryKeys";
import { canTutor } from "@/lib/roles";
import { getStudentTutorLinks } from "@/lib/tutor";

/**
 * Whether the signed-in student belongs to any teacher. `undefined` while
 * loading (and for staff, who are never students). Students without a teacher
 * learn on their own: no homework or lessons, a different home page.
 */
export function useHasTutor(): boolean | undefined {
  const { user, userProfile } = useAuth();
  const student = !!user && !!userProfile && !canTutor(userProfile.role);
  const { data } = useQuery({
    queryKey: queryKeys.studentTutors(user?.uid),
    queryFn: () => getStudentTutorLinks(user!.uid),
    enabled: student,
    staleTime: STALE.medium,
  });
  return student && data ? data.length > 0 : undefined;
}
