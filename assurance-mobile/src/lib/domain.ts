export function normalizeIds(value: unknown, key = ''): unknown {
  if ((key === 'id' || key.endsWith('Id')) && typeof value === 'number') {
    if (!Number.isSafeInteger(value)) throw new Error('Identifiant serveur invalide.');
    return String(value);
  }
  if (Array.isArray(value)) return value.map((item) => normalizeIds(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, normalizeIds(item, name)]));
  }
  return value;
}

export function businessDate(value?: string | null): string {
  if (!value) return '-';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '-';
}

export function money(value?: number | null): string {
  if (value == null) return '-';
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(value).replace(/[\u00a0\u202f]/g, ' ');
}

export function dateRange(period: 'month' | 'year', now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return { dateDu: `${year}-${period === 'year' ? '01' : month}-01`, dateAu: `${year}-${month}-${day}` };
}

const labels: Record<string, string> = {
  DRAFT: 'Brouillon', CANCELLED: 'Annulé', EXPIRED: 'Expiré', RENEWED: 'Renouvelé',
  DECLARE: 'Déclaré', DOSSIER_INCOMPLET: 'Dossier incomplet', TRANSMIS_COMPAGNIE: 'Transmis à la compagnie',
  EN_ATTENTE_REGLEMENT: 'En attente de règlement', PARTIELLEMENT_REGLE: 'Partiellement réglé', REJETE: 'Rejeté', ROUVERT: 'Rouvert',
  ACTIVE: 'Actif', SUSPENDED: 'Suspendue', ARCHIVED: 'Archivée', EXPIRE: 'Expiré',
  RESILIE: 'Résilié', ANNULE: 'Annulé', CLOTURE: 'Clôturé', REFUSE: 'Refusé',
  EN_COURS: 'En cours', EN_ATTENTE: 'En attente', DOCUMENTS_EN_ATTENTE: 'Documents attendus',
  TRANSMIS: 'Transmis', EXPERTISE: 'Expertise', REGLEMENT_EN_COURS: 'Règlement en cours',
  REGLE: 'Réglé', OUVERT: 'Ouvert', VALIDE: 'Validé', BROUILLON: 'Brouillon',
  FLOTTE: 'Flotte', PARTICULIER: 'Mono', CONVENTION: 'Convention',
};
export function label(value?: string | null) { return value ? labels[value] ?? value.replaceAll('_', ' ') : '-'; }

export function canRead(space: string, permissions: readonly string[], resource: string) {
  if (space === 'client') return ['contracts', 'claims', 'documents'].includes(resource);
  if (space !== 'staff') return false;
  const codes: Record<string, string> = { contracts: 'contrat:view', claims: 'sinistre:view', clients: 'client:view' };
  return !!codes[resource] && permissions.includes(codes[resource]);
}
