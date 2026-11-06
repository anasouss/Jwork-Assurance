package com.assurance.dto.request;

import com.assurance.exception.BadRequestException;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.Data;

/** Descriptive caller intent only; never determines success or the fields persisted. */
@Data
public class AvenantDraftContext {
    public enum Intent { SAVE_DRAFT, SAVE_TARGET, PREPARE_VALIDATION }
    public enum TargetKind { VEHICULE, REMORQUE }
    public enum Section { INFO, GARANTIES }

    private Intent intent = Intent.SAVE_DRAFT;
    private TargetKind targetKind;
    @PositiveOrZero
    private Integer targetIndex;
    private Section section;

    public void validate(AvenantRequest request, int existingVehicles, int existingTrailers) {
        if (intent == null) throw new BadRequestException("Le contexte de sauvegarde est invalide");
        if (intent != Intent.SAVE_TARGET) {
            if (targetKind != null || targetIndex != null || section != null) {
                throw new BadRequestException("La cible ne s'applique qu'a une sauvegarde de section");
            }
            return;
        }
        if (targetKind == null || targetIndex == null || targetIndex < 0 || section == null) {
            throw new BadRequestException("La cible et la section enregistrees sont obligatoires");
        }
        int count = targetKind == TargetKind.VEHICULE
                ? request.getVehicules() == null ? existingVehicles : request.getVehicules().size()
                : request.getRemorques() == null ? existingTrailers : request.getRemorques().size();
        if (targetIndex >= count) throw new BadRequestException("La cible enregistree n'existe pas dans le brouillon");
    }

    public String title() {
        return switch (intent) {
            case SAVE_DRAFT -> "Brouillon d'avenant enregistre";
            case PREPARE_VALIDATION -> "Brouillon d'avenant sauvegarde avant validation";
            case SAVE_TARGET -> "Brouillon d'avenant enregistre depuis "
                    + (section == Section.GARANTIES ? "les garanties " : "les informations ")
                    + (targetKind == TargetKind.VEHICULE ? "du vehicule " : "de la remorque ") + (targetIndex + 1);
        };
    }
}
