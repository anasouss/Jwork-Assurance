package com.assurance.service;

import com.assurance.dto.request.UpsertBanqueRequest;
import com.assurance.dto.response.BanqueResponse;
import com.assurance.entity.Agence;
import com.assurance.entity.Banque;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.AgenceRepository;
import com.assurance.repository.BanqueRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class BanqueService {

    private static final List<DefaultBank> DEFAULT_BANKS = List.of(
            new DefaultBank("ATTIJARIWAFA_BANK", "Attijariwafa bank", List.of("AWB", "Attijari"), 10),
            new DefaultBank("BANQUE_POPULAIRE", "Banque Populaire", List.of("BP", "BCP", "CPM"), 20),
            new DefaultBank("BANK_OF_AFRICA", "BANK OF AFRICA", List.of("BOA", "BMCE"), 30),
            new DefaultBank("CREDIT_AGRICOLE_MAROC", "Crédit Agricole du Maroc", List.of("CAM"), 40),
            new DefaultBank("BMCI", "BMCI", List.of("Banque Marocaine pour le Commerce et l'Industrie"), 50),
            new DefaultBank("CIH_BANK", "CIH BANK", List.of("CIH"), 60),
            new DefaultBank("CREDIT_DU_MAROC", "Crédit du Maroc", List.of("CDM"), 70),
            new DefaultBank("SAHAM_BANK", "Saham Bank", List.of("Société Générale Maroc", "SGMA", "SGMB"), 80),
            new DefaultBank("AL_BARID_BANK", "Al Barid Bank", List.of("ABB", "Barid Bank"), 90),
            new DefaultBank("CFG_BANK", "CFG Bank", List.of("CFG"), 100),
            new DefaultBank("BANK_ASSAFA", "Bank Assafa", List.of("Assafa"), 110),
            new DefaultBank("UMNIA_BANK", "Umnia Bank", List.of("Umnia"), 120),
            new DefaultBank("BANK_AL_YOUSR", "Bank Al Yousr", List.of("Al Yousr"), 130),
            new DefaultBank("AL_AKHDAR_BANK", "Al Akhdar Bank", List.of("Al Akhdar"), 140),
            new DefaultBank("BTI_BANK", "BTI Bank", List.of("BTI"), 150),
            new DefaultBank("ARAB_BANK", "Arab Bank Maroc", List.of("Arab Bank"), 160),
            new DefaultBank("CITIBANK_MAGHREB", "Citibank Maghreb", List.of("Citi", "Citibank"), 170),
            new DefaultBank("CAIXABANK", "CaixaBank", List.of("Caixa"), 180),
            new DefaultBank("BANCO_SABADELL", "Banco Sabadell", List.of("Sabadell"), 190)
    );

    private final BanqueRepository banqueRepository;
    private final AgenceRepository agenceRepository;

    @Transactional
    public List<BanqueResponse> list(Long agenceId, boolean includeInactive) {
        ensureDefaults(agenceId);
        return banqueRepository.findByAgenceIdOrderByOrdreAscLibelleAsc(agenceId).stream()
                .filter(bank -> includeInactive || Boolean.TRUE.equals(bank.getActif()))
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public BanqueResponse create(Long agenceId, UpsertBanqueRequest request) {
        Agence agence = agenceRepository.findById(agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Agence", agenceId));
        String code = normalizeCode(request.getCode());
        if (banqueRepository.findByAgenceIdAndCodeIgnoreCase(agenceId, code).isPresent()) {
            throw new BadRequestException("Une banque utilise déjà ce code");
        }
        Banque bank = Banque.builder()
                .agence(agence)
                .code(code)
                .libelle(request.getLibelle().trim())
                .aliases(normalizeAliases(request.getAliases()))
                .actif(request.getActif() == null || request.getActif())
                .ordre(safeOrder(request.getOrdre()))
                .build();
        return toResponse(banqueRepository.save(bank));
    }

    @Transactional
    public BanqueResponse update(Long agenceId, Long bankId, UpsertBanqueRequest request) {
        Banque bank = get(agenceId, bankId);
        String code = normalizeCode(request.getCode());
        if (banqueRepository.existsByAgenceIdAndCodeIgnoreCaseAndIdNot(agenceId, code, bankId)) {
            throw new BadRequestException("Une banque utilise déjà ce code");
        }
        bank.setCode(code);
        bank.setLibelle(request.getLibelle().trim());
        bank.setAliases(normalizeAliases(request.getAliases()));
        bank.setActif(request.getActif() == null || request.getActif());
        bank.setOrdre(safeOrder(request.getOrdre()));
        return toResponse(banqueRepository.save(bank));
    }

    @Transactional(readOnly = true)
    public Banque requireActive(Long agenceId, Long bankId) {
        Banque bank = get(agenceId, bankId);
        if (!Boolean.TRUE.equals(bank.getActif())) {
            throw new BadRequestException("La banque sélectionnée est inactive");
        }
        return bank;
    }

    private Banque get(Long agenceId, Long bankId) {
        return banqueRepository.findByAgenceIdAndId(agenceId, bankId)
                .orElseThrow(() -> new ResourceNotFoundException("Banque", bankId));
    }

    private void ensureDefaults(Long agenceId) {
        Agence agence = agenceRepository.findById(agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Agence", agenceId));
        for (DefaultBank value : DEFAULT_BANKS) {
            if (banqueRepository.findByAgenceIdAndCodeIgnoreCase(agenceId, value.code()).isEmpty()) {
                banqueRepository.save(Banque.builder()
                        .agence(agence)
                        .code(value.code())
                        .libelle(value.label())
                        .aliases(new LinkedHashSet<>(value.aliases()))
                        .actif(true)
                        .ordre(value.order())
                        .build());
            }
        }
    }

    private Set<String> normalizeAliases(List<String> aliases) {
        LinkedHashSet<String> result = new LinkedHashSet<>();
        if (aliases == null) {
            return result;
        }
        aliases.stream()
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .forEach(value -> {
                    boolean duplicate = result.stream().anyMatch(existing ->
                            existing.equalsIgnoreCase(value));
                    if (!duplicate) {
                        result.add(value);
                    }
                });
        return result;
    }

    private String normalizeCode(String value) {
        String normalized = Normalizer.normalize(value.trim(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toUpperCase(Locale.ROOT)
                .replaceAll("[^A-Z0-9]+", "_")
                .replaceAll("^_+|_+$", "");
        if (normalized.isBlank()) {
            throw new BadRequestException("Le code de la banque est invalide");
        }
        return normalized;
    }

    private int safeOrder(Integer value) {
        return value == null ? 100 : Math.max(value, 0);
    }

    private BanqueResponse toResponse(Banque bank) {
        return BanqueResponse.builder()
                .id(bank.getId())
                .code(bank.getCode())
                .libelle(bank.getLibelle())
                .aliases(bank.getAliases().stream().sorted().toList())
                .actif(bank.getActif())
                .ordre(bank.getOrdre())
                .build();
    }

    private record DefaultBank(String code, String label, List<String> aliases, int order) {
    }
}
