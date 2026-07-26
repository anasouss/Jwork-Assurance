package com.assurance.seeder;

import com.assurance.entity.*;
import com.assurance.enums.CategorieMouvementContrat;
import com.assurance.enums.ModeTarificationGarantie;
import com.assurance.enums.SourceValeurGarantie;
import com.assurance.enums.TypeContrat;
import com.assurance.enums.TypeGarantie;
import com.assurance.enums.TypeImpactMouvement;
import com.assurance.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.LinkedHashSet;
import java.util.List;

@Component
@Order(2)
@RequiredArgsConstructor
public class DataSeeder implements CommandLineRunner {

    private final PermissionRepository permissionRepository;
    private final RoleRepository roleRepository;
    private final AgenceRepository agenceRepository;
    private final CompagnieAssuranceRepository compagnieAssuranceRepository;
    private final CompagnieAssistanceRepository compagnieAssistanceRepository;
    private final GarantieRepository garantieRepository;
    private final CompagnieGarantieRepository compagnieGarantieRepository;
    private final UsageRepository usageRepository;
    private final GroupeUsageAttestationRepository groupeUsageAttestationRepository;
    private final CategorieTransportRepository categorieTransportRepository;
    private final CategorieClientRepository categorieClientRepository;
    private final MarqueRepository marqueRepository;
    private final CarrosserieRepository carrosserieRepository;
    private final CarburantRepository carburantRepository;
    private final SousClasseRepository sousClasseRepository;
    private final UtilisateurRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final ParametreApplicationRepository parametreApplicationRepository;
    private final CapitalResponsabiliteCivileRepository capitalResponsabiliteCivileRepository;
    private final TypeMouvementContratRepository typeMouvementContratRepository;

    @Value("${app.seed.admin-email:admin@jway.ma}")
    private String adminEmail;

    @Value("${app.seed.admin-password:password}")
    private String adminPassword;

