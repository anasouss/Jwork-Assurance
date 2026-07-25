package com.assurance.seeder;

import com.assurance.entity.Ville;
import com.assurance.repository.VilleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
@Order(0)
@RequiredArgsConstructor
public class VilleSeeder implements CommandLineRunner {

    private static final Pattern VILLE_INSERT_VALUE = Pattern.compile("\\(\\s*\\d+\\s*,\\s*'((?:\\\\'|[^'])*)'\\s*\\)");
    private static final Set<String> VILLES_SAHARIENNES = Set.of(
            "TARFAYA",
            "LAAYOUNE",
            "ES-SEMARA",
            "BOUJDOUR",
            "DAKHLA"
    );

    private final VilleRepository villeRepository;

    @Value("${app.seed.villes-sql:}")
    private String villesSqlPath;

    @Override
    @Transactional
    public void run(String... args) {
        if (villeRepository.count() > 0) {
            return;
        }
        if (!seedFromSql()) {
            seedFallbackVilles();
        }
    }

    private boolean seedFromSql() {
        String sql = readBundledSql();
        if (sql == null) {
            sql = readConfiguredSql();
        }
        if (sql == null) {
            return false;
        }

        int seeded = 0;
        Matcher matcher = VILLE_INSERT_VALUE.matcher(sql);
        while (matcher.find()) {
            String nom = matcher.group(1).replace("\\'", "'").trim();
            if (!nom.isBlank()) {
                seedVille(nom, isSaharienne(nom));
                seeded++;
            }
        }
        return seeded > 0;
    }

    private String readBundledSql() {
        ClassPathResource resource = new ClassPathResource("data/villes.sql");
        if (!resource.exists()) {
            return null;
        }
        try (InputStream inputStream = resource.getInputStream()) {
            return new String(inputStream.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException ignored) {
            return null;
        }
    }

    private String readConfiguredSql() {
        for (Path path : sqlPathCandidates()) {
            if (!Files.isRegularFile(path)) {
                continue;
            }
            try {
                return Files.readString(path, StandardCharsets.UTF_8);
            } catch (IOException ignored) {
                continue;
            }
        }
        return null;
    }

    private List<Path> sqlPathCandidates() {
        if (villesSqlPath == null || villesSqlPath.isBlank()) {
            return List.of();
        }
        return List.of(Paths.get(villesSqlPath));
    }

    private void seedFallbackVilles() {
        List.of("Casablanca", "Rabat", "Marrakech", "Tanger", "Fes")
                .forEach(nom -> seedVille(nom, false));
        VILLES_SAHARIENNES.forEach(nom -> seedVille(nom, true));
    }

    private boolean isSaharienne(String nom) {
        return VILLES_SAHARIENNES.contains(nom.trim().toUpperCase(Locale.ROOT));
    }

    private Ville seedVille(String nom, boolean saharienne) {
        Ville ville = villeRepository.findByNomIgnoreCase(nom).orElseGet(() ->
                villeRepository.save(Ville.builder()
                        .nom(nom)
                        .saharienne(saharienne)
                        .build())
        );
        if (!Objects.equals(ville.getSaharienne(), saharienne)) {
            ville.setSaharienne(saharienne);
            return villeRepository.save(ville);
        }
        return ville;
    }
}
