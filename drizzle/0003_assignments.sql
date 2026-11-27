CREATE TYPE "public"."assignment_target" AS ENUM('user', 'department', 'everyone');--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"target_type" "assignment_target" NOT NULL,
	"target_user_id" uuid,
	"target_department" text,
	"due_at" timestamp with time zone,
	"note" text,
	"assigned_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assignments_course_idx" ON "assignments" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "assignments_user_idx" ON "assignments" USING btree ("target_user_id");--> statement-breakpoint
CREATE INDEX "assignments_dept_idx" ON "assignments" USING btree ("target_department");