    @Override
    @Transactional
    public void run(String... args) {
        if (hasBootstrapData()) {
            return;
        }

        Permission contratView = seedPermission("contrat:view", "Consulter les contrats", "contrat");
        Permission contratCreate = seedPermission("contrat:create", "Creer un contrat", "contrat");
        Permission contratUpdate = seedPermission("contrat:update", "Modifier un contrat", "contrat");
        Permission clientView = seedPermission("client:view", "Consulter les clients", "client");
        Permission clientCreate = seedPermission("client:create", "Creer un client", "client");
        Permission garantieView = seedPermission("garantie:view", "Consulter les garanties", "garantie");
        Permission garantieManage = seedPermission("garantie:manage", "Gerer les garanties", "garantie", true);
        Permission grilleView = seedPermission("grille-tarifaire:view", "Consulter les grilles tarifaires", "grille-tarifaire");
        Permission grilleManage = seedPermission("grille-tarifaire:manage", "Gerer les grilles tarifaires", "grille-tarifaire");
        Permission quittanceView = seedPermission("quittance:view", "Consulter les quittances", "quittance");
        Permission quittanceCreate = seedPermission("quittance:create", "Creer une quittance", "quittance");
        Permission agenceView = seedPermission("agence:view", "Consulter les agences", "agence", true);
        Permission agenceCreate = seedPermission("agence:create", "Creer une agence", "agence", true);
        Permission userView = seedPermission("user:view", "Consulter les utilisateurs", "admin");
        Permission userManage = seedPermission("user:manage", "Gerer les utilisateurs", "admin");
        Permission roleView = seedPermission("role:view", "Consulter les roles", "admin");
        Permission roleManage = seedPermission("role:manage", "Gerer les roles", "admin");
        Permission configView = seedPermission("config:view", "Consulter la configuration", "config", true);
        Permission configManage = seedPermission("config:manage", "Gerer la configuration", "config", true);

        Agence agenceDefaut = agenceRepository.findByCode("AG-001").orElseGet(() -> agenceRepository.save(
                Agence.builder()
                        .code("AG-001")
                        .nom("Agence Centrale")
                        .ville("Casablanca")
                        .email("agence@assurance.local")
                        .telephone("+212600000000")
                        .build()
        ));

        List<CompagnieAssurance> compagniesAssurance = seedCompagniesAssurance();
        seedCompagniesAssistance();

        Carrosserie berline = seedCarrosserie("Berline");
        Carrosserie utilitaire = seedCarrosserie("Utilitaire");
        Carrosserie camion = seedCarrosserie("Camion");
        Carrosserie moto = seedCarrosserie("Moto");
        Carrosserie carrosserieRemorque = seedCarrosserie("Remorque");

        seedMarque("Dacia");
        seedMarque("Renault");
        seedMarque("Peugeot");
        seedMarque("Toyota");
        seedMarque("Mercedes-Benz");

        seedCarburant("ESSENCE", "Essence");
        seedCarburant("DIESEL", "Diesel");
        seedCarburant("ELECTRIQUE", "Electrique");
        seedCarburant("HYBRIDE_E", "Hybride essence");
        seedCarburant("HYBRIDE_D", "Hybride diesel");

        seedSousClasse("SC1", "SC1");
        seedSousClasse("SC2", "SC2");
        seedSousClasse("SC3", "SC3");
        seedSousClasse("SC4", "SC4");

        seedCategorieTransport("PETIT_TAXIS", "Petit taxi", "Taxi urbain");
        seedCategorieTransport("GRAND_TAXIS", "Grand taxi", "Taxi interurbain");
        seedCategorieTransport("CAR_LIGNE", "Car de ligne", "Cars et autocars de ligne");

        GroupeUsageAttestation groupeA = seedGroupeUsageAttestation("A", "TOURISME", "#ffff00", null);
        GroupeUsageAttestation groupeC = seedGroupeUsageAttestation("C", "COMMERCE", "#00a2ff", null);
        GroupeUsageAttestation groupeE = seedGroupeUsageAttestation("E", "CYCLOMOTEUR", "#60f060", null);
        GroupeUsageAttestation groupeD = seedGroupeUsageAttestation("D", "DIVERS", null, null);
        GroupeUsageAttestation groupeP = seedGroupeUsageAttestation("P", "PROVISOIRE", "#d1009f", null);
        GroupeUsageAttestation groupeB = seedGroupeUsageAttestation("B", "TPV", null, "MATU & CAT");
        GroupeUsageAttestation groupeF = seedGroupeUsageAttestation("F", "FRONTIERE", "#f58ac3", "MATU & CAT");

        Usage usageA = seedUsage("A", "TOURISME", "Tourisme", groupeA, true, true, false, false, false, berline);
        Usage usageC1 = seedUsage("C1", "C1", "Commerce C1", groupeC, true, true, false, false, false, utilitaire);
        seedUsage("C2", "C2", "Commerce C2", groupeC, true, true, false, false, false, utilitaire);
        Usage usageCyclos = seedUsage("CYCLOS", "CYCLOS", "Cyclos et motocycles", groupeE, true, true, false, false, false, moto);
        seedUsage("D1", "TRANSPORT DE MATIERE INFLAMMABLE <= 3,5T", "Divers", groupeD, true, true, false, true, false, utilitaire);
        seedUsage("D2", "TRANSPORT DE MATIERE INFLAMMABLE > 3,5T", "Divers", groupeD, true, false, false, true, false, camion);
        seedUsage("D3", "AMBULANCE", "Divers", groupeD, true, true, false, false, false, utilitaire);
        seedUsage("D4_SC1", "VEHICULE DE SERVICE <= 3,5T", "Divers", groupeD, true, true, false, false, false, utilitaire);
        seedUsage("D4_SC2", "VEHICULE DE SERVICE > 3,5T", "Divers", groupeD, true, false, false, true, false, camion);
        seedUsage("D5_SC1", "VEHICULE DE DEPANNAGE <= 3,5T", "Divers", groupeD, true, true, false, false, false, utilitaire);
        seedUsage("D5_SC2", "VEHICULE DE DEPANNAGE > 3,5T", "Divers", groupeD, true, false, false, true, false, camion);
        seedUsage("D6_SC1", "AUTO ECOLE CYCLO A 2 OU 3 ROUES", "Divers", groupeD, true, true, false, false, false, moto);
        seedUsage("D6_SC2", "AUTO ECOLE TOURISME", "Divers", groupeD, true, true, false, false, false, berline);
        seedUsage("D6_SC3", "AUTO ECOLE UTILITAIRES ET AUTOCARS C1", "Divers", groupeD, true, true, false, false, false, utilitaire);
        seedUsage("D6_SC4", "AUTO ECOLE UTILITAIRES ET AUTOCARS C2", "Divers", groupeD, true, true, false, false, false, utilitaire, camion);
        seedUsage("D7", "ENGIN DE CHANTIER", "Divers", groupeD, true, false, false, true, false, camion);
        seedUsage("D8", "VEHICULE DE CONSTRUCTEUR/GARAGISTE", "Divers", groupeD, true, true, false, false, false, berline, utilitaire);
        seedUsage("D9", "VEHICULE DE LOCATION AVEC OU SANS CHAUFFEUR", "Divers", groupeD, true, true, false, false, false, berline, utilitaire);
        seedUsage("D10", "TRACTEUR AGRICOLE ET FORESTIER", "Divers", groupeD, true, false, false, true, false, camion);
        seedUsage("D11", "TRANSPORT DE PERSONNEL COMPTE PROPRE <= 3,5T", "Divers", groupeD, true, true, false, false, false, utilitaire);
        seedUsage("D12", "TRANSPORT DE PERSONNEL COMPTE PROPRE > 3,5T", "Divers", groupeD, true, false, false, true, false, camion);
        seedUsage("TRS D'ECOLIERS", "TRANSPORT D'ECOLIERS", "Divers", groupeD, true, false, false, false, false, utilitaire, camion);
        seedUsage("REMORQUE", "REMORQUE", "Remorque rattachee a un contrat automobile", null, false, false, false, true, false, carrosserieRemorque);
        Usage usageB1 = seedUsage("B1", "CARS ET TAXIS", "Transport public de voyageurs", groupeB, true, false, false, false, false, true, berline, utilitaire, camion);
        Usage usageB2 = seedUsage("B2", "BUS DE TRANSPORT URBAIN", "Transport public de voyageurs", groupeB, true, false, false, false, false, camion);
        seedUsage("P", "PROVISOIRE", "Attestation provisoire", groupeP, true, false, false, false, true, berline, utilitaire);
        seedUsage("F", "FRONTIERE", "Attestation frontiere", groupeF, true, false, false, false, true, berline, utilitaire);

        seedCapitalResponsabiliteCivile("DEFAULT", BigDecimal.valueOf(50_000_000L));
        seedCapitalResponsabiliteCivile("CYCLOS", BigDecimal.valueOf(5_000_000L));

        seedParametreApplication("CNPAC", "DECIMAL", "17", "Montant CNPAC utilise dans les quittances");
        seedParametreApplication("TAUX_EVCAT_1", "DECIMAL", "0", "Taux EVCAT applique a la RC hors TPV");
        seedParametreApplication("TAUX_EVCAT_2", "DECIMAL", "0.015", "Taux EVCAT applique aux autres garanties");
        seedParametreApplication("TAUX_EVCAT_3", "DECIMAL", "0.02", "Taux EVCAT applique aux garanties personne");
        seedParametreApplication("TAUX_EVCAT_TPV_RC", "DECIMAL", "0.02", "Taux EVCAT applique a la RC TPV");
        seedParametreApplication("TAUX_TAXE_1", "DECIMAL", "0.155", "Taxe RC");
        seedParametreApplication("TAUX_TAXE_2", "DECIMAL", "0.14", "Taxe garanties");
        seedParametreApplication("TAUX_TAXE_PF", "DECIMAL", "0.01", "Taxe parafiscale");
        seedParametreApplication("TAUX_RSS", "DECIMAL", "0.60", "Coefficient RC lorsque le client est saharien");
        seedParametreApplication("MULTIPLICATEUR_RC_DEFAUT", "DECIMAL", "1", "Multiplicateur RC par defaut");
        seedParametreApplication("MULTIPLICATEUR_RC_TPV", "DECIMAL", "1", "Multiplicateur RC TPV par defaut");
        seedParametreApplication("TAUX_RC_REMORQUE_A", "DECIMAL", "0.10", "Taux RC remorque rattachee a usage tourisme");
        seedParametreApplication("TAUX_RC_REMORQUE_C1", "DECIMAL", "0.20", "Taux RC remorque rattachee a usage C1");
        seedParametreApplication("TAUX_RC_REMORQUE_C2", "DECIMAL", "0.30", "Taux RC remorque rattachee a usage C2");
        seedParametreApplication("TAUX_RC_REMORQUE_DEFAUT", "DECIMAL", "0.20", "Taux RC remorque par defaut");
        seedParametreApplication("DR_MODE_VARIABLE", "BOOLEAN", "false", "Autorise le mode variable pour Defense et Recours");
        seedParametreApplication("RVE_TAUX_ZERO_AUTORISE", "BOOLEAN", "false", "Autorise les lignes RVE a taux zero");
        seedParametreApplication("ENABLE_ATTESTATION_STOCK_CHECK", "BOOLEAN", "false", "Active le controle du stock des attestations pendant la production");

        seedTypeMouvement("AN", "Affaire nouvelle", CategorieMouvementContrat.AFFAIRE_NOUVELLE, TypeImpactMouvement.NORMAL,
                List.of(TypeContrat.PARTICULIER, TypeContrat.CONVENTION, TypeContrat.FLOTTE), false, false, true, true, false, true, true, true, true, false, false, 10);
        seedTypeMouvement("REN", "Renouvellement", CategorieMouvementContrat.RENOUVELLEMENT, TypeImpactMouvement.NORMAL,
                List.of(TypeContrat.PARTICULIER, TypeContrat.CONVENTION, TypeContrat.FLOTTE), true, true, true, true, false, true, true, true, true, false, true, 20);

        seedTypeMouvement("EXG_M", "Extension garanties", CategorieMouvementContrat.AVENANT, TypeImpactMouvement.DIFFERENTIEL,
                List.of(TypeContrat.PARTICULIER, TypeContrat.CONVENTION), true, true, false, false, false, true, true, false, false, false, false, 110);
        seedTypeMouvement("MOG_M", "Modification garanties", CategorieMouvementContrat.AVENANT, TypeImpactMouvement.DIFFERENTIEL,
                List.of(TypeContrat.PARTICULIER, TypeContrat.CONVENTION), true, true, false, false, false, true, true, false, false, false, false, 120);
        seedTypeMouvement("CHV_M", "Changement vehicule", CategorieMouvementContrat.AVENANT, TypeImpactMouvement.DIFFERENTIEL,
                List.of(TypeContrat.PARTICULIER, TypeContrat.CONVENTION), true, true, true, false, false, true, true, true, true, false, false, 130);
        seedTypeMouvement("EXR_M", "Extension remorque", CategorieMouvementContrat.AVENANT, TypeImpactMouvement.DIFFERENTIEL,
                List.of(TypeContrat.PARTICULIER, TypeContrat.CONVENTION), true, false, false, true, false, true, true, true, true, false, false, 140);
        seedTypeMouvement("PRI_M", "Precision immatriculation", CategorieMouvementContrat.AVENANT, TypeImpactMouvement.CNPAC_SEUL,
                List.of(TypeContrat.PARTICULIER, TypeContrat.CONVENTION), false, false, true, false, true, true, false, false, true, false, false, 150);
        seedTypeMouvement("DUP_M", "Duplicata", CategorieMouvementContrat.AVENANT, TypeImpactMouvement.CNPAC_SEUL,
                List.of(TypeContrat.PARTICULIER, TypeContrat.CONVENTION), false, false, false, false, true, true, false, false, true, false, false, 160);
        seedTypeMouvement("PRO_M", "Provisoire", CategorieMouvementContrat.AVENANT, TypeImpactMouvement.NORMAL,
                List.of(TypeContrat.PARTICULIER, TypeContrat.CONVENTION), true, true, true, false, false, true, true, true, true, false, false, 170);
        seedTypeMouvement("RES_M", "Resiliation", CategorieMouvementContrat.AVENANT, TypeImpactMouvement.RETOUR_PRIME,
                List.of(TypeContrat.PARTICULIER, TypeContrat.CONVENTION), false, false, false, false, false, true, false, false, false, true, false, 180);
        seedTypeMouvement("RCH_M", "Resiliation a l'echeance", CategorieMouvementContrat.AVENANT, TypeImpactMouvement.ZERO,
                List.of(TypeContrat.PARTICULIER, TypeContrat.CONVENTION), false, false, false, false, false, true, false, false, false, true, false, 190);
        seedTypeMouvement("ANN_M", "Annulation", CategorieMouvementContrat.AVENANT, TypeImpactMouvement.RETOUR_PRIME,
                List.of(TypeContrat.PARTICULIER, TypeContrat.CONVENTION), false, false, false, false, false, true, false, false, false, true, false, 200);

        seedTypeMouvement("INC_F", "Incorporation flotte", CategorieMouvementContrat.AVENANT, TypeImpactMouvement.DIFFERENTIEL,
                List.of(TypeContrat.FLOTTE), true, true, true, true, false, true, true, true, true, false, false, 310);
        seedTypeMouvement("RET_F", "Retrait flotte", CategorieMouvementContrat.AVENANT, TypeImpactMouvement.RETOUR_PRIME,
                List.of(TypeContrat.FLOTTE), true, false, true, true, false, true, false, false, false, false, false, 320);
        seedTypeMouvement("RES_F", "Resiliation flotte", CategorieMouvementContrat.AVENANT, TypeImpactMouvement.RETOUR_PRIME,
                List.of(TypeContrat.FLOTTE), false, false, false, false, false, true, false, false, false, true, false, 330);
        seedTypeMouvement("PRI_F", "Precision immatriculation flotte", CategorieMouvementContrat.AVENANT, TypeImpactMouvement.CNPAC_SEUL,
                List.of(TypeContrat.FLOTTE), false, false, true, false, true, true, false, false, true, false, false, 340);
        seedTypeMouvement("DUP_F", "Duplicata flotte", CategorieMouvementContrat.AVENANT, TypeImpactMouvement.CNPAC_SEUL,
                List.of(TypeContrat.FLOTTE), false, false, false, false, true, true, false, false, true, false, false, 350);

        seedCategorieClient("GRAND_PUBLIC", "GRAND PUBLIC");
        CategorieClient location = seedCategorieClient("LOCATION", "LOCATION");
        CategorieClient tpv = seedCategorieClient("TPV", "TPV");
        attachUsages(location, usageA, usageC1, usageCyclos);
        attachUsages(tpv, usageB1, usageB2);

        Role superAdmin = roleRepository.findByAgenceIsNullAndCode("SUPER_ADMIN").orElseGet(() -> roleRepository.save(
                Role.builder()
                        .code("SUPER_ADMIN")
                        .nom("Super Admin")
                        .systemRole(true)
                        .build()
        ));
        superAdmin.getPermissions().addAll(List.of(contratView, contratCreate, contratUpdate, clientView, clientCreate, garantieView, garantieManage, grilleView, grilleManage, quittanceView, quittanceCreate, agenceView, agenceCreate, userView, userManage, roleView, roleManage, configView, configManage));
        roleRepository.save(superAdmin);

        Role agenceAdmin = roleRepository.findByAgenceIdAndCode(agenceDefaut.getId(), "AGENCY_ADMIN").orElseGet(() -> roleRepository.save(
                Role.builder()
                        .agence(agenceDefaut)
                        .code("AGENCY_ADMIN")
                        .nom("Admin Agence")
                        .systemRole(true)
                        .build()
        ));
        agenceAdmin.getPermissions().addAll(List.of(contratView, contratCreate, contratUpdate, clientView, clientCreate, garantieView, grilleView, grilleManage, quittanceView, quittanceCreate, userView, userManage, roleView, roleManage));
        roleRepository.save(agenceAdmin);

        roleRepository.findByAgenceIdAndCode(agenceDefaut.getId(), "AGENT").orElseGet(() -> roleRepository.save(
                Role.builder()
                        .agence(agenceDefaut)
                        .code("AGENT")
                        .nom("Agent")
                        .build()
        ));

        List<Garantie> garanties = List.of(
                seedGarantie("RC", "Responsabilite Civile", TypeGarantie.VEHICULE, true, true, false, false, false, false, false, false, false, 0,
                        ModeTarificationGarantie.TAUX, List.of(ModeTarificationGarantie.TAUX), SourceValeurGarantie.AUCUNE, List.of(), false, true),
                seedGarantie("V", "Vol", TypeGarantie.VEHICULE, false, false, false, true, false, false, true, true, false, 10,
                        ModeTarificationGarantie.TAUX, List.of(ModeTarificationGarantie.TAUX), SourceValeurGarantie.VENALE, List.of(SourceValeurGarantie.VENALE, SourceValeurGarantie.MANUEL), true, false),
                seedGarantie("I", "Incendie", TypeGarantie.VEHICULE, false, false, false, true, false, false, true, true, false, 20,
                        ModeTarificationGarantie.TAUX, List.of(ModeTarificationGarantie.TAUX), SourceValeurGarantie.VENALE, List.of(SourceValeurGarantie.VENALE, SourceValeurGarantie.MANUEL), true, false),
                seedGarantie("BG", "Bris de Glace", TypeGarantie.VEHICULE, false, false, false, false, false, true, false, true, false, 30,
                        ModeTarificationGarantie.TAUX, List.of(ModeTarificationGarantie.TAUX), SourceValeurGarantie.GLACE, List.of(SourceValeurGarantie.GLACE, SourceValeurGarantie.MANUEL), true, false),
                seedGarantie("DC", "Dommages Collision", TypeGarantie.VEHICULE, false, false, false, true, false, false, true, true, true, 40,
                        ModeTarificationGarantie.CAPITAL, List.of(ModeTarificationGarantie.TAUX, ModeTarificationGarantie.CAPITAL), SourceValeurGarantie.VENALE, List.of(SourceValeurGarantie.VENALE, SourceValeurGarantie.MANUEL), true, false),
                seedGarantie("DV", "Dommages au Vehicule", TypeGarantie.VEHICULE, false, false, false, true, true, false, true, true, true, 50,
                        ModeTarificationGarantie.TAUX, List.of(ModeTarificationGarantie.TAUX), SourceValeurGarantie.VENALE, List.of(SourceValeurGarantie.VENALE, SourceValeurGarantie.NEUF, SourceValeurGarantie.MANUEL), true, false),
                seedGarantie("DR", "Defense et Recours", TypeGarantie.VEHICULE, false, false, true, false, false, false, false, false, true, 60,
                        ModeTarificationGarantie.CAPITAL, List.of(ModeTarificationGarantie.TAUX, ModeTarificationGarantie.CAPITAL), SourceValeurGarantie.AUCUNE, List.of(), false, false),
                seedGarantie("RVE", "Rachat Vetuste", TypeGarantie.VEHICULE, false, false, false, false, false, false, false, false, false, 70,
                        ModeTarificationGarantie.TAUX, List.of(ModeTarificationGarantie.TAUX), SourceValeurGarantie.AUCUNE, List.of(), false, false),
                seedGarantie("BOR", "Bris optique et retroviseur", TypeGarantie.VEHICULE, false, false, false, false, false, false, true, true, true, 80,
                        ModeTarificationGarantie.TAUX, List.of(ModeTarificationGarantie.TAUX, ModeTarificationGarantie.CAPITAL), SourceValeurGarantie.MANUEL, List.of(SourceValeurGarantie.MANUEL), true, false),
                seedGarantie("BTP", "Bris de toit panoramique", TypeGarantie.VEHICULE, false, false, false, false, false, false, false, true, false, 90,
                        ModeTarificationGarantie.TAUX, List.of(ModeTarificationGarantie.TAUX), SourceValeurGarantie.AUCUNE, List.of(), false, false),
                seedGarantie("VOR", "Vol optique et retroviseur", TypeGarantie.VEHICULE, false, false, false, false, false, false, true, true, true, 100,
                        ModeTarificationGarantie.TAUX, List.of(ModeTarificationGarantie.TAUX, ModeTarificationGarantie.CAPITAL), SourceValeurGarantie.MANUEL, List.of(SourceValeurGarantie.MANUEL), true, false),
                seedGarantie("RF", "Risque Financier", TypeGarantie.VEHICULE, false, false, false, false, false, false, true, false, true, 110,
                        ModeTarificationGarantie.CAPITAL, List.of(ModeTarificationGarantie.TAUX, ModeTarificationGarantie.CAPITAL), SourceValeurGarantie.MANUEL, List.of(SourceValeurGarantie.MANUEL), true, false),
                seedGarantie("PF", "Perte Financiere", TypeGarantie.VEHICULE, false, false, false, false, false, false, true, false, false, 120,
                        ModeTarificationGarantie.CAPITAL, List.of(ModeTarificationGarantie.TAUX, ModeTarificationGarantie.CAPITAL), SourceValeurGarantie.MANUEL, List.of(SourceValeurGarantie.MANUEL), true, false),
                seedGarantie("PP", "Protection Passagers", TypeGarantie.PERSONNE, false, false, false, false, false, false, true, false, true, 130,
                        ModeTarificationGarantie.PROTECTION, List.of(ModeTarificationGarantie.PROTECTION), SourceValeurGarantie.AUCUNE, List.of(), false, false),
                seedGarantie("PC", "Protection Conducteur", TypeGarantie.PERSONNE, false, false, false, false, false, false, true, false, true, 140,
                        ModeTarificationGarantie.PROTECTION, List.of(ModeTarificationGarantie.PROTECTION), SourceValeurGarantie.AUCUNE, List.of(), false, false)
        );
        compagniesAssurance.forEach(compagnieAssurance ->
                garanties.forEach(garantie -> seedCompagnieGarantie(compagnieAssurance, garantie)));

        userRepository.findByEmail(adminEmail).orElseGet(() -> userRepository.save(
                Utilisateur.builder()
                        .agence(agenceDefaut)
                        .role(superAdmin)
                        .email(adminEmail)
                        .password(passwordEncoder.encode(adminPassword))
                        .prenom("Admin")
                        .nom("Assurance")
                        .actif(true)
                        .build()
        ));
    }

