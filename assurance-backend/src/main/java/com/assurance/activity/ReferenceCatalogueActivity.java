package com.assurance.activity;

import com.assurance.entity.Carburant;
import com.assurance.entity.Carrosserie;
import com.assurance.entity.CategorieClient;
import com.assurance.entity.CategorieTransport;
import com.assurance.entity.CompagnieGarantie;
import com.assurance.entity.Garantie;
import com.assurance.entity.GroupeExclusionGarantie;
import com.assurance.entity.GroupeUsageAttestation;
import com.assurance.entity.Marque;
import com.assurance.entity.SousClasse;
import com.assurance.entity.TarifUsage;
import com.assurance.entity.Usage;
import com.assurance.enums.ModeTarificationGarantie;
import com.assurance.enums.SourceValeurGarantie;
import com.assurance.enums.TypeGarantie;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

/** Business configuration snapshots, never an entity serialization. */
public final class ReferenceCatalogueActivity {
    private ReferenceCatalogueActivity() {
    }

    public static State state(Marque marque) {
        return state(ActivityRecordType.MARQUE, marque.getId(), marque.getLibelle(),
                new ActivityValues().put("Libellé", marque.getLibelle()).put("Actif", marque.getActif()), List.of());
    }

    public static State state(Carrosserie carrosserie) {
        return state(ActivityRecordType.CARROSSERIE, carrosserie.getId(), carrosserie.getLibelle(),
                new ActivityValues().put("Libellé", carrosserie.getLibelle()).put("Actif", carrosserie.getActif()), List.of());
    }

    public static State state(Carburant carburant) {
        return state(ActivityRecordType.CARBURANT, carburant.getId(), label(carburant.getCode(), carburant.getLibelle()),
                new ActivityValues().put("Code", carburant.getCode()).put("Libellé", carburant.getLibelle())
                        .put("Actif", carburant.getActif()), List.of());
    }

    public static State state(SousClasse sousClasse) {
        return state(ActivityRecordType.SOUS_CLASSE, sousClasse.getId(), label(sousClasse.getCode(), sousClasse.getLibelle()),
                new ActivityValues().put("Code", sousClasse.getCode()).put("Libellé", sousClasse.getLibelle())
                        .put("Caractéristique moteur", sousClasse.getChampMoteur() == null ? null : switch (sousClasse.getChampMoteur()) {
                            case CYLINDREE -> "Cylindrée";
                            case PUISSANCE_FISCALE -> "Puissance fiscale";
                        }).put("Conducteur et permis requis", sousClasse.getConducteurPermisRequis())
                        .put("Assistance autorisée", sousClasse.getAssistanceAutorisee()).put("Actif", sousClasse.getActif()), List.of());
    }

    public static State state(Usage usage) {
        var group = usage.getGroupeUsageAttestation();
        List<ActivityReference> references = group == null ? List.of() : List.of(groupReference(group));
        return state(ActivityRecordType.USAGE, usage.getId(), label(usage.getCode(), usage.getLibelle()),
                new ActivityValues().put("Code", usage.getCode()).put("Libellé", usage.getLibelle()).put("Critères", usage.getCriteria())
                        .put("Ferme uniquement", usage.getFermeUniquement())
                        .put("Périodes autorisées", usage.getPeriodesAutorisees().stream().sorted()
                                .map(com.assurance.enums.PeriodeCouverture::getLibelle)
                                .collect(java.util.stream.Collectors.joining(", ")))
                        .put("Groupe d'attestations", group == null ? null : label(group.getCode(), group.getLibelle()))
                        .put("Consomme une attestation", usage.getConsommeAttestation()).put("Tarification par carburant", usage.getByCarburant())
                        .put("Tarification par puissance fiscale", usage.getByPuissanceFiscale()).put("Tarification par sous-classe", usage.getBySousClasse())
                        .put("Tarification par PTC", usage.getByPtc()).put("Tarification par prime", usage.getByPrime())
                        .put("Tarification par catégorie de transport", usage.getByCategorieTransport()).put("Garanties des personnes", usage.getGarantiesPersonne())
                        .put("Majoration RC remorque (%)", usage.getTauxExtensionRemorque()).put("Actif", usage.getActif()), references);
    }

