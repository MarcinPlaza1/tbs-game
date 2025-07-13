declare module "../../../../game-server/src/schemas/GameState" {
  export const GameStatus: any;
  export const GamePhase: any;
  export interface GameState extends Record<string, any> {}
  export interface Unit extends Record<string, any> {}
  export class Player {}
  export class Unit {}
}