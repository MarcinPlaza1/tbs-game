import { pgTable, serial, text, timestamp, boolean, integer, jsonb, uuid, varchar } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  emailVerified: boolean('email_verified').notNull().default(false),
  emailVerificationToken: text('email_verification_token'),
  emailVerificationTokenExpiry: timestamp('email_verification_token_expiry'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const games = pgTable('games', {
  id: uuid('id').defaultRandom().primaryKey(),
  status: varchar('status', { length: 20 }).notNull().default('waiting'),
  phase: varchar('phase', { length: 20 }).notNull().default('deployment'),
  currentPlayerIndex: integer('current_player_index').notNull().default(0),
  turnNumber: integer('turn_number').notNull().default(1),
  mapId: uuid('map_id').notNull(),
  settings: jsonb('settings').notNull(),
  winnerId: uuid('winner_id'),
  gameState: jsonb('game_state'), // Serialized game state for recovery
  lastStateUpdate: timestamp('last_state_update'),
  colyseusRoomId: varchar('colyseus_room_id', { length: 255 }), // Link to Colyseus room
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const activeGameSessions = pgTable('active_game_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  gameId: uuid('game_id').notNull().references(() => games.id, { onDelete: 'cascade' }),
  colyseusRoomId: varchar('colyseus_room_id', { length: 255 }).notNull(),
  sessionId: varchar('session_id', { length: 255 }), // Current Colyseus session ID
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const gamePlayers = pgTable('game_players', {
  id: uuid('id').defaultRandom().primaryKey(),
  gameId: uuid('game_id').notNull().references(() => games.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  playerIndex: integer('player_index').notNull(),
  color: varchar('color', { length: 7 }).notNull(),
  isReady: boolean('is_ready').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  resources: jsonb('resources').notNull().default({ gold: 1000, mana: 100, actionPoints: 3 }),
});

// Relations
export const gamesRelations = relations(games, ({ many }) => ({
  players: many(gamePlayers),
  activeSessions: many(activeGameSessions),
}));

export const activeGameSessionsRelations = relations(activeGameSessions, ({ one }) => ({
  user: one(users, {
    fields: [activeGameSessions.userId],
    references: [users.id],
  }),
  game: one(games, {
    fields: [activeGameSessions.gameId],
    references: [games.id],
  }),
}));

export const gamePlayersRelations = relations(gamePlayers, ({ one }) => ({
  game: one(games, {
    fields: [gamePlayers.gameId],
    references: [games.id],
  }),
  user: one(users, {
    fields: [gamePlayers.userId],
    references: [users.id],
  }),
}));