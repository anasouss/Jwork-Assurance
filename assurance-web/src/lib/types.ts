export type AuthUser = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  fullName: string;
  roleCode: string;
  roleName?: string | null;
  agenceId?: string | null;
  agenceName?: string | null;
  permissions: string[];
  language?: string | null;
  onboardingCompleted?: boolean;
  clientPortalEnabled?: boolean | null;
};

export type AuthResponse = {
  accessToken: string;
  refreshToken?: string;
  sessionId?: string;
  tokenType?: string;
  expiresIn?: number;
  user: AuthUser;
};

export type AuthSession = {
  id: string;
  deviceName?: string | null;
  deviceType?: string | null;
  ipAddress?: string | null;
  current: boolean;
  lastActivityAt?: string | null;
  createdAt?: string | null;
};

export type ApiResponse<T> = {
  success: boolean;
  message?: string;
  code?: string;
  data: T;
};
