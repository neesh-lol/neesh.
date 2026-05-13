CREATE TABLE "admin_audit_logs" (
	"id" serial PRIMARY KEY,
	"admin_id" text NOT NULL,
	"action" text NOT NULL,
	"target_user_id" text,
	"target_message_id" integer,
	"message_type" text,
	"details" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_bans" (
	"id" serial PRIMARY KEY,
	"netlify_id" text NOT NULL,
	"reason" text DEFAULT '',
	"permanent" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp,
	"banned_by" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