    public static State state(TarifUsage tarif) {
        Usage usage = tarif.getUsage();
        List<ActivityReference> references = new ArrayList<>();
        references.add(ActivityReference.of(ActivityRecordType.USAGE, usage.getId(), label(usage.getCode(), usage.getLibelle())));
        if (tarif.getSousClasse() != null) references.add(state(tarif.getSousClasse()).subject());
        if (tarif.getCategorieTransport() != null) references.add(state(tarif.getCategorieTransport()).subject());
        tarif.getCarburants().forEach(carburant -> references.add(state(carburant).subject()));
        return state(ActivityRecordType.TARIF_USAGE, tarif.getId(), "Tarif " + label(usage.getCode(), usage.getLibelle()),
                new ActivityValues().put("Usage", label(usage.getCode(), usage.getLibelle()))
                        .put("Sous-classe", tarif.getSousClasse() == null ? null : label(tarif.getSousClasse().getCode(), tarif.getSousClasse().getLibelle()))
                        .put("Catégorie de transport", tarif.getCategorieTransport() == null ? null : label(tarif.getCategorieTransport().getCode(), tarif.getCategorieTransport().getLibelle()))
                        .put("Carburants", tarif.getCarburants().stream().map(carburant -> label(carburant.getCode(), carburant.getLibelle()))
                                .sorted().collect(Collectors.joining(", ")))
                        .put("Puissance fiscale minimum", tarif.getPuissanceFiscaleMin()).put("Puissance fiscale maximum", tarif.getPuissanceFiscaleMax())
                        .put("Places minimum", tarif.getNombrePlacesMin()).put("Places maximum", tarif.getNombrePlacesMax())
                        .put("PTC minimum", tarif.getPtcMin()).put("PTC maximum", tarif.getPtcMax())
                        .put("Prime nette initiale", tarif.getPrimeNette()).put("Prime par place", tarif.getPrimeParPlace())
                        .put("Actif", tarif.getActif()), references);
    }

    public static State state(CategorieTransport categorie) {
        return state(ActivityRecordType.CATEGORIE_TRANSPORT, categorie.getId(), label(categorie.getCode(), categorie.getLibelle()),
                new ActivityValues().put("Code", categorie.getCode()).put("Libellé", categorie.getLibelle())
                        .put("Description", categorie.getDescription()).put("Actif", categorie.getActif()), List.of());
    }

    public static State state(CategorieClient categorie) {
        List<ActivityReference> references = new ArrayList<>();
        categorie.getUsages().forEach(usage -> references.add(ActivityReference.of(ActivityRecordType.USAGE,
                usage.getId(), label(usage.getCode(), usage.getLibelle()))));
        var group = categorie.getGroupeUsageAttestation();
        if (group != null) references.add(groupReference(group));
        return state(ActivityRecordType.CATEGORIE_CLIENT, categorie.getId(), label(categorie.getCode(), categorie.getLibelle()),
                new ActivityValues().put("Code", categorie.getCode()).put("Libellé", categorie.getLibelle())
                        .put("Usages autorisés", categorie.getUsages().stream().map(usage -> label(usage.getCode(), usage.getLibelle()))
                                .sorted().collect(Collectors.joining(", ")))
                        .put("Groupe d'attestations", group == null ? null : label(group.getCode(), group.getLibelle()))
                        .put("Actif", categorie.getActif()), references);
    }

    public static State state(GroupeUsageAttestation group) {
        List<ActivityReference> references = group.getCompagniesRestreintes().stream()
                .map(company -> ActivityReference.of(ActivityRecordType.COMPAGNIE, company.getId(), company.getNom())).toList();
        return state(ActivityRecordType.GROUPE_USAGE_ATTESTATION, group.getId(), label(group.getCode(), group.getLibelle()),
                new ActivityValues().put("Code", group.getCode()).put("Libellé", group.getLibelle()).put("Couleur", group.getCouleur())
                        .put("Compagnies autorisées", group.getCompagniesRestreintes().stream().map(company -> label(company.getCode(), company.getNom()))
                                .sorted().collect(Collectors.joining(", ")))
                        .put("Visible dans le stock", group.getVisibleStock()).put("Actif", group.getActif()), references);
    }