    private boolean hasBootstrapData() {
        return permissionRepository.count() > 0
                && roleRepository.count() > 0
                && agenceRepository.count() > 0
                && compagnieAssuranceRepository.count() > 0
                && userRepository.count() > 0
                && usageRepository.count() > 0
                && garantieRepository.count() > 0
                && categorieClientRepository.count() > 0;
    }

    private Permission seedPermission(String code, String nom, String module) {
        return seedPermission(code, nom, module, false);
    }

    private Permission seedPermission(String code, String nom, String module, boolean superAdminOnly) {
        return permissionRepository.findByCode(code).orElseGet(() ->
                permissionRepository.save(Permission.builder()
                        .code(code)
                        .nom(nom)
                        .module(module)
                        .superAdminOnly(superAdminOnly)
                        .build())
        );
    }

    private List<CompagnieAssurance> seedCompagniesAssurance() {
        List<CompagnieAssurance> compagnies = List.of(
                seedCompagnieAssurance(
                        "WAFA",
                        "WAFA ASSURANCE",
                        "1, Boulevard Abdelmoumen",
                        "Casablanca",
                        null,
                        "0522545555",
                        "31719",
                        "000083736000004",
                        "WAFA"
                ),
                seedCompagnieAssurance(
                        "SANLAM",
                        "SANLAM MAROC",
                        "216, Boulevard Zerktouni",
                        "Casablanca",
                        null,
                        "0522474040",
                        "22341",
                        null,
                        "SANLAM"
                ),
                seedCompagnieAssurance(
                        "RMA",
                        "ROYALE MAROCAINE D'ASSURANCE",
                        "83, Avenue de l'Armee Royale",
                        "Casablanca",
                        null,
                        "0522312163",
                        "15207",
                        "001530601000041",
                        "RMA"
                ),
                seedCompagnieAssurance(
                        "AXA",
                        "AXA ASSURANCE MAROC",
                        "120-122, Avenue Hassan II",
                        "Casablanca",
                        null,
                        null,
                        "34221",
                        null,
                        "AXA"
                ),
                seedCompagnieAssurance(
                        "ALLIANZ",
                        "ALLIANZ MAROC",
                        "166-168, Boulevard Mohamed Zerktouni",
                        "Casablanca",
                        null,
                        "0522499700",
                        "23041",
                        "001536538000083",
                        "ALLIANZ"
                ),
                seedCompagnieAssurance(
                        "ATLANTA_SANAD",
                        "ATLANTA SANAD",
                        "181, Boulevard d'Anfa",
                        "Casablanca",
                        null,
                        "0522957676",
                        null,
                        null,
                        "ATLANTA"
                ),
                seedCompagnieAssurance(
                        "MAMDA",
                        "MUTUELLE AGRICOLE MAROCAINE D'ASSURANCE",
                        "2, Rue Tetouan",
                        "Meknes",
                        null,
                        "0537766960",
                        null,
                        null,
                        "MAMDA"
                ),
                seedCompagnieAssurance(
                        "MCMA",
                        "MUTUELLE CENTRALE MAROCAINE D'ASSURANCE",
                        "Angle Avenue Mohammed VI et Rue Houmane El Fatouaki",
                        "Rabat",
                        null,
                        "0537544400",
                        "59791",
                        "000211866000096",
                        "MCMA"
                ),
                seedCompagnieAssurance(
                        "CAT",
                        "CAT ASSURANCE ET REASSURANCE",
                        null,
                        "Casablanca",
                        null,
                        null,
                        "68845",
                        null,
                        "CAT"
                ),
                seedCompagnieAssurance(
                        "MATU",
                        "MUTUELLE D'ASSURANCES DES TRANSPORTEURS UNIS",
                        "207-209, Boulevard Mohamed Bouziane",
                        "Casablanca",
                        "info@matu-assurance.ma",
                        "0522596850",
                        null,
                        null,
                        "MATU"
                ),
                seedCompagnieAssurance(
                        "MAROCAINE_VIE",
                        "MAROCAINE VIE",
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        "MVIE"
                ),
                seedCompagnieAssurance(
                        "ATTAMINE_CHAABI",
                        "MUTUELLE ATTAMINE CHAABI",
                        "Angle Avenue Mohammed VI et Rue Houmane El Fatouaki",
                        "Rabat",
                        null,
                        null,
                        null,
                        null,
                        "ATC"
                )
        );
        for (int index = 0; index < compagnies.size(); index++) {
            CompagnieAssurance compagnie = compagnies.get(index);
            compagnie.setOrdreAffichage((index + 1) * 10);
            compagnieAssuranceRepository.save(compagnie);
        }
        return compagnies;
    }

