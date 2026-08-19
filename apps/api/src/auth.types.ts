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
}

export interface AuthenticatedRequest {
  user?: AuthUser;
}
