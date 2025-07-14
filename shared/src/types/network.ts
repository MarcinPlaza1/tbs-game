import { UnitAction } from './unit';
import { GameState, GameSettings } from './game';
import { Player } from './player';

// Client to Server messages
export interface ClientMessage {
  type: ClientMessageType;
  payload: any;
}

export enum ClientMessageType {
  JOIN_GAME = 'join_game',
  LEAVE_GAME = 'leave_game',
  PLAYER_READY = 'player_ready',
  UNIT_ACTION = 'unit_action',
  END_TURN = 'end_turn',
  CHAT_MESSAGE = 'chat_message'
}

// Server to Client messages
export interface ServerMessage {
  type: ServerMessageType;
  payload: any;
}

export enum ServerMessageType {
  GAME_STATE_UPDATE = 'game_state_update',
  PLAYER_JOINED = 'player_joined',
  PLAYER_LEFT = 'player_left',
  UNIT_ACTION_RESULT = 'unit_action_result',
  TURN_CHANGED = 'turn_changed',
  GAME_STARTED = 'game_started',
  GAME_ENDED = 'game_ended',
  ERROR = 'error',
  CHAT_MESSAGE = 'chat_message',
  AUTHENTICATION_REQUIRED = 'authentication_required'
}

// Specific message payloads
export interface JoinGamePayload {
  gameId: string;
  playerId: string;
}

export interface UnitActionPayload {
  action: UnitAction;
}

export interface GameStateUpdatePayload {
  gameState: GameState;
  units: any[]; // Unit[]
}

export interface ErrorPayload {
  message: string;
  code: string;
} 