    private CompagnieAssurance seedCompagnieAssurance(
            String code,
            String nom,
            String adresse,
            String ville,
            String email,
            String telephone,
            String rc,
            String ice,
            String prefixeAttestation
    ) {
        CompagnieAssurance compagnie = compagnieAssuranceRepository.findByCode(code).orElseGet(() ->
                compagnieAssuranceRepository.save(CompagnieAssurance.builder()
                        .code(code)
                        .nom(nom)
                        .actif(true)
                        .build())
        );
        compagnie.setNom(nom);
        compagnie.setAdresse(adresse);
        compagnie.setVille(ville);
        compagnie.setEmail(email);
        compagnie.setTelephone(telephone);
        compagnie.setRc(rc);
        compagnie.setIce(ice);
        compagnie.setPrefixeAttestation(prefixeAttestation);
        if (compagnie.getOrdreAffichage() == null) {
            compagnie.setOrdreAffichage(100);
        }
        compagnie.setActif(true);
        return compagnieAssuranceRepository.save(compagnie);
    }

    private void seedCompagniesAssistance() {
        seedCompagnieAssistanceProvider("AFRICA_FIRST_ASSIST", "AFRICA FIRST ASSIST", null, null);
        seedCompagnieAssistanceProvider("COVER_EDGE", "COVER EDGE", null, null);
        seedCompagnieAssistanceProvider("MAROC_ASSISTANCE_INTERNATIONAL", "MAROC ASSISTANCE INTERNATIONAL", null, null);
        seedCompagnieAssistanceProvider("RMA_ASSISTANCE", "RMA ASSISTANCE", null, null);
        seedCompagnieAssistanceProvider("WAFA_IMA_ASSISTANCE", "WAFA IMA ASSISTANCE", null, null);
    }