    public static State state(GroupeExclusionGarantie group) {
        return state(ActivityRecordType.GROUPE_EXCLUSION_GARANTIE, group.getId(), label(group.getCode(), group.getLibelle()),
                new ActivityValues().put("Code", group.getCode()).put("Libellé", group.getLibelle())
                        .put("Type de garantie", guaranteeType(group.getTypeGarantie())).put("Actif", group.getActif()), List.of());
    }

    public static State state(Garantie garantie, List<CompagnieGarantie> configurations) {
        List<ActivityReference> references = new ArrayList<>();
        var branch = garantie.getBrancheAssurance();
        var group = garantie.getGroupeExclusion();
        var base = garantie.getGarantieReferencePrime();
        if (branch != null) references.add(new ActivityReference(ActivityRecordType.REFERENTIEL,
                "BRANCHE_ASSURANCE:" + branch.getId(), label(branch.getCode(), branch.getLibelle())));
        if (group != null) references.add(state(group).subject());
        if (base != null) references.add(ActivityReference.of(ActivityRecordType.GARANTIE, base.getId(), label(base.getCode(), base.getLibelle())));
        var withoutProrata = configurations.stream().filter(configuration -> Boolean.FALSE.equals(configuration.getProrataApplicable()))
                .map(CompagnieGarantie::getCompagnieAssurance).toList();
        withoutProrata.forEach(company -> references.add(ActivityReference.of(ActivityRecordType.COMPAGNIE, company.getId(), company.getNom())));
        return state(ActivityRecordType.GARANTIE, garantie.getId(), label(garantie.getCode(), garantie.getLibelle()),
                new ActivityValues().put("Code", garantie.getCode()).put("Libellé", garantie.getLibelle()).put("Description", garantie.getDescription())
                        .put("Branche", branch == null ? null : label(branch.getCode(), branch.getLibelle()))
                        .put("Groupe d'exclusion", group == null ? null : label(group.getCode(), group.getLibelle()))
                        .put("Type de garantie", guaranteeType(garantie.getTypeGarantie())).put("Obligatoire", garantie.getObligatoire())
                        .put("Responsabilité civile", garantie.getResponsabiliteCivile()).put("Défense et recours", garantie.getDefenseRecours())
                        .put("Valeur vénale requise", garantie.getRequiertValeurVenale()).put("Valeur à neuf requise", garantie.getRequiertValeurNeuf())
                        .put("Valeur glace requise", garantie.getRequiertValeurGlace()).put("Franchise", garantie.getAvecFranchise())
                        .put("Franchise minimale", garantie.getAvecFranchiseMinimale()).put("Capital", garantie.getAvecCapital())
                        .put("Tarification multiple", garantie.getTarificationMultiple())
                        .put("Modes de tarification multiple", garantie.getModesTarificationMultiple().stream().map(ReferenceCatalogueActivity::mode).sorted().collect(Collectors.joining(", ")))
                        .put("Modes autorisés", garantie.getModesAutorises().stream().map(ReferenceCatalogueActivity::mode).sorted().collect(Collectors.joining(", ")))
                        .put("Mode par défaut", mode(garantie.getModeParDefaut()))
                        .put("Critère de sélection tarifaire", garantie.getCritereSelectionTarif() == null ? null : switch (garantie.getCritereSelectionTarif()) {
                            case TAUX_PRIME -> "Taux de prime";
                            case TAUX_FRANCHISE -> "Taux de franchise";
                        }).put("Sources de valeur autorisées", garantie.getSourcesValeurAutorisees().stream()
                                .map(ReferenceCatalogueActivity::source).sorted().collect(Collectors.joining(", ")))
                        .put("Source de valeur par défaut", source(garantie.getSourceValeurParDefaut()))
                        .put("Prime de référence", base == null ? null : label(base.getCode(), base.getLibelle()))
                        .put("Saisie manuelle autorisée", garantie.getSaisieManuelleAutorisee()).put("Verrouillée", garantie.getVerrouillee())
                        .put("Compagnies sans prorata", withoutProrata.stream().map(company -> label(company.getCode(), company.getNom()))
                                .sorted().collect(Collectors.joining(", ")))
                        .put("Ordre d'affichage", garantie.getOrdreAffichage()).put("Actif", garantie.getActif()), references);
    }

