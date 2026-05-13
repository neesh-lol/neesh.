CREATE TABLE "chat_messages" (
	"id" serial PRIMARY KEY,
	"room_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"display_name" text NOT NULL,
	"avatar_url" text DEFAULT '',
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chat_rooms" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL,
	"interest" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "community_messages" (
	"id" serial PRIMARY KEY,
	"user_id" text NOT NULL,
	"display_name" text NOT NULL,
	"avatar_url" text DEFAULT '',
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" serial PRIMARY KEY,
	"netlify_id" text NOT NULL UNIQUE,
	"display_name" text NOT NULL,
	"bio" text DEFAULT '',
	"avatar_url" text DEFAULT '',
	"interests" json DEFAULT '[]',
	"message_count" integer DEFAULT 0 NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_room_id_chat_rooms_id_fkey" FOREIGN KEY ("room_id") REFERENCES "chat_rooms"("id");