    private CompagnieAssistance seedCompagnieAssistanceProvider(String code, String nom, String email, String telephone) {
        CompagnieAssistance compagnie = compagnieAssistanceRepository.findByCodeIgnoreCase(code).orElseGet(() ->
                compagnieAssistanceRepository.save(CompagnieAssistance.builder()
                        .code(code)
                        .nom(nom)
                        .actif(true)
                        .build())
        );
        compagnie.setNom(nom);
        compagnie.setEmail(email);
        compagnie.setTelephone(telephone);
        compagnie.setActif(true);
        return compagnieAssistanceRepository.save(compagnie);
    }

    private Garantie seedGarantie(
            String code,
            String libelle,
            TypeGarantie typeGarantie,
            boolean obligatoire,
            boolean responsabiliteCivile,
            boolean defenseRecours,
            boolean requiertValeurVenale,
            boolean requiertValeurNeuf,
            boolean requiertValeurGlace,
            boolean avecCapital,
            boolean avecFranchise,
            boolean tarificationMultiple,
            int ordreAffichage,
            ModeTarificationGarantie modeParDefaut,
            List<ModeTarificationGarantie> modesAutorises,
            SourceValeurGarantie sourceValeurParDefaut,
            List<SourceValeurGarantie> sourcesValeurAutorisees,
            boolean saisieManuelleAutorisee,
            boolean verrouillee
    ) {
        Garantie garantie = garantieRepository.findByCode(code).orElseGet(() ->
                Garantie.builder()
                        .code(code)
                        .libelle(libelle)
                        .branche("Automobile")
                        .typeGarantie(typeGarantie)
                        .obligatoire(obligatoire)
                        .responsabiliteCivile(responsabiliteCivile)
                        .defenseRecours(defenseRecours)
                        .requiertValeurVenale(requiertValeurVenale)
                        .requiertValeurNeuf(requiertValeurNeuf)
                        .requiertValeurGlace(requiertValeurGlace)
                        .avecCapital(avecCapital)
                        .avecFranchise(avecFranchise)
                        .tarificationMultiple(tarificationMultiple)
                        .ordreAffichage(ordreAffichage)
                        .actif(true)
                        .build()
        );
        garantie.setLibelle(libelle);
        garantie.setBranche("Automobile");
        garantie.setTypeGarantie(typeGarantie);
        garantie.setObligatoire(obligatoire);
        garantie.setResponsabiliteCivile(responsabiliteCivile);
        garantie.setDefenseRecours(defenseRecours);
        garantie.setRequiertValeurVenale(requiertValeurVenale);
        garantie.setRequiertValeurNeuf(requiertValeurNeuf);
        garantie.setRequiertValeurGlace(requiertValeurGlace);
        garantie.setAvecCapital(avecCapital);
        garantie.setAvecFranchise(avecFranchise);
        garantie.setTarificationMultiple(tarificationMultiple);
        garantie.setOrdreAffichage(ordreAffichage);
        garantie.setModeParDefaut(modeParDefaut);
        if (garantie.getModesAutorises() == null) {
            garantie.setModesAutorises(new LinkedHashSet<>());
        }
        garantie.getModesAutorises().clear();
        garantie.getModesAutorises().addAll(modesAutorises);
        garantie.setSourceValeurParDefaut(sourceValeurParDefaut);
        if (garantie.getSourcesValeurAutorisees() == null) {
            garantie.setSourcesValeurAutorisees(new LinkedHashSet<>());
        }
        garantie.getSourcesValeurAutorisees().clear();
        garantie.getSourcesValeurAutorisees().addAll(sourcesValeurAutorisees);
        garantie.setSaisieManuelleAutorisee(saisieManuelleAutorisee);
        garantie.setVerrouillee(verrouillee);
        garantie.setActif(true);
        return garantieRepository.save(garantie);
    }

