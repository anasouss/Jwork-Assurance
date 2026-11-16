package com.assurance.service;

import com.assurance.activity.*;
import com.assurance.dto.request.ConfigurationPrestataireRequest;
import com.assurance.dto.request.UpsertSpecialitePrestataireRequest;
import com.assurance.dto.response.SpecialitePrestataireResponse;
import com.assurance.entity.*;
import com.assurance.enums.ModeReparationSinistre;
import com.assurance.enums.TypePrestataireSinistre;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PrestataireSinistreService {
    private final SpecialitePrestataireSinistreRepository specialiteRepository;
    private final GarantieRepository garantieRepository;
    private final BrancheAssuranceRepository brancheRepository;
    private final CompagnieAssuranceRepository compagnieRepository;
    private final AgenceRepository agenceRepository;
    private final ExpertSinistreRepository expertRepository;
    private final GarageSinistreRepository garageRepository;
    private final PrestataireMedicalSinistreRepository medicalRepository;
    private final DomaineInterventionSinistreService domaines;
    private final SinistreRepository sinistreRepository;
    private final SinistreGarantieRepository sinistreGarantieRepository;
    private final SinistreCouvertureService couvertureService;
    private final BusinessActivityRecorder activityRecorder;

    @Transactional(readOnly = true)
    public Map<String, List<SpecialitePrestataireResponse.Reference>> options() {
        return Map.of("compagnies", compagnieRepository.findAll(org.springframework.data.domain.Sort.by("nom")).stream()
                        .map(c -> new SpecialitePrestataireResponse.Reference(c.getId(), c.getNom())).toList(),
                "branches", brancheRepository.findAll(org.springframework.data.domain.Sort.by("libelle")).stream()
                        .filter(b -> Boolean.TRUE.equals(b.getActif()))
                        .map(b -> new SpecialitePrestataireResponse.Reference(b.getId(), b.getLibelle())).toList(),
                "garanties", garantieRepository.findAll(org.springframework.data.domain.Sort.by("code")).stream()
                        .map(g -> new SpecialitePrestataireResponse.Reference(g.getId(), g.getCode() + " · " + g.getLibelle())).toList());
    }

    @Transactional(readOnly = true)
    public List<SpecialitePrestataireResponse> specialites(Long agenceId) {
        return specialiteRepository.findByAgenceIdOrderByLibelleAsc(agenceId).stream().map(this::specialiteResponse).toList();
    }

    @Transactional
    public SpecialitePrestataireResponse saveSpecialite(Long agenceId, Long id, UpsertSpecialitePrestataireRequest request) {
        String code = request.getCode().trim().toUpperCase(Locale.ROOT);
        if (specialiteRepository.existsByAgenceIdAndCodeIgnoreCaseAndIdNot(agenceId, code, id == null ? 0L : id)) {
            throw new BadRequestException("Ce code spécialité existe déjà dans l'agence");
        }
        SpecialitePrestataireSinistre item = id == null ? SpecialitePrestataireSinistre.builder()
                .agence(agenceRepository.getReferenceById(agenceId)).build()
                : specialiteRepository.findByIdAndAgenceId(id, agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Spécialité", id));
        if (id != null && item.getTypePrestataire() != request.getTypePrestataire()
                && (expertRepository.existsBySpecialitesId(id) || garageRepository.existsBySpecialitesId(id) || medicalRepository.existsBySpecialitesId(id))) {
            throw new BadRequestException("Le type d'une spécialité déjà attribuée ne peut pas être modifié");
        }
        Set<Long> ids = new LinkedHashSet<>(request.getGarantieIds());
        List<Garantie> guarantees = garantieRepository.findAllById(ids);
        if (guarantees.size() != ids.size()) throw new BadRequestException("Une garantie est introuvable");
        Map<String, String> before = id == null ? Map.of() : specialtySnapshot(item);
        item.setCode(code);
        item.setLibelle(request.getLibelle().trim());
        item.setTypePrestataire(request.getTypePrestataire());
        item.setActif(request.isActif());
        item.getGaranties().clear();
        item.getGaranties().addAll(guarantees);
        domaines.configure(agenceId, request.getTypePrestataire(), item.getDomaines(), request.getDomaineIds());
        for (var domain : item.getDomaines()) {
            if (!domain.getOperateurs().contains(item.getTypePrestataire()) || guarantees.stream().noneMatch(g -> g.getBrancheAssurance() != null
                    && domain.getBrancheAssurance().getId().equals(g.getBrancheAssurance().getId()))) {
                throw new BadRequestException("Les garanties de la spécialité doivent couvrir la branche de chaque domaine sélectionné");
            }
        }
        item = specialiteRepository.save(item);
        activityRecorder.record(new ActivityCommand(agenceId, ActivityModule.SINISTRES,
                id == null ? ActivityAction.CREATED : ActivityAction.UPDATED,
                id == null ? "Spécialité prestataire créée" : "Spécialité prestataire modifiée", "CLAIM_PROVIDER_SPECIALTY",
                new ActivityReference(ActivityRecordType.REFERENTIEL, "SPECIALITE_PRESTATAIRE:" + item.getId(), item.getLibelle()),
                List.of(), ActivityValues.changes(before, specialtySnapshot(item))));
        return specialiteResponse(item);
    }

    private Map<String, String> specialtySnapshot(SpecialitePrestataireSinistre item) {
        return new ActivityValues().put("Code", item.getCode()).put("Libellé", item.getLibelle())
                .put("Type", item.getTypePrestataire()).put("Actif", item.isActif())
                .put("Garanties", item.getGaranties().stream().map(Garantie::getCode).sorted().collect(Collectors.joining(", ")))
                .put("Domaines", item.getDomaines().stream().map(DomaineInterventionSinistre::getLibelle).sorted().collect(Collectors.joining(", "))).snapshot();
    }

    public SpecialitePrestataireResponse specialiteResponse(SpecialitePrestataireSinistre item) {
        return new SpecialitePrestataireResponse(item.getId(), item.getCode(), item.getLibelle(), item.getTypePrestataire(), item.isActif(),
                item.getGaranties().stream().sorted(Comparator.comparing(Garantie::getCode))
                        .map(g -> new SpecialitePrestataireResponse.Reference(g.getId(), g.getCode() + " · " + g.getLibelle())).toList(),
                item.getGaranties().stream().map(Garantie::getBrancheAssurance).filter(Objects::nonNull)
                        .collect(Collectors.toMap(BaseEntity::getId, java.util.function.Function.identity(), (a, b) -> a))
                        .values().stream().sorted(Comparator.comparing(BrancheAssurance::getLibelle))
                        .map(b -> new SpecialitePrestataireResponse.Reference(b.getId(), b.getLibelle())).toList(),
                item.getDomaines().stream().sorted(Comparator.comparing(DomaineInterventionSinistre::getLibelle))
                        .map(d -> new SpecialitePrestataireResponse.Reference(d.getId(), d.getLibelle())).toList());
    }

    public void validateDirectorySpecialty(Long agenceId, TypePrestataireSinistre type, Long specialiteId, Long brancheId) {
        if (specialiteId == null) return;
        var specialty = specialiteRepository.findByIdAndAgenceId(specialiteId, agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Spécialité", specialiteId));
        if (specialty.getTypePrestataire() != type) throw new BadRequestException("Spécialité incompatible avec cet opérateur");
        if (brancheId != null && specialty.getGaranties().stream().noneMatch(g -> g.getBrancheAssurance() != null
                && brancheId.equals(g.getBrancheAssurance().getId()))) {
            throw new BadRequestException("La spécialité ne couvre pas la branche sélectionnée");
        }
    }

    public void configure(ExpertSinistre expert, ConfigurationPrestataireRequest request) {
        domaines.configure(expert.getAgence().getId(), TypePrestataireSinistre.EXPERT, expert.getDomaines(), request.getDomaineIds());
        configure(expert.getAgence(), TypePrestataireSinistre.EXPERT, expert.getSpecialites(), expert.getAccords(), request, expert, null, null);
        if (request.getToutesCompagnies() != null) expert.setToutesCompagnies(request.getToutesCompagnies());
        validateScope(expert.isToutesCompagnies(), expert.getAccords());
    }

    public void configure(GarageSinistre garage, ConfigurationPrestataireRequest request) {
        domaines.configure(garage.getAgence().getId(), TypePrestataireSinistre.GARAGE, garage.getDomaines(), request.getDomaineIds());
        configure(garage.getAgence(), TypePrestataireSinistre.GARAGE, garage.getSpecialites(), garage.getAccords(), request, null, garage, null);
        if (request.getToutesCompagnies() != null) garage.setToutesCompagnies(request.getToutesCompagnies());
        validateScope(garage.isToutesCompagnies(), garage.getAccords());
    }

    public void configure(PrestataireMedicalSinistre provider, ConfigurationPrestataireRequest request) {
        domaines.configure(provider.getAgence().getId(), provider.getTypePrestataire(), provider.getDomaines(), request.getDomaineIds());
        configure(provider.getAgence(), provider.getTypePrestataire(), provider.getSpecialites(), provider.getAccords(), request, null, null, provider);
        if (request.getToutesCompagnies() != null) provider.setToutesCompagnies(request.getToutesCompagnies());
        validateScope(provider.isToutesCompagnies(), provider.getAccords());
        if (provider.getDomaines().isEmpty() && provider.getSpecialites().stream().allMatch(s -> s.getDomaines().isEmpty())) {
            throw new BadRequestException("Sélectionnez au moins un domaine d'intervention");
        }
    }

    private void validateScope(boolean allCompanies, Set<AccordPrestataireSinistre> agreements) {
        if (!allCompanies && agreements.isEmpty()) throw new BadRequestException("Ajoutez au moins une compagnie autorisée");
    }

    private void configure(Agence agency, TypePrestataireSinistre type, Set<SpecialitePrestataireSinistre> specialties,
            Set<AccordPrestataireSinistre> agreements, ConfigurationPrestataireRequest request,
            ExpertSinistre expert, GarageSinistre garage, PrestataireMedicalSinistre medical) {
        if (request.getSpecialiteIds() != null) {
            Set<Long> ids = new HashSet<>(request.getSpecialiteIds());
            List<SpecialitePrestataireSinistre> resolved = specialiteRepository.findByAgenceIdOrderByLibelleAsc(agency.getId()).stream()
                    .filter(s -> ids.contains(s.getId()) && s.getTypePrestataire() == type).toList();
            if (resolved.size() != ids.size()) throw new BadRequestException("Une spécialité est incompatible ou appartient à une autre agence");
            Set<Long> existing = specialties.stream().map(BaseEntity::getId).collect(Collectors.toSet());
            if (resolved.stream().anyMatch(s -> !s.isActif() && !existing.contains(s.getId()))) {
                throw new BadRequestException("Une spécialité sélectionnée est inactive");
            }
            specialties.clear();
            specialties.addAll(resolved);
        }
        if (request.getAccords() == null) return;
        Set<Long> companies = new HashSet<>();
        for (var row : request.getAccords()) {
            if (!companies.add(row.getCompagnieId())) throw new BadRequestException("Une compagnie ne peut apparaître qu'une seule fois");
            if (row.getDateDebut() != null && row.getDateFin() != null && row.getDateDebut().isAfter(row.getDateFin())) {
                throw new BadRequestException("La fin de l'accord ne peut pas précéder son début");
            }
            CompagnieAssurance company = compagnieRepository.findById(row.getCompagnieId())
                    .orElseThrow(() -> new ResourceNotFoundException("Compagnie", row.getCompagnieId()));
            AccordPrestataireSinistre agreement = agreements.stream().filter(a -> a.getCompagnie().getId().equals(company.getId()))
                    .findFirst().orElseGet(() -> {
                        var created = AccordPrestataireSinistre.builder().agence(agency).expert(expert).garage(garage).prestataireMedical(medical).compagnie(company).build();
                        agreements.add(created);
                        return created;
                    });
            agreement.setActif(row.isActif());
            agreement.setConventionne(row.isConventionne());
            agreement.setDateDebut(row.getDateDebut());
            agreement.setDateFin(row.getDateFin());
        }
        agreements.removeIf(a -> !companies.contains(a.getCompagnie().getId()));
    }

    public record Eligibility(Long agenceId, Long compagnieId, Set<Long> garantieIds,
            LocalDate dateIntervention, ModeReparationSinistre modeReparation) {
    }

    public Eligibility context(Long agenceId, Long sinistreId, Long contratId, Long vehiculeId, LocalDate dateSinistre,
            Set<Long> garantieIds, LocalDate dateIntervention, ModeReparationSinistre mode) {
        if (sinistreId != null) {
            Sinistre claim = sinistreRepository.findByIdAndAgenceId(sinistreId, agenceId)
                    .orElseThrow(() -> new ResourceNotFoundException("Sinistre", sinistreId));
            return context(claim, dateIntervention, mode == null ? claim.getModeReparation() : mode);
        }
        if (contratId == null || dateSinistre == null) throw new BadRequestException("Le contrat et la date du sinistre sont obligatoires");
        var coverage = couvertureService.resolve(agenceId, contratId, vehiculeId, dateSinistre);
        Set<Long> selected = garantieIds == null ? Set.of() : garantieIds;
        Set<Long> covered = coverage.garanties().stream().map(g -> g.getGarantie().getId()).collect(Collectors.toSet());
        if (!covered.containsAll(selected)) throw new BadRequestException("Une garantie ne couvre pas le risque sélectionné");
        return new Eligibility(agenceId, coverage.contrat().getCompagnieAssurance() == null ? null
                : coverage.contrat().getCompagnieAssurance().getId(), selected,
                dateIntervention == null ? LocalDate.now() : dateIntervention, mode);
    }

    private Eligibility context(Sinistre claim, LocalDate date, ModeReparationSinistre mode) {
        Set<Long> ids = sinistreGarantieRepository.findForDetailOrderByConfiguredDisplay(claim.getId()).stream()
                .filter(SinistreGarantie::isImpliquee).map(g -> g.getGarantie().getId()).collect(Collectors.toSet());
        return new Eligibility(claim.getAgence().getId(), claim.getCompagnieAssurance() == null ? null
                : claim.getCompagnieAssurance().getId(), ids, date == null ? LocalDate.now() : date, mode);
    }

    private Set<Long> requiredGuarantees(Eligibility context, TypePrestataireSinistre type) {
        return specialiteRepository.findByAgenceIdOrderByLibelleAsc(context.agenceId()).stream()
                .filter(s -> s.isActif() && s.getTypePrestataire() == type).flatMap(s -> s.getGaranties().stream())
                .map(BaseEntity::getId).filter(context.garantieIds()::contains).collect(Collectors.toSet());
    }

    public boolean approved(Set<AccordPrestataireSinistre> agreements, Eligibility context) {
        return agreements.stream().anyMatch(a -> activeAgreement(a, context) && a.isConventionne());
    }

    private boolean activeAgreement(AccordPrestataireSinistre agreement, Eligibility context) {
        return Objects.equals(agreement.getAgence().getId(), context.agenceId()) && agreement.isActif()
                && Objects.equals(agreement.getCompagnie().getId(), context.compagnieId())
                && (agreement.getDateDebut() == null || !agreement.getDateDebut().isAfter(context.dateIntervention()))
                && (agreement.getDateFin() == null || !agreement.getDateFin().isBefore(context.dateIntervention()));
    }

    private boolean eligible(boolean allCompanies, Set<AccordPrestataireSinistre> agreements,
            Set<SpecialitePrestataireSinistre> specialties, Eligibility context, Set<Long> required) {
        if (!allCompanies && agreements.stream().noneMatch(a -> activeAgreement(a, context))) return false;
        Set<Long> covered = specialties.stream().filter(s -> s.isActif() && Objects.equals(s.getAgence().getId(), context.agenceId()))
                .flatMap(s -> s.getGaranties().stream()).map(BaseEntity::getId).collect(Collectors.toSet());
        return covered.containsAll(required);
    }

    public List<ExpertSinistre> eligibleExperts(Eligibility context) {
        Set<Long> required = requiredGuarantees(context, TypePrestataireSinistre.EXPERT);
        List<ExpertSinistre> experts = expertRepository.findByAgenceIdAndActifTrueOrderByNomAsc(context.agenceId());
        return experts.stream().filter(e -> eligible(e.isToutesCompagnies(), e.getAccords(), e.getSpecialites(), context, required)).toList();
    }

    public List<GarageSinistre> eligibleGarages(Eligibility context) {
        Set<Long> required = requiredGuarantees(context, TypePrestataireSinistre.GARAGE);
        return garageRepository.findByAgenceIdAndActifTrueOrderByRaisonSocialeAsc(context.agenceId()).stream()
                .filter(g -> eligible(g.isToutesCompagnies(), g.getAccords(), g.getSpecialites(), context, required))
                .filter(g -> context.modeReparation() != ModeReparationSinistre.PEC || approved(g.getAccords(), context)).toList();
    }

    public void assertGarage(Sinistre claim, GarageSinistre garage, ModeReparationSinistre mode, LocalDate date) {
        Eligibility context = context(claim, date, mode);
        if (!Objects.equals(garage.getAgence().getId(), context.agenceId()) || !garage.isActif()
                || !eligible(garage.isToutesCompagnies(), garage.getAccords(), garage.getSpecialites(), context,
                        requiredGuarantees(context, TypePrestataireSinistre.GARAGE))) {
            throw new BadRequestException("Ce garage n'est pas compatible avec la compagnie et les garanties du sinistre");
        }
        if (mode == ModeReparationSinistre.PEC && !approved(garage.getAccords(), context)) {
            throw new BadRequestException("La PEC exige un accord conventionné actif avec la compagnie du sinistre");
        }
    }

    public void assertExpert(Sinistre claim, ExpertSinistre expert, LocalDate date) {
        Eligibility context = context(claim, date, claim.getModeReparation());
        if (!Objects.equals(expert.getAgence().getId(), context.agenceId()) || !expert.isActif()
                || !eligible(expert.isToutesCompagnies(), expert.getAccords(), expert.getSpecialites(), context,
                        requiredGuarantees(context, TypePrestataireSinistre.EXPERT))) {
            throw new BadRequestException("Cet expert n'est pas compatible avec la compagnie et les garanties du sinistre");
        }
    }
}
