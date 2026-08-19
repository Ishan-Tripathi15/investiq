export type AuthRole = 'user' | 'admin';

export type TradingPermission =
  | 'portfolio:read'
  | 'orders:read'
  | 'orders:create'
  | 'orders:cancel'
  | 'account:read';

export interface AuthUser {
  id: string;
  role: AuthRole;
  permissions: TradingPermission[];
  sessionId?: string;
}

export interface AuthenticatedRequest {
  user?: AuthUser;
}