    private CompagnieGarantie seedCompagnieGarantie(CompagnieAssurance compagnie, Garantie garantie) {
        return compagnieGarantieRepository
                .findByCompagnieAssuranceIdAndGarantieId(compagnie.getId(), garantie.getId())
                .orElseGet(() -> compagnieGarantieRepository.save(
                        CompagnieGarantie.builder()
                                .compagnieAssurance(compagnie)
                                .garantie(garantie)
                                .tauxZeroAutorise(true)
                                .modeVariable(false)
                                .actif(true)
                                .build()
                ));
    }

    private Marque seedMarque(String libelle) {
        return marqueRepository.findByLibelleIgnoreCase(libelle).orElseGet(() ->
                marqueRepository.save(Marque.builder()
                        .libelle(libelle)
                        .actif(true)
                        .build())
        );
    }

    private Carrosserie seedCarrosserie(String libelle) {
        return carrosserieRepository.findByLibelleIgnoreCase(libelle).orElseGet(() ->
                carrosserieRepository.save(Carrosserie.builder()
                        .libelle(libelle)
                        .actif(true)
                        .build())
        );
    }

    private Carburant seedCarburant(String code, String libelle) {
        Carburant carburant = carburantRepository.findByCodeIgnoreCase(code).orElseGet(() ->
                carburantRepository.save(Carburant.builder()
                        .code(code)
                        .libelle(libelle)
                        .actif(true)
                        .build())
        );
        carburant.setLibelle(libelle);
        return carburantRepository.save(carburant);
    }

