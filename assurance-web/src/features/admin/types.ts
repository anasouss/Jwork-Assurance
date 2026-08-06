export type AdminUser = {
  id: string;
  agenceId?: string | null;
  agenceNom?: string | null;
  roleId?: string | null;
  roleCode?: string | null;
  roleNom?: string | null;
  email: string;
  prenom: string;
  nom: string;
  fullName: string;
  telephone?: string | null;
  actif: boolean;
  lastLogin?: string | null;
  permissions: string[];
};

export type AdminUserSession = {
  id: string;
  deviceName?: string | null;
  deviceType?: string | null;
  ipAddress?: string | null;
  current: boolean;
  lastActivityAt?: string | null;
  createdAt?: string | null;
};

export type AdminRole = {
  id: string;
  agenceId?: string | null;
  agenceNom?: string | null;
  code: string;
  nom: string;
  description?: string | null;
  systemRole: boolean;
  permissionIds: string[];
  permissionCodes: string[];
};

export type AdminPermission = {
  id: string;
  code: string;
  nom: string;
  module: string;
  description?: string | null;
  superAdminOnly: boolean;
};

export type AdminAgency = {
  id: string;
  code: string;
  nom: string;
  adresse?: string | null;
  ville?: string | null;
  telephone?: string | null;
  fax?: string | null;
  email?: string | null;
  identifiantFiscal?: string | null;
  patente?: string | null;
  ice?: string | null;
  numeroAgrement?: string | null;
  dateAgrement?: string | null;
  banque?: string | null;
  rib?: string | null;
  logoDisponible: boolean;
  signatureDisponible: boolean;
  statut: "ACTIVE" | "SUSPENDED" | "ARCHIVED";
};

export type UpsertAdminUserRequest = {
  agenceId?: string;
  roleId: string;
  email: string;
  password?: string;
  prenom: string;
  nom: string;
  telephone?: string;
  actif: boolean;
};

export type UpsertPlatformAdminRequest = {
  email: string;
  password?: string;
  prenom: string;
  nom: string;
  telephone?: string;
  actif: boolean;
};

export type UpsertAdminRoleRequest = {
  agenceId?: string;
  code: string;
  nom: string;
  description?: string;
  systemRole: boolean;
  permissionIds: string[];
};

export type UpsertAdminAgencyRequest = {
  code: string;
  nom: string;
  adresse?: string;
  ville?: string;
  telephone?: string;
  fax?: string;
  email?: string;
  identifiantFiscal?: string;
  patente?: string;
  ice?: string;
  numeroAgrement?: string;
  dateAgrement?: string;
  banque?: string;
  rib?: string;
  statut: AdminAgency["statut"];
};
