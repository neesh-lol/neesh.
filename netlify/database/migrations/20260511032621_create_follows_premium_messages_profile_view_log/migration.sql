CREATE TABLE "follows" (
	"id" serial PRIMARY KEY,
	"follower_id" text NOT NULL,
	"following_id" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "uq_follow" UNIQUE("follower_id","following_id")
);
--> statement-breakpoint
CREATE TABLE "premium_messages" (
	"id" serial PRIMARY KEY,
	"user_id" text NOT NULL,
	"display_name" text NOT NULL,
	"avatar_url" text DEFAULT '',
	"content" text NOT NULL,
	"reply_to_id" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "profile_view_log" (
	"id" serial PRIMARY KEY,
	"profile_owner_id" text NOT NULL,
	"viewer_id" text NOT NULL,
	"viewed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "is_premium" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "premium_since" timestamp;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "premium_expires" timestamp;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "stripe_subscription_id" text;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "is_founder_override" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "banner_url" text DEFAULT '';--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "profile_theme" text DEFAULT 'default';--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "profile_views" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "streak_freeze_used" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "streak_freeze_reset_month" text;