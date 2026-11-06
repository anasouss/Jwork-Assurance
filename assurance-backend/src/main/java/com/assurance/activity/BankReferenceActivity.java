package com.assurance.activity;

import com.assurance.entity.Banque;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

public final class BankReferenceActivity {
    private BankReferenceActivity() {
    }

    public static Map<String, String> snapshot(Banque bank) {
        return new ActivityValues().put("Code", bank.getCode()).put("Nom", bank.getLibelle())
                .put("Autres denominations", bank.getAliases().stream().sorted().collect(Collectors.joining(", ")))
                .put("Ordre d'affichage", bank.getOrdre()).put("Actif", bank.getActif()).snapshot();
    }

    public static ActivityCommand command(Banque bank, Map<String, String> before, ActivityAction action, String title, String origin) {
        return new ActivityCommand(bank.getAgence().getId(), ActivityModule.TRESORERIE, action, title, origin,
                ActivityReference.of(ActivityRecordType.BANQUE, bank.getId(), bank.getCode() + " - " + bank.getLibelle()),
                List.of(), ActivityValues.changes(before, snapshot(bank)));
    }
}
