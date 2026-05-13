CREATE TABLE "terms_acceptances" (
	"id" serial PRIMARY KEY,
	"netlify_id" text NOT NULL,
	"terms_accepted" boolean DEFAULT false NOT NULL,
	"terms_accepted_date" timestamp DEFAULT now(),
	"subscription_disclosure_accepted" boolean DEFAULT false NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now()
);
