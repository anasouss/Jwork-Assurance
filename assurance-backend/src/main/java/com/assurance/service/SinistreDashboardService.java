package com.assurance.service;

import com.assurance.dto.response.SinistreDashboardResponse;
import com.assurance.enums.StatutSinistre;
import com.assurance.enums.TypeOperationSinistre;
import com.assurance.repository.ProvisionSinistreRepository;
import com.assurance.repository.SinistreOperationRepository;
import com.assurance.repository.SinistreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

@Service
@RequiredArgsConstructor
public class SinistreDashboardService {

    private static final List<StatutSinistre> OPEN_STATUSES = List.of(
            StatutSinistre.BROUILLON,
            StatutSinistre.DECLARE,
            StatutSinistre.DOSSIER_INCOMPLET,
            StatutSinistre.TRANSMIS_COMPAGNIE,
            StatutSinistre.EXPERTISE,
            StatutSinistre.EN_ATTENTE_REGLEMENT,
            StatutSinistre.PARTIELLEMENT_REGLE,
            StatutSinistre.ROUVERT
    );

    private final SinistreRepository sinistreRepository;
    private final ProvisionSinistreRepository provisionRepository;
    private final SinistreOperationRepository operationRepository;
    private final SinistreResponseMapper responseMapper;

    @Transactional(readOnly = true)
    public SinistreDashboardResponse get(Long agenceId) {
        LocalDate today = LocalDate.now();
        YearMonth month = YearMonth.from(today);
        LocalDate yearStart = LocalDate.of(today.getYear(), 1, 1);
        LocalDate yearEnd = LocalDate.of(today.getYear(), 12, 31);
        return SinistreDashboardResponse.builder()
                .ouverts(sinistreRepository.countByAgenceIdAndStatutIn(agenceId, OPEN_STATUSES))
                .declaresCeMois(sinistreRepository.countByAgenceIdAndDateDeclarationBetween(
                        agenceId,
                        month.atDay(1),
                        month.atEndOfMonth()
                ))
                .enExpertise(sinistreRepository.countByAgenceIdAndStatutIn(
                        agenceId,
                        List.of(StatutSinistre.EXPERTISE)
                ))
                .enAttenteReglement(sinistreRepository.countByAgenceIdAndStatutIn(
                        agenceId,
                        List.of(StatutSinistre.EN_ATTENTE_REGLEMENT, StatutSinistre.PARTIELLEMENT_REGLE)
                ))
                .provisionsOuvertes(provisionRepository.totalCurrentByAgencyAndStatuses(agenceId, OPEN_STATUSES))
                .reglementsAnnee(operationRepository.totalActiveByAgencyAndTypeAndDateBetween(
                        agenceId,
                        TypeOperationSinistre.REGLEMENT,
                        yearStart,
                        yearEnd
                ))
                .recoursAnnee(operationRepository.totalActiveByAgencyAndTypeAndDateBetween(
                        agenceId,
                        TypeOperationSinistre.RECOURS,
                        yearStart,
                        yearEnd
                ))
                .recents(sinistreRepository.findTop8ByAgenceIdOrderByUpdatedAtDesc(agenceId)
                        .stream()
                        .map(responseMapper::toSummary)
                        .toList())
                .build();
    }
}
