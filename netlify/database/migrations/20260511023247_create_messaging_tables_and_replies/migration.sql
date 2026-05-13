CREATE TABLE "message_reactions" (
	"id" serial PRIMARY KEY,
	"message_type" text NOT NULL,
	"message_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"display_name" text NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "uq_reaction" UNIQUE("message_type","message_id","user_id","emoji")
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" serial PRIMARY KEY,
	"reporter_id" text NOT NULL,
	"message_type" text NOT NULL,
	"message_id" integer NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "typing_indicators" (
	"id" serial PRIMARY KEY,
	"room_type" text NOT NULL,
	"room_id" integer,
	"user_id" text NOT NULL,
	"display_name" text NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_blocks" (
	"id" serial PRIMARY KEY,
	"blocker_id" text NOT NULL,
	"blocked_id" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "uq_block" UNIQUE("blocker_id","blocked_id")
);
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "reply_to_id" integer;--> statement-breakpoint
ALTER TABLE "community_messages" ADD COLUMN "reply_to_id" integer;