package com.assurance.activity;

import com.assurance.entity.AgenceCompagnieAssurance;
import com.assurance.entity.AgenceCompagnieAssistance;
import com.assurance.entity.CodePromoAssistance;
import com.assurance.entity.CompagnieAssistance;
import com.assurance.entity.CompagnieAssurance;
import com.assurance.entity.Convention;
import com.assurance.entity.ProduitAssistance;
import com.assurance.entity.TarifProduitAssistance;
import com.assurance.entity.Usage;
import org.jsoup.Jsoup;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

public final class CompanyCatalogueActivity {
    private CompanyCatalogueActivity() {
    }

    public static State state(CompagnieAssurance company) {
        return new State(null, insuranceCompany(company), new ActivityValues().put("Code", company.getCode()).put("Nom", company.getNom())
                .put("Nom abrege", company.getNomAbrege())
                .put("Adresse", company.getAdresse()).put("Ville", company.getVille()).put("E-mail", company.getEmail())
                .put("Telephone", company.getTelephone()).put("RC", company.getRc()).put("ICE", company.getIce())
                .put("Prefixe attestation", company.getPrefixeAttestation()).put("Prefixe carte verte", company.getPrefixeCarteVerte())
                .put("Prefixe dossier", company.getPrefixeDossier()).put("Ordre d'affichage", company.getOrdreAffichage())
                .put("Actif", company.getActif()).snapshot(), List.of(), null);
    }

    public static State state(CompagnieAssistance company) {
        return new State(null, assistanceCompany(company), new ActivityValues().put("Code", company.getCode()).put("Nom", company.getNom())
                .put("Nom abrege", company.getNomAbrege())
                .put("E-mail", company.getEmail()).put("Telephone", company.getTelephone()).put("Actif", company.getActif()).snapshot(), List.of(), null);
    }

    public static State state(AgenceCompagnieAssurance configuration) {
        return new State(configuration.getAgence().getId(), ActivityReference.of(ActivityRecordType.AGENCE_COMPAGNIE_ASSURANCE,
                configuration.getId(), "Code intermediaire - " + configuration.getCompagnieAssurance().getNom()),
                new ActivityValues().put("Code intermediaire", configuration.getCodeIntermediaire()).snapshot(),
                List.of(insuranceCompany(configuration.getCompagnieAssurance())), null);
    }

    public static State state(AgenceCompagnieAssistance configuration) {
        return new State(configuration.getAgence().getId(), ActivityReference.of(ActivityRecordType.AGENCE_COMPAGNIE_ASSISTANCE,
                configuration.getId(), "Code intermediaire - " + configuration.getCompagnieAssistance().getNom()),
                new ActivityValues().put("Code intermediaire", configuration.getCodeIntermediaire()).snapshot(),
                List.of(assistanceCompany(configuration.getCompagnieAssistance())), null);
    }

    public static State state(ProduitAssistance product) {
        List<ActivityReference> references = productReferences(product);
        String benefits = product.getPrestations() == null ? null : Jsoup.parseBodyFragment(product.getPrestations()).body().text();
        return new State(null, productReference(product), new ActivityValues().put("Libelle", product.getLibelle()).put("Type", product.getType())
                .put("Compagnie", product.getCompagnieAssistance().getNom())
                .put("Categorie client", product.getCategorieClient() == null ? null : product.getCategorieClient().getLibelle())
                .put("Usages autorises", product.getUsages().stream().map(CompanyCatalogueActivity::usageLabel).sorted().collect(Collectors.joining("\n")))
                .put("Prestations", benefits).put("Actif", product.getActif()).snapshot(), references, product.getPrestations());
    }

