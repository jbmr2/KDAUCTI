export type PlayerCategory = 'A' | 'B' | 'C' | 'None';
export type PlayerPosition = 'Raider' | 'Defender' | 'All-rounder';
export type PlayerStatus = 'available' | 'unsold' | 'sold' | 'current';

export interface Player {
  id: string;
  name: string;
  image?: string;
  category: PlayerCategory;
  position: PlayerPosition;
  basePrice: number;
  currentBid: number;
  currentBidderId: string | null;
  status: PlayerStatus;
  teamId: string | null;
  tournamentId?: string;
  updatedAt?: number;
}

export interface Team {
  id: string;
  name: string;
  ownerId: string;
  budget: number;
  totalPlayers: number;
  logo: string;
  tournamentId?: string;
}

export interface Bid {
  id: string;
  playerId: string;
  teamId: string;
  amount: number;
  timestamp: any;
}

export interface AuctionState {
  currentPlayerId: string | null;
  tournamentId: string | null;
  status: 'idle' | 'active' | 'finished';
  timer: number;
  viewMode?: 'auction' | 'teams' | 'team-squad' | 'unsold';
  selectedTeamId?: string | null;
}

export interface Tournament {
  id: string;
  name: string;
  initialPurse: number;
  password?: string;
  status: 'upcoming' | 'ongoing' | 'completed';
  winnerTeamId: string | null;
  createdAt: any;
  players?: Record<string, Player>;
  teams?: Record<string, Team>;
  bids?: Record<string, Bid>;
  auctionState?: AuctionState;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface DatabaseErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}
