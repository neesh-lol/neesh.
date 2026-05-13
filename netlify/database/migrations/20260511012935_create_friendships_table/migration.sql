CREATE TABLE "friendships" (
	"id" serial PRIMARY KEY,
	"requester_id" text NOT NULL,
	"addressee_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "uq_friendship" UNIQUE("requester_id","addressee_id")
);
