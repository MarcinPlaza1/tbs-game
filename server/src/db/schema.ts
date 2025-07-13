import { pgTable, serial, text, timestamp, boolean, integer, jsonb, uuid, varchar } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
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