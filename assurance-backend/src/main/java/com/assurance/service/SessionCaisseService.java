package com.assurance.service;

import com.assurance.dto.request.CloturerSessionCaisseRequest;
import com.assurance.dto.request.OuvrirSessionCaisseRequest;
import com.assurance.dto.response.SessionCaisseResponse;
import com.assurance.entity.AffectationCompteTresorerie;
import com.assurance.entity.CompteTresorerie;
import com.assurance.entity.SessionCaisse;
import com.assurance.entity.Utilisateur;
import com.assurance.enums.NiveauAccesCompteTresorerie;
import com.assurance.enums.StatutSessionCaisse;
import com.assurance.enums.TypeCompteTresorerie;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.CompteTresorerieRepository;
import com.assurance.repository.MouvementTresorerieRepository;
import com.assurance.repository.SessionCaisseRepository;
import com.assurance.repository.UtilisateurRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class SessionCaisseService {

    private static final BigDecimal ZERO = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);

    private final SessionCaisseRepository sessionRepository;
    private final CompteTresorerieRepository compteRepository;
    private final MouvementTresorerieRepository mouvementRepository;
    private final UtilisateurRepository utilisateurRepository;
    private final TresorerieAccessService accessService;

    @Transactional(readOnly = true)
    public List<SessionCaisseResponse> list(Long agenceId) {
        List<Long> visibleIds = accessService.visibleAccounts(
                agenceId,
                accessService.currentUserId()
        ).stream().map(CompteTresorerie::getId).toList();
        return sessionRepository.findTop100ByAgenceIdOrderByOuverteLeDesc(agenceId).stream()
                .filter(session -> visibleIds.contains(session.getCompteTresorerie().getId()))
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public SessionCaisseResponse open(Long agenceId, OuvrirSessionCaisseRequest request) {
        CompteTresorerie account = requireCashAccount(agenceId, request.getCompteTresorerieId());
        AffectationCompteTresorerie access = accessService.requireAccess(
                agenceId,
                account.getId(),
                NiveauAccesCompteTresorerie.GESTION
        );
        sessionRepository.findFirstByAgenceIdAndCompteTresorerieIdAndStatut(
                agenceId,
                account.getId(),
                StatutSessionCaisse.OUVERTE
        ).ifPresent(existing -> {
            throw new BadRequestException("Cette caisse possède déjà une session ouverte");
        });

        BigDecimal theoretical = currentBalance(account);
        BigDecimal counted = money(request.getMontantCompte());
        BigDecimal discrepancy = counted.subtract(theoretical).setScale(2, RoundingMode.HALF_UP);
        requireSupervisorAndReasonForDiscrepancy(access, discrepancy, request.getNote(), "d'ouverture");
        Utilisateur user = utilisateurRepository.findById(accessService.currentUserId())
                .orElseThrow(() -> new AccessDeniedException("Utilisateur non authentifié"));
        SessionCaisse session = SessionCaisse.builder()
                .agence(account.getAgence())
                .compteTresorerie(account)
                .utilisateur(user)
                .statut(StatutSessionCaisse.OUVERTE)
                .ouverteLe(LocalDateTime.now())
                .soldeTheoriqueOuverture(theoretical)
                .montantOuverture(counted)
                .ecartOuverture(discrepancy)
                .noteOuverture(trimToNull(request.getNote()))
                .build();
        return toResponse(sessionRepository.save(session));
    }

    @Transactional
    public SessionCaisseResponse close(
            Long agenceId,
            Long sessionId,
            CloturerSessionCaisseRequest request
    ) {
        SessionCaisse session = sessionRepository.findByIdAndAgenceId(sessionId, agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Session de caisse", sessionId));
        if (session.getStatut() != StatutSessionCaisse.OUVERTE) {
            throw new BadRequestException("Cette session de caisse est déjà clôturée");
        }
        AffectationCompteTresorerie access = accessService.requireAccess(
                agenceId,
                session.getCompteTresorerie().getId(),
                NiveauAccesCompteTresorerie.GESTION
        );
        Long currentUserId = accessService.currentUserId();
        if (!session.getUtilisateur().getId().equals(currentUserId)
                && !access.getNiveauAcces().allows(NiveauAccesCompteTresorerie.SUPERVISION)) {
            throw new AccessDeniedException("Seul le caissier ou un superviseur peut clôturer cette session");
        }

        BigDecimal theoretical = money(session.getMontantOuverture())
                .add(money(mouvementRepository.netForSession(sessionId)))
                .setScale(2, RoundingMode.HALF_UP);
        BigDecimal counted = money(request.getMontantCompte());
        BigDecimal discrepancy = counted.subtract(theoretical).setScale(2, RoundingMode.HALF_UP);
        requireSupervisorAndReasonForDiscrepancy(access, discrepancy, request.getNote(), "de clôture");

        session.setStatut(StatutSessionCaisse.CLOTUREE);
        session.setFermeeLe(LocalDateTime.now());
        session.setSoldeTheoriqueCloture(theoretical);
        session.setMontantCompteCloture(counted);
        session.setEcartCloture(discrepancy);
        session.setNoteCloture(trimToNull(request.getNote()));
        return toResponse(sessionRepository.save(session));
    }

    @Transactional(readOnly = true)
    public SessionCaisse requireOpenSession(Long agenceId, CompteTresorerie account) {
        if (account.getTypeCompte() != TypeCompteTresorerie.CAISSE) {
            return null;
        }
        return sessionRepository.findFirstByAgenceIdAndCompteTresorerieIdAndUtilisateurIdAndStatut(
                agenceId,
                account.getId(),
                accessService.currentUserId(),
                StatutSessionCaisse.OUVERTE
        ).orElseThrow(() -> new BadRequestException(
                "Ouvrez votre session de caisse avant d'enregistrer cette opération"
        ));
    }

    @Transactional(readOnly = true)
    public boolean hasOpenSession(Long agenceId, Long accountId) {
        return sessionRepository.existsByAgenceIdAndCompteTresorerieIdAndStatut(
                agenceId,
                accountId,
                StatutSessionCaisse.OUVERTE
        );
    }

    private CompteTresorerie requireCashAccount(Long agenceId, Long accountId) {
        CompteTresorerie account = compteRepository.findByIdAndAgenceId(accountId, agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Compte de trésorerie", accountId));
        if (account.getTypeCompte() != TypeCompteTresorerie.CAISSE) {
            throw new BadRequestException("Une session ne peut être ouverte que sur une caisse");
        }
        if (!Boolean.TRUE.equals(account.getActif())) {
            throw new BadRequestException("Cette caisse est inactive");
        }
        return account;
    }

    private BigDecimal currentBalance(CompteTresorerie account) {
        return money(account.getSoldeInitial())
                .add(money(mouvementRepository.balanceForAccount(account.getId())))
                .setScale(2, RoundingMode.HALF_UP);
    }

    private void requireSupervisorAndReasonForDiscrepancy(
            AffectationCompteTresorerie access,
            BigDecimal discrepancy,
            String note,
            String label
    ) {
        if (discrepancy.compareTo(ZERO) == 0) {
            return;
        }
        if (!access.getNiveauAcces().allows(NiveauAccesCompteTresorerie.SUPERVISION)) {
            throw new BadRequestException("Un écart " + label + " doit être validé par un superviseur");
        }
        if (note == null || note.isBlank()) {
            throw new BadRequestException("Le motif de l'écart " + label + " est obligatoire");
        }
    }

    private SessionCaisseResponse toResponse(SessionCaisse session) {
        return SessionCaisseResponse.builder()
                .id(session.getId())
                .compteTresorerieId(session.getCompteTresorerie().getId())
                .compteTresorerie(session.getCompteTresorerie().getLibelle())
                .utilisateurId(session.getUtilisateur().getId())
                .utilisateur(session.getUtilisateur().getFullName())
                .statut(session.getStatut())
                .ouverteLe(session.getOuverteLe())
                .fermeeLe(session.getFermeeLe())
                .soldeTheoriqueOuverture(money(session.getSoldeTheoriqueOuverture()))
                .montantOuverture(money(session.getMontantOuverture()))
                .ecartOuverture(money(session.getEcartOuverture()))
                .soldeTheoriqueCloture(nullableMoney(session.getSoldeTheoriqueCloture()))
                .montantCompteCloture(nullableMoney(session.getMontantCompteCloture()))
                .ecartCloture(nullableMoney(session.getEcartCloture()))
                .noteOuverture(session.getNoteOuverture())
                .noteCloture(session.getNoteCloture())
                .build();
    }

    private BigDecimal money(BigDecimal value) {
        return value == null ? ZERO : value.setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal nullableMoney(BigDecimal value) {
        return value == null ? null : money(value);
    }

    private String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
