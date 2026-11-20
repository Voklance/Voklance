export const CONNECTION_STATUSES = ['pending', 'accepted', 'declined', 'cancelled', 'removed'] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];
export const CONNECTION_ERROR_CODES = [
  'SELF_CONNECTION',
  'PROFESSIONAL_NOT_FOUND',
  'CONNECTION_NOT_FOUND',
  'CONNECTION_LIST_NOT_FOUND',
  'CONNECTION_EXISTS',
  'REREQUEST_COOLDOWN',
  'INVALID_CURSOR',
  'RATE_LIMITED'
] as const;
export type ConnectionErrorCode = (typeof CONNECTION_ERROR_CODES)[number];
export type RelativeConnectionStatus = 'none' | 'pending_sent' | 'pending_received' | 'connected';
export type ConnectionListVisibility = 'private' | 'connections';
export interface NetworkSettings {
  profileDiscoverable: boolean;
  allowConnectionRequests: boolean;
  connectionListVisibility: ConnectionListVisibility;
}
export interface ProfessionalSummary {
  userId: string;
  username: string;
  fullName: string;
  headline: string;
  city?: string;
  country: string;
  skills: string[];
  connectionStatus: RelativeConnectionStatus;
  connectionCount: number | null;
}
export interface ConnectionDto {
  id: string;
  status: ConnectionStatus;
  requesterId: string;
  recipientId: string;
  requestedAt: string;
  respondedAt: string | null;
  person?: ProfessionalSummary;
}
export type ConnectionRequestDto = ConnectionDto;
export interface NetworkCounts {
  connections: number;
  incoming: number;
  sent: number;
}
export interface NetworkPage<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}
export interface ConnectionsPage extends NetworkPage<ConnectionDto> {
  counts: NetworkCounts;
}
