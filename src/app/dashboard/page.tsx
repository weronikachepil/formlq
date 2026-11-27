"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { canTutor, isEditor } from "@/lib/roles";
import { queryKeys } from "@/lib/queryKeys";
import { getTips } from "@/lib/tips";
import { DailyTip } from "@/components/dashboard/DailyTip";
import { DailyQuestion } from "@/components/dashboard/DailyQuestion";
import { UpcomingHomework } from "@/components/dashboard/UpcomingHomework";
import { CalendarWidget } from "@/components/dashboard/CalendarWidget";
import { JoinTutorCard } from "@/components/dashboard/JoinTutorCard";
import { TutorLessonsWidget, TutorOverview } from "@/components/dashboard/TutorDashboard";
import { SoloBoardsCard, SoloOverview } from "@/components/dashboard/SoloDashboard";
import { useHasTutor } from "@/hooks/useHasTutor";
import { StudentActions } from "@/components/dashboard/QuickAction";
import { AdventDashboardCard } from "@/components/advent/AdventPromo";

export default function DashboardPage() {
  const { user, userProfile } = useAuth();

  const { data: tips = [] } = useQuery({
    queryKey: queryKeys.tips,
    queryFn: getTips,
    enabled: !!user && !canTutor(userProfile?.role),
    staleTime: 10 * 60 * 1000,
  });

  const tutor = canTutor(userProfile?.role);
  // Teachers make their own tests; editors manage the catalog in the admin area.
  const teacher = tutor && !isEditor(userProfile?.role);

  // A student without a teacher studies on their own: tests, progress, boards.
  const hasTutor = useHasTutor();
  const solo = !!user && !tutor && hasTutor === false;
  const withTutor = !!user && !tutor && hasTutor === true;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">
      <div className="space-y-6">
        {(solo || withTutor) && <AdventDashboardCard />}
        {(solo || withTutor) && <StudentActions withTutor={withTutor} />}
        {/* The tip and the daily task are for students; teachers and editors see their own work. */}
        {!tutor && <DailyTip tips={tips} />}
        {user && tutor && <TutorOverview tutorId={user.uid} ownTests={teacher} />}
        {solo && <SoloOverview userId={user.uid} />}
        {user && userProfile && !tutor && <DailyQuestion userId={user.uid} />}
        {withTutor && <UpcomingHomework userId={user.uid} />}
      </div>

      <div className="space-y-6">
        {user && tutor && <TutorLessonsWidget tutorId={user.uid} />}
        {withTutor && <CalendarWidget userId={user.uid} />}
        {solo && (
          <>
            <SoloBoardsCard userId={user.uid} />
            <JoinTutorCard compact />
          </>
        )}
      </div>
    </div>
  );
}
