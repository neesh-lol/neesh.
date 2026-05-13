CREATE TABLE "dm_read_cursors" (
	"id" serial PRIMARY KEY,
	"user_id" text NOT NULL,
	"partner_id" text NOT NULL,
	"last_read_message_id" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "uq_dm_read_cursor" UNIQUE("user_id","partner_id")
);
--> statement-breakpoint
CREATE TABLE "mentions" (
	"id" serial PRIMARY KEY,
	"mentioned_user_id" text NOT NULL,
	"mentioner_user_id" text NOT NULL,
	"mentioner_display_name" text NOT NULL,
	"message_type" text NOT NULL,
	"message_id" integer NOT NULL,
	"room_id" integer,
	"content" text NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now()
);
