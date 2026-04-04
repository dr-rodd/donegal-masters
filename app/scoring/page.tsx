import { supabase } from "@/lib/supabase"
import CoursePortalClient from "./CoursePortalClient"

export const dynamic = "force-dynamic"

export default async function ScoringPage() {
  const { data: courses } = await supabase
    .from("courses")
    .select("id, name")

  const courseIds: Record<string, string> = {}
  for (const c of courses ?? []) {
    courseIds[c.name] = c.id
  }

  return (
    <div className="min-h-screen bg-[#071210]">
      <div className="max-w-lg mx-auto">
        <div className="px-5 pt-8 pb-2">
          <h1 className="font-[family-name:var(--font-playfair)] text-white text-2xl">
            Courses
          </h1>
          <p className="text-white/35 text-sm mt-1">Select a course to score or view live</p>
        </div>
        <CoursePortalClient courseIds={courseIds} />
      </div>
    </div>
  )
}
