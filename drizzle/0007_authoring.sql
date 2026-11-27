CREATE TABLE "course_ratings" (
	"user_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"stars" integer NOT NULL,
	"comment" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_ratings_user_id_course_id_pk" PRIMARY KEY("user_id","course_id")
);
--> statement-breakpoint
CREATE TABLE "course_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"slides" jsonb NOT NULL,
	"note" text,
	"published_by" uuid,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attempt_answers" DROP CONSTRAINT "attempt_answers_slide_id_slides_id_fk";
--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "version_id" uuid;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "question_ids" jsonb;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "draw_questions" integer;--> statement-breakpoint
ALTER TABLE "slides" ADD COLUMN "require_media" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "course_ratings" ADD CONSTRAINT "course_ratings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_ratings" ADD CONSTRAINT "course_ratings_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_versions" ADD CONSTRAINT "course_versions_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_versions" ADD CONSTRAINT "course_versions_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "course_ratings_course_idx" ON "course_ratings" USING btree ("course_id");--> statement-breakpoint
CREATE UNIQUE INDEX "course_versions_course_version" ON "course_versions" USING btree ("course_id","version");--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_version_id_course_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."course_versions"("id") ON DELETE set null ON UPDATE no action;