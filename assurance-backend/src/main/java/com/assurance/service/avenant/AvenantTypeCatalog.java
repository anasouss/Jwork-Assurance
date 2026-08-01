package com.assurance.service.avenant;

import com.assurance.dto.request.AvenantRequest;
import com.assurance.exception.BadRequestException;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Component
public class AvenantTypeCatalog {

    private static final Map<String, AvenantTypeFamily> TYPES = Map.ofEntries(
            Map.entry("EXG_M", AvenantTypeFamily.GUARANTEE_CHANGE),
            Map.entry("MOG_M", AvenantTypeFamily.GUARANTEE_CHANGE),
            Map.entry("MOG_F", AvenantTypeFamily.GUARANTEE_CHANGE),
            Map.entry("CHV_M", AvenantTypeFamily.VEHICLE_REPLACEMENT),
            Map.entry("PRO_M", AvenantTypeFamily.VEHICLE_REPLACEMENT),
            Map.entry("INC_F", AvenantTypeFamily.TARGET_ADDITION),
            Map.entry("EXR_M", AvenantTypeFamily.TARGET_ADDITION),
            Map.entry("RET_F", AvenantTypeFamily.TARGET_SELECTION),
            Map.entry("EXR_F", AvenantTypeFamily.TARGET_SELECTION),
            Map.entry("PRI_M", AvenantTypeFamily.TARGET_PRECISION),
            Map.entry("PRI_F", AvenantTypeFamily.TARGET_PRECISION),
            Map.entry("DUP_M", AvenantTypeFamily.TARGET_DUPLICATE),
            Map.entry("DUP_F", AvenantTypeFamily.TARGET_DUPLICATE),
            Map.entry("RES_M", AvenantTypeFamily.CONTRACT_CLOSURE),
            Map.entry("RCH_M", AvenantTypeFamily.CONTRACT_CLOSURE),
            Map.entry("ANN_M", AvenantTypeFamily.CONTRACT_CLOSURE),
            Map.entry("RES_F", AvenantTypeFamily.CONTRACT_CLOSURE),
            Map.entry("RCH_F", AvenantTypeFamily.CONTRACT_CLOSURE)
    );

    private static final Set<String> SINGLE_VEHICLE_TYPES = Set.of("CHV_M", "PRO_M");
    private static final Set<String> REMORQUE_ADDITION_TYPES = Set.of("EXR_M");

    public AvenantTypeFamily requireFamily(String rawCode) {
        String code = normalize(rawCode);
        AvenantTypeFamily family = TYPES.get(code);
        if (family == null) {
            throw new BadRequestException("Le type d'avenant " + code + " n'est pas pris en charge");
        }
        return family;
    }

    public void validateDraft(String code, AvenantRequest request) {
        requireRequest(code, request);
    }

    public void validateCommand(String rawCode, AvenantRequest request) {
        String code = requireRequest(rawCode, request);
        if (request.getDateEffet() == null) {
            throw new BadRequestException("La date d'effet de l'avenant est obligatoire");
        }

        AvenantTypeFamily family = requireFamily(code);
        switch (family) {
            case GUARANTEE_CHANGE -> requireNonEmpty(request.getGaranties(), "Les garanties sont obligatoires");
            case VEHICLE_REPLACEMENT -> validateSingleVehicle(code, request);
            case TARGET_ADDITION -> validateAddition(code, request);
            case TARGET_SELECTION -> validateSelection(code, request);
            case TARGET_PRECISION -> requireNonEmpty(request.getPrecisions(), "Les precisions sont obligatoires");
            case TARGET_DUPLICATE -> requireSelection(request, "Selectionnez au moins une cible pour le duplicata");
            case CONTRACT_CLOSURE -> rejectTargetChanges(request);
        }
    }

    private String requireRequest(String rawCode, AvenantRequest request) {
        String code = normalize(rawCode);
        requireFamily(code);
        if (request == null) {
            throw new BadRequestException("Les donnees de l'avenant sont obligatoires");
        }
        return code;
    }

    private void validateSingleVehicle(String code, AvenantRequest request) {
        if (!SINGLE_VEHICLE_TYPES.contains(code)) {
            throw new BadRequestException("Type de remplacement de vehicule invalide");
        }
        if (size(request.getVehicules()) != 1) {
            throw new BadRequestException("Cet avenant doit contenir exactement un vehicule");
        }
        requireNonEmpty(request.getGaranties(), "Les garanties du vehicule sont obligatoires");
        if (hasItems(request.getRemorques())) {
            throw new BadRequestException("Cet avenant ne peut pas ajouter de remorque");
        }
    }

    private void validateAddition(String code, AvenantRequest request) {
        if (REMORQUE_ADDITION_TYPES.contains(code)) {
            requireNonEmpty(request.getRemorques(), "La remorque est obligatoire");
            if (hasItems(request.getVehicules())) {
                throw new BadRequestException("Une extension remorque ne peut pas ajouter de vehicule");
            }
        } else if (!hasItems(request.getVehicules()) && !hasItems(request.getRemorques())) {
            throw new BadRequestException("Ajoutez au moins un vehicule ou une remorque");
        }
        requireNonEmpty(request.getGaranties(), "Les garanties des nouvelles cibles sont obligatoires");
    }

    private void validateSelection(String code, AvenantRequest request) {
        if ("EXR_F".equals(code)) {
            requireNonEmpty(request.getRemorqueIds(), "Selectionnez au moins une remorque");
            return;
        }
        requireSelection(request, "Selectionnez au moins une cible a retirer");
    }

    private void requireSelection(AvenantRequest request, String message) {
        if (!hasItems(request.getVehiculeIds()) && !hasItems(request.getRemorqueIds())) {
            throw new BadRequestException(message);
        }
    }

    private void rejectTargetChanges(AvenantRequest request) {
        if (hasItems(request.getVehicules())
                || hasItems(request.getRemorques())
                || hasItems(request.getGaranties())
                || hasItems(request.getPrecisions())
                || hasItems(request.getAttestations())) {
            throw new BadRequestException("Un avenant de cloture ne peut pas modifier les cibles du contrat");
        }
    }

    private <T> void requireNonEmpty(List<T> values, String message) {
        if (!hasItems(values)) {
            throw new BadRequestException(message);
        }
    }

    private boolean hasItems(List<?> values) {
        return values != null && !values.isEmpty();
    }

    private int size(List<?> values) {
        return values == null ? 0 : values.size();
    }

    private String normalize(String code) {
        if (code == null || code.isBlank()) {
            throw new BadRequestException("Le type d'avenant est obligatoire");
        }
        return code.trim().toUpperCase(Locale.ROOT);
    }
}
