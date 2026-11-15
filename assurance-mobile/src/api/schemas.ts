import { z } from 'zod';

export const id = z.string().regex(/^[1-9]\d*$/);
const text = z.string().nullish();
const amount = z.number().finite().nullish();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish();
export const pageInfo = z.object({
  number: z.number(), size: z.number(), totalPages: z.number(),
  totalElements: z.number(), first: z.boolean(), last: z.boolean(),
});
export function paged<T extends z.ZodTypeAny>(item: T) {
  return z.object({ items: z.array(item), page: pageInfo });
}
export const profile = z.object({
  id, nom: z.string(), agenceCode: z.string(), agenceNom: z.string(),
  agenceTelephone: text, passwordChangeRequired: z.boolean(),
});
export const user = z.object({
  id, email: z.string(), fullName: z.string(), roleCode: z.string(), roleName: text,
  agenceId: id.nullish(), agenceName: text, platformAdmin: z.boolean(),
  operatingMode: z.enum(['PLATFORM', 'AGENCY']), permissions: z.array(z.string()),
});
export const clientTokens = z.object({
  accessToken: z.string().min(1), refreshToken: z.string().min(1),
  expiresIn: z.number().positive(), profile,
});
export const staffTokens = z.object({
  auth: z.object({ accessToken: z.string().min(1), expiresIn: z.number().positive(), user }),
  refreshToken: z.string().min(1),
});
export const mobileLogin = z.discriminatedUnion('principalType', [
  z.object({ principalType: z.literal('CLIENT'), client: clientTokens }),
  z.object({ principalType: z.literal('STAFF'), staff: staffTokens }),
]);
export const contract = z.object({
  id, numeroDossier: text, numeroPolice: text, type: z.string(), statut: z.string(),
  compagnie: text, dateEffet: date, dateExpiration: date,
});
export const vehicle = z.object({ id, immatriculation: text, marque: text, dateEffet: date, dateExpiration: date });
export const coverage = z.object({
  id, vehiculeId: id.nullish(), remorqueId: id.nullish(), code: z.string(), libelle: z.string(),
  immatriculation: text, capital: amount, tauxFranchise: amount, franchiseMinimale: amount,
});
export const assistance = z.object({
  id, vehiculeId: id.nullish(), numero: text, compagnie: text, produit: text,
  dateEffet: date, dateExpiration: date,
});
export const claim = z.object({
  id, numero: z.string(), numeroPolice: text, statut: z.string(),
  dateSinistre: date, dateDeclaration: date, dateCloture: date,
});
export const publication = z.object({ id, titre: z.string(), message: z.string(), publishedAt: z.string() });
export const document = z.object({
  id, titre: z.string(), contratId: id.nullish(), sinistreId: id.nullish(), publishedAt: z.string(),
});
export const clientDashboard = z.object({
  contrats: z.number(), contratsActifs: z.number(), expirationsProches: z.number(),
  sinistres: z.number(), sinistresEnCours: z.number(),
});
export const movement = z.object({
  id, libelle: text, numeroMouvement: text, statut: text,
  dateEffet: date, dateEcheance: date, primeTotale: amount,
});
const clientLink = z.object({ clientId: id, nomAffichage: text, role: text, principalPourRole: z.boolean() });
export const staffContract = z.object({
  id, numeroDossier: text, numeroPolice: text, typeContrat: text, statut: text,
  compagnieLibelle: text, compagnieAssuranceNom: text, brancheAssuranceLibelle: text,
  dateEffet: date, dateEcheance: date, clients: z.array(clientLink).nullish(),
  mouvements: z.array(movement).nullish(),
});
export const staffContractDetail = staffContract.extend({
  vehicules: z.array(z.object({
    vehiculeId: id, immatriculation: text, marque: text, usageLibelle: text,
    dateEffet: date, dateEcheance: date,
  })).nullish(),
  garanties: z.array(z.object({
    contratGarantieId: id.nullish(), garantieId: id, libelle: text, code: text,
    vehiculeId: id.nullish(), capital: amount, tauxFranchise: amount, franchiseMinimale: amount,
  })).nullish(),
  assistances: z.array(z.object({
    id, numeroContratOuQuittance: text, compagnieAssistanceLibelle: text, produit: text,
    dateEffet: date, dateEcheance: date,
  })).nullish(),
});
export const contractGroups = paged(z.object({ key: z.string(), contrats: z.array(staffContract) }));
export const staffClaim = z.object({
  id, numeroSinistre: z.string(), statut: z.string(), etapeSuivi: text,
  dateSinistre: date, dateDeclaration: date, numeroPolice: text,
  assure: text, compagnie: text, immatriculation: text,
  garage: text, premierExpert: text, gestionnaire: text,
  prochaineAction: text, dateEcheanceAction: date,
});
export const staffClaimDetail = staffClaim.extend({
  couverture: z.object({ numeroPolice: text, assure: text, compagnie: text, immatriculation: text }).nullish(),
  garanties: z.array(z.object({ id, code: text, libelle: text, impliquee: z.boolean() })).nullish(),
});
export const client = z.object({
  id, codeClient: text, nomAffichage: text, raisonSociale: text, prenom: text, nom: text,
  telephone: text, email: text, adresse: text, ville: text, actif: z.boolean().nullish(),
});
export const crm = z.object({
  client, contrats: z.array(z.object({
    id, numeroDossier: text, numeroPolice: text, statut: text, compagnie: text,
    dateEffet: date, dateEcheance: date,
  })).nullish(),
});
export const staffDashboard = z.object({
  dateDu: date, dateAu: date,
  kpis: z.object({
    primeNette: amount, taxes: amount, primeTotale: amount,
    contratsActifs: z.number(), assistancesActives: z.number(), contratsBrouillon: z.number(), clientsActifs: z.number(),
  }),
  workload: z.object({ echeances30Jours: z.number(), quittancesAAffecter: z.number(), documentsAEmettre: z.number() }),
  portefeuilleParBranche: z.array(z.object({ code: text, libelle: text, montant: amount, nombre: z.number() })),
});
export const agency = z.object({
  id, code: z.string(), nom: z.string(), ville: text, statut: z.string(),
  totalUsers: z.number(), activeUsers: z.number(), activeContracts: z.number(),
  draftContracts: z.number(), upcomingExpiries: z.number(), quittances: z.number(),
  primeNette: amount, taxes: amount, primeTotale: amount,
});
export const platformDashboard = z.object({
  dateDu: date, dateAu: date,
  summary: z.object({
    totalAgencies: z.number(), activeAgencies: z.number(), totalUsers: z.number(),
    activeUsers: z.number(), activeContracts: z.number(), draftContracts: z.number(),
    upcomingExpiries: z.number(), primeNette: amount, taxes: amount, primeTotale: amount,
  }),
  agencies: z.array(agency),
});
export type Contract = z.infer<typeof contract>;
export type StaffContract = z.infer<typeof staffContract>;
export type Agency = z.infer<typeof agency>;
export type Profile = z.infer<typeof profile>;
export type User = z.infer<typeof user>;
