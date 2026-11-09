package com.assurance.service;

import com.assurance.entity.AffectationReglementClient;
import com.assurance.entity.AssistanceContrat;
import com.assurance.entity.ElementFacturable;
import com.assurance.entity.InstrumentReglementClient;
import com.assurance.entity.LigneDocumentClient;
import com.assurance.enums.NatureElementFacturable;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

final class BillableReferences {
    private BillableReferences() {
    }

    static String assistance(AssistanceContrat assistance) {
        return assistance == null ? null : text(assistance.getNumeroContratOuQuittance());
    }

    static String documentLine(LigneDocumentClient line) {
        return text(line.getElementFacturable() != null
                && line.getElementFacturable().getNature() == NatureElementFacturable.ASSISTANCE
                ? line.getNumeroQuittance() : line.getNumeroPolice());
    }

    static String element(ElementFacturable element, Map<Long, String> assistanceNumbers) {
        if (element == null) return null;
        if (element.getNature() == NatureElementFacturable.ASSISTANCE) {
            return assistanceNumbers.get(element.getId());
        }
        return element.getContrat() == null ? null : text(element.getContrat().getNumeroPolice());
    }

    static String allocation(AffectationReglementClient allocation, Map<Long, String> assistanceNumbers) {
        if (allocation.getDocumentClient() == null) {
            return element(allocation.getElementFacturable(), assistanceNumbers);
        }
        // Read saved document references, without substituting current contract values.
        String reference = allocation.getDocumentClient().getLignes().stream()
                .filter(line -> allocation.getElementFacturable() == null
                        || line.getElementFacturable() != null && Objects.equals(
                                line.getElementFacturable().getId(), allocation.getElementFacturable().getId()))
                .map(BillableReferences::documentLine).filter(Objects::nonNull).distinct()
                .collect(Collectors.joining("\n"));
        return text(reference);
    }

    static Set<Long> assistanceElementIds(Collection<InstrumentReglementClient> instruments) {
        return instruments.stream().flatMap(instrument -> instrument.getAffectations().stream())
                .flatMap(allocation -> allocation.getDocumentClient() == null
                        ? Stream.ofNullable(allocation.getElementFacturable())
                        : allocation.getDocumentClient().getLignes().stream().map(LigneDocumentClient::getElementFacturable))
                .filter(Objects::nonNull)
                .filter(element -> element.getNature() == NatureElementFacturable.ASSISTANCE)
                .map(ElementFacturable::getId).filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    static Map<Long, String> assistanceNumbers(List<AssistanceContrat> assistances) {
        Map<Long, String> numbers = new LinkedHashMap<>();
        for (AssistanceContrat assistance : assistances) {
            String number = assistance(assistance);
            if (number != null && assistance.getElementFacturable() != null) {
                numbers.put(assistance.getElementFacturable().getId(), number);
            }
        }
        return numbers;
    }

    private static String text(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