    private SousClasse seedSousClasse(String code, String libelle) {
        SousClasse sousClasse = sousClasseRepository.findByCodeIgnoreCase(code).orElseGet(() ->
                sousClasseRepository.save(SousClasse.builder()
                        .code(code)
                        .libelle(libelle)
                        .actif(true)
                        .build())
        );
        sousClasse.setLibelle(libelle);
        return sousClasseRepository.save(sousClasse);
    }

    private Usage seedUsage(
            String code,
            String libelle,
            String criteria,
            GroupeUsageAttestation groupeUsageAttestation,
            boolean consommeAttestation,
            boolean byCarburantAndPf,
            boolean bySousClasse,
            boolean byPtc,
            boolean byPrime,
            Carrosserie... carrosseries
    ) {
        return seedUsage(code, libelle, criteria, groupeUsageAttestation, consommeAttestation, byCarburantAndPf, bySousClasse, byPtc, byPrime, false, carrosseries);
    }

    private Usage seedUsage(
            String code,
            String libelle,
            String criteria,
            GroupeUsageAttestation groupeUsageAttestation,
            boolean consommeAttestation,
            boolean byCarburantAndPf,
            boolean bySousClasse,
            boolean byPtc,
            boolean byPrime,
            boolean byCategorieTransport,
            Carrosserie... carrosseries
    ) {
        boolean garantiesPersonne = "A".equalsIgnoreCase(code) || "C1".equalsIgnoreCase(code);
        Usage usage = usageRepository.findByCodeIgnoreCase(code).orElseGet(() ->
                usageRepository.save(Usage.builder()
                        .code(code)
                        .libelle(libelle)
                        .criteria(criteria)
                        .groupeUsageAttestation(groupeUsageAttestation)
                        .consommeAttestation(consommeAttestation)
                        .byCarburantAndPf(byCarburantAndPf)
                        .bySousClasse(bySousClasse)
                        .byPtc(byPtc)
                        .byPrime(byPrime)
                        .byCategorieTransport(byCategorieTransport)
                        .garantiesPersonne(garantiesPersonne)
                        .actif(true)
                        .build())
        );
        usage.getCarrosseries().addAll(List.of(carrosseries));
        usage.setGroupeUsageAttestation(groupeUsageAttestation);
        usage.setConsommeAttestation(consommeAttestation);
        usage.setCriteria(criteria);
        usage.setByCarburantAndPf(byCarburantAndPf);
        usage.setBySousClasse(bySousClasse);
        usage.setByPtc(byPtc);
        usage.setByPrime(byPrime);
        usage.setByCategorieTransport(byCategorieTransport);
        if (usage.getGarantiesPersonne() == null) {
            usage.setGarantiesPersonne(garantiesPersonne);
        }
        return usageRepository.save(usage);
    }

