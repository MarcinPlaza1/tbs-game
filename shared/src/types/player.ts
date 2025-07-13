export interface Player {
  id: string;
  username: string;
  color: string;
  isReady: boolean;
  isActive: boolean;
  resources: PlayerResources;
}

export interface PlayerResources {
  gold: number;
  mana: number;
  actionPoints: number;
}

export interface PlayerStats {
  playerId: string;
  wins: number;
  losses: number;
  draws: number;
  totalGames: number;
  rating: number;
} 