    private static String guaranteeType(TypeGarantie type) {
        return type == null ? null : switch (type) {
            case VEHICULE -> "Véhicule";
            case PERSONNE -> "Personne";
        };
    }

    private static ActivityReference groupReference(GroupeUsageAttestation group) {
        return ActivityReference.of(ActivityRecordType.GROUPE_USAGE_ATTESTATION, group.getId(), label(group.getCode(), group.getLibelle()));
    }

    private static String mode(ModeTarificationGarantie mode) {
        return mode == null ? null : switch (mode) {
            case TAUX -> "Taux";
            case CAPITAL -> "Capital";
            case PROTECTION -> "Protection";
            case PRIME_FIXE -> "Prime fixe";
        };
    }

    private static String source(SourceValeurGarantie source) {
        return source == null ? null : switch (source) {
            case AUCUNE -> "Aucune";
            case VENALE -> "Valeur vénale";
            case NEUF -> "Valeur à neuf";
            case GLACE -> "Valeur glace";
            case MANUEL -> "Saisie manuelle";
        };
    }

    public static ActivityCommand command(State before, State after, ActivityAction action, String title, String origin) {
        State current = after == null ? Objects.requireNonNull(before) : after;
        List<ActivityReference> references = new ArrayList<>();
        if (before != null) references.addAll(before.references());
        if (after != null) references.addAll(after.references());
        List<ActivityChange> changes = new ArrayList<>(ActivityValues.changes(before == null ? null : before.values(), after == null ? null : after.values()));
        if (before != null && after != null && changes.isEmpty() && !referenceIds(before).equals(referenceIds(after))) {
            changes.add(new ActivityChange("Références associees", null, "Actualisées"));
        }
        return new ActivityCommand(null, ActivityModule.REFERENTIELS, action, title, origin, current.subject(),
                references.stream().distinct().toList(), changes);
    }

    public static ActivityCommand trailerRatesCommand(List<State> before, List<State> after) {
        Map<String, State> previous = before.stream().collect(Collectors.toMap(row -> row.subject().id(), row -> row));
        List<ActivityChange> changes = new ArrayList<>();
        List<ActivityReference> references = new ArrayList<>();
        String field = "Majoration RC remorque (%)";
        for (State row : after) {
            State old = Objects.requireNonNull(previous.get(row.subject().id()));
            var change = new ActivityChange(row.subject().label() + " - " + field, old.values().get(field), row.values().get(field));
            if (change.changed()) {
                changes.add(change);
                references.add(old.subject());
                references.add(row.subject());
            }
        }
        return new ActivityCommand(null, ActivityModule.REFERENTIELS, ActivityAction.SAVED,
                "Majorations RC remorque enregistrées", "USAGE_TRAILER_RATES_SAVE",
                new ActivityReference(ActivityRecordType.CONFIGURATION_USAGES, "TAUX_EXTENSION_REMORQUE", "Majorations RC remorque"),
                references.stream().distinct().toList(), changes);
    }

    private static java.util.Set<String> referenceIds(State state) {
        return state.references().stream().map(reference -> reference.type() + ":" + reference.id()).collect(Collectors.toSet());
    }

    private static State state(ActivityRecordType type, Long id, String label, ActivityValues values, List<ActivityReference> references) {
        return new State(ActivityReference.of(type, id, label), values.snapshot(), references);
    }

    private static String label(String code, String libelle) {
        return code == null || code.isBlank() ? libelle : code + " - " + libelle;
    }

    public record State(ActivityReference subject, Map<String, String> values, List<ActivityReference> references) {
        public State {
            values = Collections.unmodifiableMap(new LinkedHashMap<>(values));
            references = List.copyOf(references);
        }
    }
}
