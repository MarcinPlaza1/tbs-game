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

export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const rateLimitLog = pgTable('rate_limit_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  identifier: varchar('identifier', { length: 255 }).notNull(), // IP address or user ID
  endpoint: varchar('endpoint', { length: 255 }).notNull(),
  requestCount: integer('request_count').notNull().default(1),
  windowStart: timestamp('window_start').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const csrfTokens = pgTable('csrf_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: varchar('session_id', { length: 255 }).notNull(),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
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
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
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

export const maps = pgTable('maps', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  tileData: jsonb('tile_data').notNull(),
  spawnPoints: jsonb('spawn_points').notNull(),
  maxPlayers: integer('max_players').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  gamePlayers: many(gamePlayers),
  refreshTokens: many(refreshTokens),
  passwordResetTokens: many(passwordResetTokens),
}));

export const gamesRelations = relations(games, ({ many, one }) => ({
  players: many(gamePlayers),
  map: one(maps, {
    fields: [games.mapId],
    references: [maps.id],
  }),
  winner: one(users, {
    fields: [games.winnerId],
    references: [users.id],
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

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, {
    fields: [passwordResetTokens.userId],
    references: [users.id],
  }),
})); 