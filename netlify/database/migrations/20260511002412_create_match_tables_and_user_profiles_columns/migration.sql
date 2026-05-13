CREATE TABLE "match_group_members" (
	"id" serial PRIMARY KEY,
	"group_id" integer NOT NULL,
	"netlify_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_groups" (
	"id" serial PRIMARY KEY,
	"created_at" timestamp DEFAULT now(),
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_messages" (
	"id" serial PRIMARY KEY,
	"group_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"display_name" text NOT NULL,
	"avatar_url" text DEFAULT '',
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_challenges" (
	"id" serial PRIMARY KEY,
	"netlify_id" text NOT NULL,
	"challenge_key" text NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp,
	CONSTRAINT "uq_user_challenge" UNIQUE("netlify_id","challenge_key")
);
--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "total_xp" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "current_streak" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "longest_streak" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "last_active_date" text;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "last_username_change" timestamp;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "weekly_match_opt_in" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_username_key" UNIQUE("username");--> statement-breakpoint
ALTER TABLE "match_group_members" ADD CONSTRAINT "match_group_members_group_id_match_groups_id_fkey" FOREIGN KEY ("group_id") REFERENCES "match_groups"("id");--> statement-breakpoint
ALTER TABLE "match_messages" ADD CONSTRAINT "match_messages_group_id_match_groups_id_fkey" FOREIGN KEY ("group_id") REFERENCES "match_groups"("id");