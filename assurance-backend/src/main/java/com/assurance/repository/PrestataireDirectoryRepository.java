package com.assurance.repository;

import com.assurance.enums.TypePrestataireSinistre;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Repository
@RequiredArgsConstructor
public class PrestataireDirectoryRepository {
    private final EntityManager entityManager;

    public record ProviderKey(TypePrestataireSinistre type, Long id) {
    }

    public record Filter(Long agenceId, boolean includeInactive, String search, Long villeId,
                         Long compagnieId, Long brancheId, Long domaineId) {
    }

    public Page<ProviderKey> search(Filter filter, Pageable pageable) {
        var parameters = new LinkedHashMap<String, Object>();
        parameters.put("agency", filter.agenceId());
        String union = select("garages_sinistre", "raison_sociale", "'GARAGE'", "garage_id",
                "garages_sinistre_domaines", "garages_sinistre_specialites", filter, parameters)
                + " UNION ALL " + select("experts_sinistre", "nom", "'EXPERT'", "expert_id",
                "experts_sinistre_domaines", "experts_sinistre_specialites", filter, parameters)
                + " UNION ALL " + select("prestataires_medicaux_sinistre", "nom", "p.type_prestataire", "prestataire_medical_id",
                "prestataires_medicaux_domaines", "prestataires_medicaux_specialites", filter, parameters);
        Query count = entityManager.createNativeQuery("SELECT COUNT(*) FROM (" + union + ") directory");
        parameters.forEach(count::setParameter);
        long total = ((Number) count.getSingleResult()).longValue();
        Query rows = entityManager.createNativeQuery("SELECT provider_id, provider_type FROM (" + union
                + ") directory ORDER BY provider_name, provider_type, provider_id");
        parameters.forEach(rows::setParameter);
        rows.setFirstResult(Math.toIntExact(pageable.getOffset()));
        rows.setMaxResults(pageable.getPageSize());
        @SuppressWarnings("unchecked")
        List<Object[]> records = rows.getResultList();
        var keys = records.stream().map(row -> new ProviderKey(TypePrestataireSinistre.valueOf((String) row[1]),
                ((Number) row[0]).longValue())).toList();
        return new PageImpl<>(keys, pageable, total);
    }

    // Identifiers are internal constants; every user-supplied value is a bound parameter.
    private String select(String table, String name, String type, String agreementOwner, String domainTable,
                          String specialtyTable, Filter filter, Map<String, Object> parameters) {
        String providerOwner = table.equals("prestataires_medicaux_sinistre") ? "prestataire_id" : agreementOwner;
        var sql = new StringBuilder("SELECT p.id AS provider_id, ").append(type)
                .append(" AS provider_type, p.").append(name).append(" AS provider_name FROM ")
                .append(table).append(" p WHERE p.agence_id = :agency");
        if (!filter.includeInactive()) sql.append(" AND p.actif = true");
        if (filter.villeId() != null) {
            sql.append(" AND p.ville_id = :city");
            parameters.put("city", filter.villeId());
        }
        if (filter.compagnieId() != null) {
            sql.append(" AND (p.toutes_compagnies = true OR EXISTS (SELECT 1 FROM accords_prestataires_sinistre a WHERE a.")
                    .append(agreementOwner).append(" = p.id AND a.agence_id = :agency AND a.compagnie_id = :company")
                    .append(" AND a.actif = true AND (a.date_debut IS NULL OR a.date_debut <= :today)")
                    .append(" AND (a.date_fin IS NULL OR a.date_fin >= :today)))");
            parameters.put("company", filter.compagnieId());
            parameters.put("today", LocalDate.now());
        }
        if (filter.domaineId() != null) {
            sql.append(" AND EXISTS (SELECT 1 FROM domaines_intervention_sinistre d JOIN domaines_intervention_operateurs op")
                    .append(" ON op.domaine_id = d.id WHERE d.id = :domain AND d.agence_id = :agency AND op.type_prestataire = ")
                    .append(type).append(") AND (EXISTS (SELECT 1 FROM ").append(domainTable).append(" pd WHERE pd.")
                    .append(providerOwner).append(" = p.id AND pd.domaine_id = :domain)")
                    .append(" OR EXISTS (SELECT 1 FROM ").append(specialtyTable).append(" ps JOIN specialites_prestataires_sinistre s")
                    .append(" ON s.id = ps.specialite_id JOIN specialites_prestataires_domaines sd ON sd.specialite_id = s.id")
                    .append(" WHERE ps.").append(providerOwner).append(" = p.id AND s.agence_id = :agency AND s.actif = true")
                    .append(" AND sd.domaine_id = :domain))");
            parameters.put("domain", filter.domaineId());
        }
        if (filter.brancheId() != null) {
            sql.append(" AND EXISTS (SELECT 1 FROM ").append(specialtyTable).append(" ps JOIN specialites_prestataires_sinistre s")
                    .append(" ON s.id = ps.specialite_id JOIN specialites_prestataires_garanties sg ON sg.specialite_id = s.id")
                    .append(" JOIN garanties g ON g.id = sg.garantie_id WHERE ps.").append(providerOwner)
                    .append(" = p.id AND s.agence_id = :agency AND s.actif = true AND g.actif = true AND g.branche_assurance_id = :branch)");
            parameters.put("branch", filter.brancheId());
        }
        if (filter.search() != null && !filter.search().isBlank()) {
            sql.append(" AND (LOWER(p.code) LIKE :search ESCAPE '!' OR LOWER(p.").append(name)
                    .append(") LIKE :search ESCAPE '!' OR LOWER(p.telephone) LIKE :search ESCAPE '!' OR LOWER(p.email) LIKE :search ESCAPE '!')");
            parameters.put("search", "%" + filter.search().trim().toLowerCase(Locale.ROOT)
                    .replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%");
        }
        return sql.toString();
    }
}
