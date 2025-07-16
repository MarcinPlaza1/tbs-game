CREATE TABLE IF NOT EXISTS "active_game_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"colyseus_room_id" varchar(255) NOT NULL,
	"session_id" varchar(255),
	"last_activity" timestamp DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "csrf_tokens";--> statement-breakpoint
ALTER TABLE "refresh_tokens" DROP CONSTRAINT "refresh_tokens_token_unique";--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "game_state" jsonb;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "last_state_update" timestamp;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "colyseus_room_id" varchar(255);--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD COLUMN "token_hash" text NOT NULL;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD COLUMN "ip_address" varchar(45);--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD COLUMN "user_agent" text;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD COLUMN "is_revoked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "refresh_tokens" DROP COLUMN IF EXISTS "token";--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "active_game_sessions" ADD CONSTRAINT "active_game_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "active_game_sessions" ADD CONSTRAINT "active_game_sessions_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_token_hash_unique" UNIQUE("token_hash");