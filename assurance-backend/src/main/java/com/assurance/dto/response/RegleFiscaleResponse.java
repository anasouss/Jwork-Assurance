package com.assurance.dto.response;

import com.assurance.entity.RegleFiscale;
import com.assurance.enums.BaseCalculRegleFiscale;
import com.assurance.enums.CategorieQuittance;
import com.assurance.enums.ModeCalculRegleFiscale;
import com.assurance.enums.NatureRegleFiscale;
import com.assurance.enums.TypeContrat;
import com.assurance.enums.TypeGarantie;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;

@Getter
@Builder
public class RegleFiscaleResponse {
    private Long id;
    private String code;
    private String libelle;
    private NatureRegleFiscale nature;
    private ModeCalculRegleFiscale modeCalcul;
    private BigDecimal valeur;
    private BaseCalculRegleFiscale baseCalcul;
    private CategorieQuittance categorieBase;
    private CategorieQuittance categorieResultat;
    private Long brancheAssuranceId;
    private String brancheAssuranceCode;
    private String brancheAssuranceLibelle;
    private Long compagnieAssuranceId;
    private String compagnieAssuranceLibelle;
    private Long categorieClientId;
    private String categorieClientCode;
    private String categorieClientLibelle;
    private Long garantieId;
    private String garantieCode;
    private String garantieLibelle;
    private List<GarantieReference> garanties;
    private TypeGarantie typeGarantie;
    private Long usageId;
    private String usageCode;
    private String usageLibelle;
    private Long groupeUsageAttestationId;
    private String groupeUsageAttestationCode;
    private TypeContrat typeContrat;
    private LocalDate dateDebut;
    private LocalDate dateFin;
    private Boolean applicable;
    private Integer priorite;
    private Boolean actif;
    private String description;
    private String referenceReglementaire;

    @Getter
    @Builder
    public static class GarantieReference {
        private Long id;
        private String code;
        private String libelle;
    }

    public static RegleFiscaleResponse from(RegleFiscale rule) {
        List<GarantieReference> garanties = rule.getGaranties().stream()
                .sorted(Comparator.comparing(garantie -> garantie.getCode() == null ? "" : garantie.getCode()))
                .map(garantie -> GarantieReference.builder()
                        .id(garantie.getId())
                        .code(garantie.getCode())
                        .libelle(garantie.getLibelle())
                        .build())
                .toList();
        GarantieReference singleGarantie = garanties.size() == 1 ? garanties.get(0) : null;
        return RegleFiscaleResponse.builder()
                .id(rule.getId()).code(rule.getCode()).libelle(rule.getLibelle())
                .nature(rule.getNature()).modeCalcul(rule.getModeCalcul()).valeur(rule.getValeur())
                .baseCalcul(rule.getBaseCalcul()).categorieBase(rule.getCategorieBase())
                .categorieResultat(rule.getCategorieResultat())
                .brancheAssuranceId(rule.getBrancheAssurance() == null ? null : rule.getBrancheAssurance().getId())
                .brancheAssuranceCode(rule.getBrancheAssurance() == null ? null : rule.getBrancheAssurance().getCode())
                .brancheAssuranceLibelle(rule.getBrancheAssurance() == null ? null : rule.getBrancheAssurance().getLibelle())
                .compagnieAssuranceId(rule.getCompagnieAssurance() == null ? null : rule.getCompagnieAssurance().getId())
                .compagnieAssuranceLibelle(rule.getCompagnieAssurance() == null ? null : rule.getCompagnieAssurance().getNom())
                .categorieClientId(rule.getCategorieClient() == null ? null : rule.getCategorieClient().getId())
                .categorieClientCode(rule.getCategorieClient() == null ? null : rule.getCategorieClient().getCode())
                .categorieClientLibelle(rule.getCategorieClient() == null ? null : rule.getCategorieClient().getLibelle())
                .garantieId(singleGarantie == null ? null : singleGarantie.getId())
                .garantieCode(singleGarantie == null ? null : singleGarantie.getCode())
                .garantieLibelle(singleGarantie == null ? null : singleGarantie.getLibelle())
                .garanties(garanties)
                .typeGarantie(rule.getTypeGarantie())
                .usageId(rule.getUsage() == null ? null : rule.getUsage().getId())
                .usageCode(rule.getUsage() == null ? null : rule.getUsage().getCode())
                .usageLibelle(rule.getUsage() == null ? null : rule.getUsage().getLibelle())
                .groupeUsageAttestationId(rule.getGroupeUsageAttestation() == null ? null : rule.getGroupeUsageAttestation().getId())
                .groupeUsageAttestationCode(rule.getGroupeUsageAttestation() == null ? null : rule.getGroupeUsageAttestation().getCode())
                .typeContrat(rule.getTypeContrat()).dateDebut(rule.getDateDebut()).dateFin(rule.getDateFin())
                .applicable(rule.getApplicable()).priorite(rule.getPriorite()).actif(rule.getActif())
                .description(rule.getDescription()).referenceReglementaire(rule.getReferenceReglementaire())
                .build();
    }
}
