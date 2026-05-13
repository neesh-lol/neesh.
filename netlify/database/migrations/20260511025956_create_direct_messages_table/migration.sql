CREATE TABLE "direct_messages" (
	"id" serial PRIMARY KEY,
	"sender_id" text NOT NULL,
	"receiver_id" text NOT NULL,
	"sender_display_name" text NOT NULL,
	"sender_avatar_url" text DEFAULT '',
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "is_founder" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "badge_type" text DEFAULT 'standard' NOT NULL;