    public static State productDeletion(ProduitAssistance product) {
        State base = state(product);
        Map<String, String> values = new LinkedHashMap<>(base.values());
        List<ActivityReference> references = new ArrayList<>(base.references());
        int index = 0;
        for (var rate : product.getTarifs().stream().sorted(Comparator.comparing(TarifProduitAssistance::getId)).toList()) {
            State child = state(rate);
            String prefix = "Tarif " + (++index) + " - ";
            child.values().forEach((key, value) -> values.put(prefix + key, value));
            references.add(child.subject());
        }
        index = 0;
        for (var promotion : product.getCodesPromo().stream().sorted(Comparator.comparing(CodePromoAssistance::getId)).toList()) {
            State child = state(promotion);
            String prefix = "Promotion " + (++index) + " - ";
            child.values().forEach((key, value) -> values.put(prefix + key, value));
            references.add(child.subject());
        }
        return new State(base.agencyId(), base.subject(), values, references, base.presentation());
    }

    public static State state(TarifProduitAssistance rate) {
        ProduitAssistance product = rate.getProduitAssistance();
        return new State(null, ActivityReference.of(ActivityRecordType.TARIF_ASSISTANCE, rate.getId(),
                "Tarif - " + product.getLibelle() + " - " + rate.getDateDebut().format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy"))),
                new ActivityValues().put("Produit", product.getLibelle()).put("Debut de validite", rate.getDateDebut())
                        .put("Fin de validite", rate.getDateFin()).put("Age minimum", rate.getAgeMin()).put("Age maximum", rate.getAgeMax())
                        .put("Duree en mois", rate.getDureeMois()).put("Montant HT", rate.getMontantHt())
                        .put("Montant TTC", rate.getMontantTtc()).put("Actif", rate.getActif()).snapshot(),
                List.of(productReference(product), assistanceCompany(product.getCompagnieAssistance())), null);
    }

    public static State state(CodePromoAssistance promotion) {
        ProduitAssistance product = promotion.getProduitAssistance();
        return new State(null, ActivityReference.of(ActivityRecordType.CODE_PROMO_ASSISTANCE, promotion.getId(),
                "Promotion " + promotion.getCode() + " - " + product.getLibelle()),
                new ActivityValues().put("Code", promotion.getCode()).put("Produit", product.getLibelle())
                        .put("Reduction (%)", promotion.getTauxReduction()).put("Debut de validite", promotion.getDateDebut())
                        .put("Fin de validite", promotion.getDateFin()).put("Actif", promotion.getActif()).snapshot(),
                List.of(productReference(product), assistanceCompany(product.getCompagnieAssistance())), null);
    }

    public static State state(Convention convention) {
        List<ActivityReference> references = new ArrayList<>();
        references.add(insuranceCompany(convention.getCompagnieAssurance()));
        if (convention.getCategorieClient() != null) references.add(new ActivityReference(ActivityRecordType.REFERENTIEL,
                "CATEGORIE_CLIENT:" + convention.getCategorieClient().getId(), convention.getCategorieClient().getLibelle()));
        if (convention.getGrilleTarifaire() != null) references.add(ActivityReference.of(ActivityRecordType.GRILLE_TARIFAIRE,
                convention.getGrilleTarifaire().getId(), convention.getGrilleTarifaire().getLibelle()));
        convention.getUsages().forEach(usage -> references.add(usageReference(usage)));
        return new State(convention.getAgence().getId(), ActivityReference.of(ActivityRecordType.CONVENTION, convention.getId(),
                convention.getCode() + " - " + convention.getIntitule()),
                new ActivityValues().put("Code", convention.getCode()).put("Intitule", convention.getIntitule())
                        .put("Description", convention.getDescription()).put("Organisme conventionne", convention.getOrganismeConventionne())
                        .put("Compagnie", convention.getCompagnieAssurance().getNom())
                        .put("Categorie client", convention.getCategorieClient() == null ? null : convention.getCategorieClient().getLibelle())
                        .put("Grille tarifaire", convention.getGrilleTarifaire() == null ? null : convention.getGrilleTarifaire().getLibelle())
                        .put("Usages autorises", convention.getUsages().stream().map(CompanyCatalogueActivity::usageLabel).sorted().collect(Collectors.joining("\n")))
                        .put("Date d'effet", convention.getDateEffet()).put("Date d'echeance", convention.getDateEcheance())
                        .put("Type d'echeance", convention.getTypeEcheance() == null ? null : switch (convention.getTypeEcheance()) {
                            case DATE_A_DATE -> "Date a date";
                            case A_ECHEANCE -> "A echeance";
                        }).put("Echeance", convention.getEcheance())
                        .put("Fractionnement", convention.getFractionnement() == null ? null : switch (convention.getFractionnement()) {
                            case MENSUEL -> "Mensuel";
                            case TRIMESTRIEL -> "Trimestriel";
                            case SEMESTRIEL -> "Semestriel";
                            case ANNUEL -> "Annuel";
                        }).put("Actif", convention.getActif()).snapshot(), references, null);
    }

    public static ActivityCommand command(State before, State after, ActivityAction action, String title, String origin) {
        State current = after == null ? Objects.requireNonNull(before) : after;
        List<ActivityReference> references = new ArrayList<>();
        if (before != null) references.addAll(before.references());
        if (after != null) references.addAll(after.references());
        List<ActivityChange> changes = new ArrayList<>(ActivityValues.changes(before == null ? null : before.values(), after == null ? null : after.values()));
        if (before != null && after != null && !Objects.equals(before.presentation(), after.presentation())
                && Objects.equals(before.values().get("Prestations"), after.values().get("Prestations"))) {
            changes.add(new ActivityChange("Presentation des prestations", null, "Actualisee"));
        }
        if (before != null && after != null && changes.isEmpty() && !referenceIdentities(before).equals(referenceIdentities(after))) {
            changes.add(new ActivityChange("References associees", null, "Actualisees"));
        }
        return new ActivityCommand(current.agencyId(), ActivityModule.COMPAGNIES, action, title, origin,
                current.subject(), references.stream().distinct().toList(), changes);
    }

    public static java.util.Set<String> referenceIdentities(State state) {
        return state.references().stream().map(reference -> reference.type() + ":" + reference.id()).collect(Collectors.toSet());
    }

    private static List<ActivityReference> productReferences(ProduitAssistance product) {
        List<ActivityReference> references = new ArrayList<>();
        references.add(assistanceCompany(product.getCompagnieAssistance()));
        if (product.getCategorieClient() != null) references.add(new ActivityReference(ActivityRecordType.REFERENTIEL,
                "CATEGORIE_CLIENT:" + product.getCategorieClient().getId(), product.getCategorieClient().getLibelle()));
        product.getUsages().forEach(usage -> references.add(usageReference(usage)));
        return references;
    }

    private static ActivityReference insuranceCompany(CompagnieAssurance company) {
        return ActivityReference.of(ActivityRecordType.COMPAGNIE, company.getId(), company.getNom());
    }

    private static ActivityReference assistanceCompany(CompagnieAssistance company) {
        return ActivityReference.of(ActivityRecordType.COMPAGNIE_ASSISTANCE, company.getId(), company.getNom());
    }

    private static ActivityReference productReference(ProduitAssistance product) {
        return ActivityReference.of(ActivityRecordType.PRODUIT_ASSISTANCE, product.getId(), product.getLibelle());
    }

    private static ActivityReference usageReference(Usage usage) {
        return new ActivityReference(ActivityRecordType.REFERENTIEL, "USAGE:" + usage.getId(), usageLabel(usage));
    }

    private static String usageLabel(Usage usage) {
        return usage.getCode() + " - " + usage.getLibelle();
    }

    public record State(Long agencyId, ActivityReference subject, Map<String, String> values,
                        List<ActivityReference> references, String presentation) {
        public State {
            values = Collections.unmodifiableMap(new LinkedHashMap<>(values));
            references = List.copyOf(references);
        }
    }
}
