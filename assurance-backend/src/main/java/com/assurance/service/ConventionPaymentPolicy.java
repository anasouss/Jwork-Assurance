package com.assurance.service;

import com.assurance.dto.request.AvenantRequest;
import com.assurance.dto.response.QuittanceResponse;
import com.assurance.entity.Contrat;
import com.assurance.entity.ElementFacturable;
import com.assurance.entity.MouvementContrat;
import com.assurance.enums.ModeReglementConvention;
import com.assurance.enums.TypeContrat;
import com.assurance.exception.BadRequestException;
import java.math.BigDecimal;

public final class ConventionPaymentPolicy {
    private ConventionPaymentPolicy() {
    }

    public static ModeReglementConvention inheritedMode(Contrat contract) {
        String mode = contract.getModeReglement();
        if (mode == null) return null;
        if ("facture".equalsIgnoreCase(mode.trim())) return ModeReglementConvention.FACTURE;
        if ("bureau".equalsIgnoreCase(mode.trim())) return ModeReglementConvention.BUREAU;
        return null;
    }

    public static boolean isInvoice(ElementFacturable element) {
        Contrat contract = element.getContrat();
        if (contract == null || contract.getTypeContrat() != TypeContrat.CONVENTION) return false;
        if (element.getNature() != com.assurance.enums.NatureElementFacturable.CONTRAT
                && element.getNature() != com.assurance.enums.NatureElementFacturable.MOUVEMENT_CONTRAT) return false;
        MouvementContrat movement = element.getMouvementContrat();
        ModeReglementConvention mode = movement == null || movement.getModeReglementConvention() == null
                ? inheritedMode(contract) : movement.getModeReglementConvention();
        return mode == ModeReglementConvention.FACTURE;
    }

    public static QuittanceResponse preview(Contrat contract, QuittanceResponse response) {
        BigDecimal premium = "RETOUR_PRIME".equals(response.getTypeImpactMouvement())
                ? zero(response.getPrimeTotale()).abs().negate() : zero(response.getPrimeTotale());
        response.setRequiresConventionPayment(contract.getTypeContrat() == TypeContrat.CONVENTION
                && premium.signum() != 0);
        return response;
    }

    public static void apply(Contrat contract, MouvementContrat movement, AvenantRequest request, QuittanceResponse response) {
        preview(contract, response);
        if (contract.getTypeContrat() != TypeContrat.CONVENTION) {
            if (request.getModeReglement() != null || request.getNumeroBonCommande() != null || request.getMontantBulletin() != null) {
                throw new BadRequestException("Le mode de reglement de l'avenant concerne uniquement les conventions");
            }
            return;
        }
        if (!Boolean.TRUE.equals(response.getRequiresConventionPayment())) return;
        ModeReglementConvention mode = request.getModeReglement() == null ? inheritedMode(contract) : request.getModeReglement();
        if (mode == null) throw new BadRequestException("Selectionnez le mode de reglement de l'avenant");
        if (mode == ModeReglementConvention.FACTURE) {
            String order = request.getNumeroBonCommande() == null ? "" : request.getNumeroBonCommande().trim();
            boolean credit = "RETOUR_PRIME".equals(response.getTypeImpactMouvement())
                    || zero(response.getPrimeTotale()).signum() < 0;
            if ((!credit && order.isEmpty()) || order.length() > 120) throw new BadRequestException("Le numero de bon de commande de l'avenant est obligatoire (120 caracteres maximum)");
            BigDecimal amount = request.getMontantBulletin();
            if (amount == null || amount.signum() <= 0 || amount.scale() > 2 || amount.precision() - amount.scale() > 12) {
                throw new BadRequestException("Renseignez un montant de bulletin positif pour cet avenant, avec deux decimales maximum");
            }
            movement.setNumeroBonCommande(order.isEmpty() ? null : order);
            movement.setMontantBulletin(amount);
        } else {
            movement.setNumeroBonCommande(null);
            movement.setMontantBulletin(null);
        }
        movement.setModeReglementConvention(mode);
    }

    private static BigDecimal zero(BigDecimal amount) {
        return amount == null ? BigDecimal.ZERO : amount;
    }
}
