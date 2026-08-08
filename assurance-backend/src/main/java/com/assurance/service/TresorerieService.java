package com.assurance.service;

import com.assurance.dto.request.UpsertCompteTresorerieRequest;
import com.assurance.dto.response.CompteTresorerieResponse;
import com.assurance.dto.response.MouvementTresorerieResponse;
import com.assurance.dto.response.MouvementTresoreriePageResponse;
import com.assurance.dto.response.SourceDocumentClientPageResponse;
import com.assurance.entity.Agence;
import com.assurance.entity.CompteTresorerie;
import com.assurance.entity.InstrumentReglementClient;
import com.assurance.entity.InstrumentReglementCompagnie;
import com.assurance.entity.MouvementTresorerie;
import com.assurance.enums.NatureMouvementTresorerie;
import com.assurance.enums.SensMouvementTresorerie;
import com.assurance.enums.TypeCompteTresorerie;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.AgenceRepository;
import com.assurance.repository.CompteTresorerieRepository;
import com.assurance.repository.MouvementTresorerieRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class TresorerieService {

    private final AgenceRepository agenceRepository;
    private final CompteTresorerieRepository compteRepository;
    private final MouvementTresorerieRepository mouvementRepository;

    @Transactional(readOnly = true)
    public List<CompteTresorerieResponse> listAccounts(Long agenceId) {
        return compteRepository.findByAgenceIdOrderByTypeCompteAscLibelleAsc(agenceId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public CompteTresorerieResponse createAccount(Long agenceId, UpsertCompteTresorerieRequest request) {
        String code = normalizeCode(request.getCode());
        if (compteRepository.existsByAgenceIdAndCodeIgnoreCase(agenceId, code)) {
            throw new BadRequestException("Un compte de trésorerie utilise déjà ce code");
        }
        Agence agence = agenceRepository.findById(agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Agence", agenceId));
        CompteTresorerie account = apply(CompteTresorerie.builder().agence(agence).build(), request, code);
        return toResponse(compteRepository.save(account));
    }

    @Transactional
    public CompteTresorerieResponse updateAccount(
            Long agenceId,
            Long accountId,
            UpsertCompteTresorerieRequest request
    ) {
        CompteTresorerie account = findAccount(agenceId, accountId);
        String code = normalizeCode(request.getCode());
        if (compteRepository.existsByAgenceIdAndCodeIgnoreCaseAndIdNot(agenceId, code, accountId)) {
            throw new BadRequestException("Un compte de trésorerie utilise déjà ce code");
        }
        if (request.getTypeCompte() != account.getTypeCompte()) {
            throw new BadRequestException("Le type d'un compte de trésorerie ne peut pas être modifié");
        }
        if (money(request.getSoldeInitial()).compareTo(money(account.getSoldeInitial())) != 0) {
            throw new BadRequestException(
                    "Le solde initial ne peut pas être modifié. Utilisez une écriture d'ajustement."
            );
        }
        return toResponse(compteRepository.save(apply(account, request, code)));
    }

    @Transactional
    public CompteTresorerieResponse changeAccountStatus(
            Long agenceId,
            Long accountId,
            Boolean active
    ) {
        CompteTresorerie account = findAccount(agenceId, accountId);
        account.setActif(Boolean.TRUE.equals(active));
        return toResponse(compteRepository.save(account));
    }

    @Transactional(readOnly = true)
    public List<MouvementTresorerieResponse> listMovements(Long agenceId) {
        return mouvementRepository.findByAgenceIdOrderByDateOperationDescIdDesc(agenceId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public MouvementTresoreriePageResponse searchMovements(
            Long agenceId,
            Long accountId,
            LocalDate dateDu,
            LocalDate dateAu,
            String search,
            int page,
            int size
    ) {
        if (dateDu != null && dateAu != null && dateDu.isAfter(dateAu)) {
            throw new BadRequestException("La date de début doit précéder la date de fin");
        }
        if (accountId != null) {
            findAccount(agenceId, accountId);
        }
        Page<MouvementTresorerie> result = mouvementRepository.search(
                agenceId,
                accountId,
                dateDu,
                dateAu,
                search == null || search.isBlank()
                        ? null : search.trim().toLowerCase(Locale.ROOT),
                PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100))
        );
        return MouvementTresoreriePageResponse.builder()
                .page(SourceDocumentClientPageResponse.PageInfo.builder()
                        .number(result.getNumber())
                        .size(result.getSize())
                        .totalElements(result.getTotalElements())
                        .totalPages(result.getTotalPages())
                        .first(result.isFirst())
                        .last(result.isLast())
                        .build())
                .rows(result.getContent().stream().map(this::toResponse).toList())
                .build();
    }

    @Transactional
    public MouvementTresorerie recordInstrumentEntry(
            InstrumentReglementClient instrument,
            CompteTresorerie account,
            LocalDate operationDate
    ) {
        if (!instrument.getAgence().getId().equals(account.getAgence().getId())) {
            throw new BadRequestException("Le compte de trésorerie appartient à une autre agence");
        }
        if (mouvementRepository.existsByInstrumentReglementIdAndMouvementExtourneIdIsNull(instrument.getId())) {
            throw new BadRequestException("Cet instrument possède déjà une écriture de trésorerie");
        }
        return mouvementRepository.save(MouvementTresorerie.builder()
                .agence(instrument.getAgence())
                .compteTresorerie(account)
                .instrumentReglement(instrument)
                .nature(NatureMouvementTresorerie.REGLEMENT_CLIENT)
                .sens(SensMouvementTresorerie.ENTREE)
                .dateOperation(operationDate)
                .dateValeur(operationDate)
                .montant(money(instrument.getMontant()))
                .reference(instrument.getReferenceInstrument())
                .libelle("Règlement client " + instrument.getReglement().getNumero())
                .build());
    }

    @Transactional
    public MouvementTresorerie reverseInstrumentEntry(
            InstrumentReglementClient instrument,
            String reason,
            LocalDate operationDate
    ) {
        MouvementTresorerie original = mouvementRepository
                .findFirstByAgenceIdAndInstrumentReglementIdAndNatureOrderByIdDesc(
                        instrument.getAgence().getId(),
                        instrument.getId(),
                        NatureMouvementTresorerie.REGLEMENT_CLIENT
                )
                .orElseThrow(() -> new BadRequestException("Aucune écriture de trésorerie à extourner"));
        if (mouvementRepository.existsByMouvementExtourneId(original.getId())) {
            throw new BadRequestException("Cette écriture de trésorerie est déjà extournée");
        }
        return mouvementRepository.save(MouvementTresorerie.builder()
                .agence(original.getAgence())
                .compteTresorerie(original.getCompteTresorerie())
                .instrumentReglement(instrument)
                .nature(NatureMouvementTresorerie.REJET_INSTRUMENT)
                .sens(SensMouvementTresorerie.SORTIE)
                .dateOperation(operationDate)
                .dateValeur(operationDate)
                .montant(original.getMontant())
                .reference(original.getReference())
                .libelle("Extourne " + original.getLibelle() + " - " + reason)
                .mouvementExtourneId(original.getId())
                .build());
    }

    @Transactional
    public MouvementTresorerie recordCompanyInstrumentExit(
            InstrumentReglementCompagnie instrument,
            CompteTresorerie account,
            LocalDate operationDate
    ) {
        if (!instrument.getAgence().getId().equals(account.getAgence().getId())) {
            throw new BadRequestException("Le compte de trésorerie appartient à une autre agence");
        }
        if (account.getTypeCompte() != TypeCompteTresorerie.BANQUE) {
            throw new BadRequestException("Un règlement compagnie doit utiliser un compte bancaire");
        }
        if (mouvementRepository.existsByInstrumentReglementCompagnieIdAndMouvementExtourneIdIsNull(
                instrument.getId()
        )) {
            throw new BadRequestException("Ce moyen de paiement possède déjà une écriture de trésorerie");
        }
        return mouvementRepository.save(MouvementTresorerie.builder()
                .agence(instrument.getAgence())
                .compteTresorerie(account)
                .instrumentReglementCompagnie(instrument)
                .nature(NatureMouvementTresorerie.REGLEMENT_COMPAGNIE)
                .sens(SensMouvementTresorerie.SORTIE)
                .dateOperation(operationDate)
                .dateValeur(operationDate)
                .montant(money(instrument.getMontant()))
                .reference(instrument.getReferenceInstrument())
                .libelle("Règlement compagnie " + instrument.getReglement().getNumero())
                .build());
    }

    @Transactional
    public MouvementTresorerie reverseCompanyInstrumentExit(
            InstrumentReglementCompagnie instrument,
            String reason,
            LocalDate operationDate
    ) {
        MouvementTresorerie original = mouvementRepository
                .findFirstByAgenceIdAndInstrumentReglementCompagnieIdAndNatureOrderByIdDesc(
                        instrument.getAgence().getId(),
                        instrument.getId(),
                        NatureMouvementTresorerie.REGLEMENT_COMPAGNIE
                )
                .orElseThrow(() -> new BadRequestException("Aucune écriture de trésorerie à extourner"));
        if (mouvementRepository.existsByMouvementExtourneId(original.getId())) {
            throw new BadRequestException("Cette écriture de trésorerie est déjà extournée");
        }
        return mouvementRepository.save(MouvementTresorerie.builder()
                .agence(original.getAgence())
                .compteTresorerie(original.getCompteTresorerie())
                .instrumentReglementCompagnie(instrument)
                .nature(NatureMouvementTresorerie.ANNULATION_REGLEMENT_COMPAGNIE)
                .sens(SensMouvementTresorerie.ENTREE)
                .dateOperation(operationDate)
                .dateValeur(operationDate)
                .montant(original.getMontant())
                .reference(original.getReference())
                .libelle("Extourne " + original.getLibelle() + " - " + reason)
                .mouvementExtourneId(original.getId())
                .build());
    }

    public CompteTresorerie findAccount(Long agenceId, Long accountId) {
        return compteRepository.findByIdAndAgenceId(accountId, agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Compte de trésorerie", accountId));
    }

    private CompteTresorerie apply(
            CompteTresorerie account,
            UpsertCompteTresorerieRequest request,
            String code
    ) {
        if (request.getTypeCompte() == TypeCompteTresorerie.BANQUE
                && trimToNull(request.getNomBanque()) == null) {
            throw new BadRequestException("Le nom de la banque est obligatoire pour un compte bancaire");
        }
        account.setCode(code);
        account.setLibelle(request.getLibelle().trim());
        account.setTypeCompte(request.getTypeCompte());
        account.setNomBanque(trimToNull(request.getNomBanque()));
        account.setRib(trimToNull(request.getRib()));
        account.setDevise("MAD");
        account.setSoldeInitial(money(request.getSoldeInitial()));
        account.setActif(request.getActif() == null || request.getActif());
        if (account.getTypeCompte() == TypeCompteTresorerie.CAISSE) {
            account.setNomBanque(null);
            account.setRib(null);
        }
        return account;
    }

    private CompteTresorerieResponse toResponse(CompteTresorerie account) {
        BigDecimal movements = money(mouvementRepository.balanceForAccount(account.getId()));
        return CompteTresorerieResponse.builder()
                .id(account.getId())
                .code(account.getCode())
                .libelle(account.getLibelle())
                .typeCompte(account.getTypeCompte())
                .nomBanque(account.getNomBanque())
                .rib(account.getRib())
                .devise(account.getDevise())
                .soldeInitial(money(account.getSoldeInitial()))
                .soldeCourant(money(account.getSoldeInitial()).add(movements))
                .actif(account.getActif())
                .build();
    }

    private MouvementTresorerieResponse toResponse(MouvementTresorerie movement) {
        return MouvementTresorerieResponse.builder()
                .id(movement.getId())
                .compteTresorerieId(movement.getCompteTresorerie().getId())
                .compteTresorerie(movement.getCompteTresorerie().getLibelle())
                .instrumentReglementId(movement.getInstrumentReglement() == null
                        ? null : movement.getInstrumentReglement().getId())
                .instrumentReglementCompagnieId(movement.getInstrumentReglementCompagnie() == null
                        ? null : movement.getInstrumentReglementCompagnie().getId())
                .nature(movement.getNature())
                .sens(movement.getSens())
                .dateOperation(movement.getDateOperation())
                .dateValeur(movement.getDateValeur())
                .montant(movement.getMontant())
                .reference(movement.getReference())
                .libelle(movement.getLibelle())
                .build();
    }

    private BigDecimal money(BigDecimal value) {
        return (value == null ? BigDecimal.ZERO : value).setScale(2, RoundingMode.HALF_UP);
    }

    private String normalizeCode(String value) {
        return value.trim().toUpperCase(java.util.Locale.ROOT).replaceAll("\\s+", "_");
    }

    private String trimToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
