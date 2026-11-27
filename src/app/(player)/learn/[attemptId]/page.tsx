import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { AttemptError, getPlayerData } from "@/lib/attempts";
import { getTheme } from "@/lib/themes";
import { Player } from "./player";

export default async function LearnPage(props: PageProps<"/learn/[attemptId]">) {
  const user = await requireUser();
  const { attemptId } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(attemptId)) notFound();

  let data;
  try {
    data = await getPlayerData(attemptId, user.id);
  } catch (e) {
    if (e instanceof AttemptError) notFound();
    throw e;
  }
  if (data.attempt.completedAt) redirect(`/learn/${attemptId}/results`);

  return (
    <Player
      attemptId={attemptId}
      courseId={data.course.id}
      courseTitle={data.course.title}
      theme={getTheme(data.course.theme)}
      slides={data.slides}
      initialIndex={data.attempt.currentSlide}
      initialFeedback={data.feedback}
    />
  );
}
