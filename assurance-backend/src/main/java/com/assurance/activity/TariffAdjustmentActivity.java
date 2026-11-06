package com.assurance.activity;

import com.assurance.entity.AjustementTarifUsage;
import com.assurance.entity.LigneAjustementTarifUsage;
import com.assurance.enums.TypeOperationTarifUsage;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

public final class TariffAdjustmentActivity {
    private TariffAdjustmentActivity() {
    }

    public static ActivityCommand command(AjustementTarifUsage batch, List<LigneAjustementTarifUsage> lines) {
        boolean reset = batch.getTypeOperation() == TypeOperationTarifUsage.REINITIALISATION;
        ActivityValues values = new ActivityValues().put("Operation", reset ? "Reinitialisation" : "Ajustement")
                .put("Debut d'application", batch.getDateDebut()).put("Fin d'application", batch.getDateFin())
                .put("Mode de calcul", batch.getTypeCalcul() == null ? null : switch (batch.getTypeCalcul()) {
                    case POURCENTAGE -> "Pourcentage";
                    case MONTANT_FIXE -> "Montant fixe";
                })
                .put("Sens", batch.getSens() == null ? null : switch (batch.getSens()) {
                    case HAUSSE -> "Hausse";
                    case BAISSE -> "Baisse";
                }).put("Valeur", batch.getValeur()).put("Motif", batch.getMotif()).put("Nombre de tarifs", lines.size());
        List<ActivityReference> references = new ArrayList<>();
        int index = 0;
        for (var line : lines.stream().sorted(Comparator.comparing(item -> item.getTarifUsage().getId())).toList()) {
            String prefix = "Tarif " + (++index) + " - ";
            String label = line.getDescriptionSnapshot();
            if (label == null || label.isBlank()) label = "Tarif usage";
            values.put(prefix + "Usage", line.getUsageCodeSnapshot()).put(prefix + "Description", line.getDescriptionSnapshot())
                    .put(prefix + "Prime de base", line.getPrimeNetteInitiale()).put(prefix + "Prime de cette version", line.getPrimeNetteAppliquee());
            references.add(ActivityReference.of(ActivityRecordType.TARIF_USAGE, line.getTarifUsage().getId(), label));
        }
        return new ActivityCommand(null, ActivityModule.REFERENTIELS, ActivityAction.CREATED,
                reset ? "Reinitialisation des tarifs enregistree" : "Ajustement des tarifs enregistre", "USAGE_TARIFF_ADJUSTMENT",
                ActivityReference.of(ActivityRecordType.AJUSTEMENT_TARIF_USAGE, batch.getId(),
                        (reset ? "Reinitialisation" : "Ajustement") + " du " + batch.getDateDebut().format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy"))),
                references, ActivityValues.changes(null, values.snapshot()));
    }
}