    private CategorieTransport seedCategorieTransport(String code, String libelle, String description) {
        CategorieTransport categorie = categorieTransportRepository.findByCodeIgnoreCase(code).orElseGet(() ->
                categorieTransportRepository.save(CategorieTransport.builder()
                        .code(code)
                        .libelle(libelle)
                        .description(description)
                        .actif(true)
                        .build())
        );
        categorie.setLibelle(libelle);
        categorie.setDescription(description);
        categorie.setActif(true);
        return categorieTransportRepository.save(categorie);
    }

    private GroupeUsageAttestation seedGroupeUsageAttestation(String code, String libelle, String couleur, String restrictionCompagnie) {
        GroupeUsageAttestation groupe = groupeUsageAttestationRepository.findByCodeIgnoreCase(code).orElseGet(() ->
                groupeUsageAttestationRepository.save(GroupeUsageAttestation.builder()
                        .code(code)
                        .libelle(libelle)
                        .couleur(couleur)
                        .restrictionCompagnie(restrictionCompagnie)
                        .visibleStock(true)
                        .actif(true)
                        .build())
        );
        groupe.setLibelle(libelle);
        groupe.setCouleur(couleur);
        groupe.setRestrictionCompagnie(restrictionCompagnie);
        groupe.setVisibleStock(true);
        groupe.setActif(true);
        return groupeUsageAttestationRepository.save(groupe);
    }

    private CategorieClient seedCategorieClient(String code, String libelle) {
        CategorieClient categorieClient = categorieClientRepository.findByCodeIgnoreCase(code).orElseGet(() ->
                categorieClientRepository.save(CategorieClient.builder()
                        .code(code)
                        .libelle(libelle)
                        .actif(true)
                        .build())
        );
        categorieClient.setLibelle(libelle);
        categorieClient.setActif(true);
        return categorieClientRepository.save(categorieClient);
    }

    private void attachUsages(CategorieClient categorieClient, Usage... usages) {
        categorieClient.getUsages().addAll(List.of(usages));
        categorieClientRepository.save(categorieClient);
    }

    private ParametreApplication seedParametreApplication(String code, String type, String valeur, String description) {
        ParametreApplication parametre = parametreApplicationRepository
                .findByAgenceIsNullAndCodeIgnoreCaseAndActifTrue(code)
                .orElseGet(() -> parametreApplicationRepository.save(ParametreApplication.builder()
                        .code(code)
                        .type(type)
                        .valeur(valeur)
                        .description(description)
                        .actif(true)
                        .build()));
        parametre.setType(type);
        parametre.setValeur(valeur);
        parametre.setDescription(description);
        parametre.setActif(true);
        return parametreApplicationRepository.save(parametre);
    }

    private CapitalResponsabiliteCivile seedCapitalResponsabiliteCivile(String usageCode, BigDecimal capital) {
        CapitalResponsabiliteCivile capitalRc = capitalResponsabiliteCivileRepository
                .findByUsageCodeIgnoreCaseAndActifTrue(usageCode)
                .orElseGet(() -> capitalResponsabiliteCivileRepository.save(CapitalResponsabiliteCivile.builder()
                        .usageCode(usageCode)
                        .capital(capital)
                        .actif(true)
                        .build()));
        capitalRc.setCapital(capital);
        capitalRc.setActif(true);
        return capitalResponsabiliteCivileRepository.save(capitalRc);
    }

    private TypeMouvementContrat seedTypeMouvement(
            String code,
            String libelle,
            CategorieMouvementContrat categorie,
            TypeImpactMouvement typeImpact,
            List<TypeContrat> typesContrat,
            boolean modifieGaranties,
            boolean garantiesEditables,
            boolean modifieVehicule,
            boolean modifieRemorque,
            boolean cnpacSeul,
            boolean genereQuittance,
            boolean autoriseAssistance,
            boolean autoriseCarteVerte,
            boolean consommeAttestation,
            boolean clotureContrat,
            boolean renouvelleContrat,
            int ordreAffichage
    ) {
        TypeMouvementContrat typeMouvement = typeMouvementContratRepository.findByCodeIgnoreCase(code).orElseGet(() ->
                typeMouvementContratRepository.save(TypeMouvementContrat.builder()
                        .code(code)
                        .libelle(libelle)
                        .categorie(categorie)
                        .actif(true)
                        .build())
        );
        typeMouvement.setLibelle(libelle);
        typeMouvement.setCategorie(categorie);
        typeMouvement.setTypeImpact(typeImpact);
        if (typeMouvement.getTypesContratAutorises() == null) {
            typeMouvement.setTypesContratAutorises(new LinkedHashSet<>());
        }
        typeMouvement.getTypesContratAutorises().clear();
        typeMouvement.getTypesContratAutorises().addAll(typesContrat);
        typeMouvement.setModifieGaranties(modifieGaranties);
        typeMouvement.setGarantiesEditables(garantiesEditables);
        typeMouvement.setModifieVehicule(modifieVehicule);
        typeMouvement.setModifieRemorque(modifieRemorque);
        typeMouvement.setCnpacSeul(cnpacSeul);
        typeMouvement.setGenereQuittance(genereQuittance);
        typeMouvement.setAutoriseAssistance(autoriseAssistance);
        typeMouvement.setAutoriseCarteVerte(autoriseCarteVerte);
        typeMouvement.setConsommeAttestation(consommeAttestation);
        typeMouvement.setClotureContrat(clotureContrat);
        typeMouvement.setRenouvelleContrat(renouvelleContrat);
        typeMouvement.setOrdreAffichage(ordreAffichage);
        typeMouvement.setActif(true);
        return typeMouvementContratRepository.save(typeMouvement);
    }

}
