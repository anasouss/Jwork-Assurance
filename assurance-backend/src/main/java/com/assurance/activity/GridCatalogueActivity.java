package com.assurance.activity;

import com.assurance.entity.FormuleGarantiePersonne;
import com.assurance.entity.GrilleTarifaire;
import com.assurance.entity.LigneGrilleTarifaire;
import com.assurance.entity.Usage;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class GridCatalogueActivity {
    private GridCatalogueActivity() {
    }

    public static CompanyCatalogueActivity.State state(GrilleTarifaire grid) {
        return new CompanyCatalogueActivity.State(grid.getAgence() == null ? null : grid.getAgence().getId(),
                ActivityReference.of(ActivityRecordType.GRILLE_TARIFAIRE, grid.getId(), grid.getLibelle()),
                new ActivityValues().put("Libelle", grid.getLibelle()).put("Description", grid.getDescription())
                        .put("Compagnie", grid.getCompagnieAssurance().getNom()).put("Actif", grid.getActif()).snapshot(),
                List.of(ActivityReference.of(ActivityRecordType.COMPAGNIE, grid.getCompagnieAssurance().getId(), grid.getCompagnieAssurance().getNom())), null);
    }

    public static CompanyCatalogueActivity.State state(LigneGrilleTarifaire row) {
        var grid = state(row.getGrilleTarifaire());
        List<ActivityReference> references = context(grid, row.getGarantie().getId(), row.getGarantie().getLibelle(), row.getUsage());
        if (row.getCategorieTransport() != null) references.add(new ActivityReference(ActivityRecordType.REFERENTIEL,
                "CATEGORIE_TRANSPORT:" + row.getCategorieTransport().getId(), row.getCategorieTransport().getLibelle()));
        if (row.getSousClasse() != null) references.add(new ActivityReference(ActivityRecordType.REFERENTIEL,
                "SOUS_CLASSE:" + row.getSousClasse().getId(), row.getSousClasse().getLibelle()));
        return new CompanyCatalogueActivity.State(grid.agencyId(), ActivityReference.of(ActivityRecordType.LIGNE_GRILLE_TARIFAIRE,
                row.getId(), "Ligne " + row.getGarantie().getCode() + (row.getLibelleOption() == null ? "" : " - " + row.getLibelleOption())),
                new ActivityValues().put("Garantie", row.getGarantie().getCode() + " - " + row.getGarantie().getLibelle()).put("Usage", usageLabel(row.getUsage()))
                        .put("Categorie transport", row.getCategorieTransport() == null ? null : row.getCategorieTransport().getLibelle())
                        .put("Puissance fiscale minimum", row.getPuissanceFiscaleMin()).put("Puissance fiscale maximum", row.getPuissanceFiscaleMax())
                        .put("Places minimum", row.getNombrePlacesMin()).put("Places maximum", row.getNombrePlacesMax())
                        .put("PTC minimum", row.getPtcMin()).put("PTC maximum", row.getPtcMax())
                        .put("Sous-classe", row.getSousClasse() == null ? null : row.getSousClasse().getLibelle()).put("Carburant", row.getCarburant())
                        .put("Option", row.getLibelleOption()).put("Ordre d'affichage", row.getOrdreAffichage())
                        .put("Mode de tarification", row.getModeTarification() == null ? null : switch (row.getModeTarification()) {
                            case TAUX -> "Taux";
                            case CAPITAL -> "Capital";
                            case PROTECTION -> "Protection";
                            case PRIME_FIXE -> "Prime fixe";
                        }).put("Taux", row.getTaux()).put("Taux de franchise", row.getTauxFranchise())
                        .put("Franchise minimale", row.getFranchiseMinimale()).put("Prime", row.getPrime()).put("Capital", row.getCapital())
                        .put("Actif", row.getActif()).snapshot(), references, null);
    }

    public static CompanyCatalogueActivity.State state(FormuleGarantiePersonne formula) {
        var grid = state(formula.getGrilleTarifaire());
        return new CompanyCatalogueActivity.State(grid.agencyId(), ActivityReference.of(ActivityRecordType.FORMULE_GARANTIE_PERSONNE,
                formula.getId(), formula.getGarantie().getCode() + " - " + formula.getFormule()),
                new ActivityValues().put("Garantie", formula.getGarantie().getCode() + " - " + formula.getGarantie().getLibelle()).put("Usage", usageLabel(formula.getUsage()))
                        .put("Formule", formula.getFormule()).put("Deces", formula.getMontantDeces()).put("Invalidite", formula.getMontantInvalidite())
                        .put("Frais medicaux", formula.getMontantFraisMedicaux()).put("Hospitalisation", formula.getMontantFraisHospitalisation())
                        .put("Frais funeraires", formula.getMontantFraisFuneraires()).put("Chirurgie", formula.getMontantFraisChirurgie())
                        .put("Prime nette", formula.getPrimeNette()).put("Accessoires", formula.getAccessoire())
                        .put("Ordre d'affichage", formula.getOrdreAffichage()).put("Actif", formula.getActif()).snapshot(),
                context(grid, formula.getGarantie().getId(), formula.getGarantie().getLibelle(), formula.getUsage()), null);
    }

    public static Configuration configuration(GrilleTarifaire grid, Usage usage, List<LigneGrilleTarifaire> lines,
            List<FormuleGarantiePersonne> formulas) {
        List<CompanyCatalogueActivity.State> rows = new ArrayList<>();
        lines.forEach(row -> rows.add(state(row)));
        formulas.forEach(row -> rows.add(state(row)));
        return new Configuration(state(grid), usageReference(usage), List.copyOf(rows));
    }

    public static ActivityCommand configurationCommand(Configuration before, Configuration after) {
        Map<String, CompanyCatalogueActivity.State> unmatched = new LinkedHashMap<>();
        before.rows().forEach(row -> unmatched.put(key(row), row));
        Map<String, CompanyCatalogueActivity.State> matched = new LinkedHashMap<>();
        // Match surviving identities first, then unchanged recreated business rows.
        for (var row : after.rows()) {
            var old = unmatched.remove(key(row));
            if (old != null) matched.put(key(row), old);
        }
        List<ActivityChange> changes = new ArrayList<>();
        int index = 0;
        for (var row : after.rows()) {
            var old = matched.get(key(row));
            if (old == null) {
                String equivalent = unmatched.entrySet().stream()
                        .filter(entry -> entry.getValue().subject().type() == row.subject().type() && entry.getValue().values().equals(row.values())
                                && CompanyCatalogueActivity.referenceIdentities(entry.getValue()).equals(CompanyCatalogueActivity.referenceIdentities(row)))
                        .map(Map.Entry::getKey).findFirst().orElse(null);
                if (equivalent != null) old = unmatched.remove(equivalent);
            }
            appendChanges(changes, (++index) + " - " + row.subject().label(), old, row);
        }
        for (var removed : unmatched.values()) appendChanges(changes, (++index) + " - " + removed.subject().label(), removed, null);
        List<ActivityReference> references = new ArrayList<>(before.grid().references());
        references.addAll(after.grid().references());
        references.add(after.usage());
        for (var row : before.rows()) {
            references.add(row.subject());
            references.addAll(row.references());
        }
        for (var row : after.rows()) {
            references.add(row.subject());
            references.addAll(row.references());
        }
        references.removeIf(reference -> reference.type() == ActivityRecordType.GRILLE_TARIFAIRE && reference.id().equals(after.grid().subject().id()));
        return new ActivityCommand(after.grid().agencyId(), ActivityModule.COMPAGNIES, ActivityAction.SAVED,
                "Configuration tarifaire de l'usage enregistree", "GRID_USAGE_CONFIGURATION", after.grid().subject(),
                references.stream().distinct().toList(), changes);
    }

    private static void appendChanges(List<ActivityChange> changes, String label, CompanyCatalogueActivity.State before,
            CompanyCatalogueActivity.State after) {
        var differences = ActivityValues.changes(before == null ? null : before.values(), after == null ? null : after.values());
        for (var change : differences) {
            changes.add(new ActivityChange(label + " - " + change.label(), change.beforeValue(), change.afterValue()));
        }
        if (before != null && after != null && differences.isEmpty()
                && !CompanyCatalogueActivity.referenceIdentities(before).equals(CompanyCatalogueActivity.referenceIdentities(after))) {
            changes.add(new ActivityChange(label + " - References associees", null, "Actualisees"));
        }
    }

    private static String key(CompanyCatalogueActivity.State row) {
        return row.subject().type() + ":" + row.subject().id();
    }

    private static List<ActivityReference> context(CompanyCatalogueActivity.State grid, Long guaranteeId, String guaranteeLabel, Usage usage) {
        List<ActivityReference> references = new ArrayList<>(grid.references());
        references.add(grid.subject());
        references.add(ActivityReference.of(ActivityRecordType.GARANTIE, guaranteeId, guaranteeLabel));
        if (usage != null) references.add(usageReference(usage));
        return references;
    }

    private static ActivityReference usageReference(Usage usage) {
        return new ActivityReference(ActivityRecordType.REFERENTIEL, "USAGE:" + usage.getId(), usageLabel(usage));
    }

    private static String usageLabel(Usage usage) {
        return usage == null ? null : usage.getCode() + " - " + usage.getLibelle();
    }

    public record Configuration(CompanyCatalogueActivity.State grid, ActivityReference usage, List<CompanyCatalogueActivity.State> rows) {
    }
}
