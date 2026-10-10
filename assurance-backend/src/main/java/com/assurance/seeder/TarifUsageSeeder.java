package com.assurance.seeder;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.stream.Collectors;

@Component
@Order(3)
@RequiredArgsConstructor
public class TarifUsageSeeder implements CommandLineRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    @Transactional
    public void run(String... args) {
        Integer existingRows = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM tarifs_usage", Integer.class);
        if (existingRows != null && existingRows > 0) {
            return;
        }

        boolean temporaryLegacyFuelColumn = !columnExists("tarifs_usage", "carburant_id");
        if (temporaryLegacyFuelColumn) {
            jdbcTemplate.execute("ALTER TABLE tarifs_usage ADD COLUMN carburant_id BIGINT NULL");
        }

        String sql = readBundledSql("data/tarifs_usage.sql");
        if (sql == null || sql.isBlank()) {
            return;
        }

        String executableSql = sql.lines()
                .filter(line -> !line.trim().startsWith("--"))
                .collect(Collectors.joining("\n"));

        Arrays.stream(executableSql.split(";"))
                .map(String::trim)
                .filter(statement -> !statement.isBlank())
                .forEach(jdbcTemplate::execute);

        jdbcTemplate.update("""
                INSERT IGNORE INTO tarif_usage_carburants (tarif_usage_id, carburant_id)
                SELECT id, carburant_id
                FROM tarifs_usage
                WHERE carburant_id IS NOT NULL
                """);
        jdbcTemplate.update("""
                INSERT IGNORE INTO tarif_usage_carburants (tarif_usage_id, carburant_id)
                SELECT lien.tarif_usage_id, hybride.id
                FROM tarif_usage_carburants lien
                JOIN carburants source_carburant ON source_carburant.id = lien.carburant_id
                JOIN carburants hybride
                  ON hybride.code = CASE source_carburant.code
                      WHEN 'DIESEL' THEN 'HYBRIDE_D'
                      WHEN 'ESSENCE' THEN 'HYBRIDE_E'
                      ELSE NULL
                  END
                WHERE source_carburant.code IN ('DIESEL', 'ESSENCE')
                """);
        if (temporaryLegacyFuelColumn) {
            jdbcTemplate.execute("ALTER TABLE tarifs_usage DROP COLUMN carburant_id");
        }
    }

    private boolean columnExists(String tableName, String columnName) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM information_schema.columns
                WHERE table_schema = DATABASE()
                  AND table_name = ?
                  AND column_name = ?
                """, Integer.class, tableName, columnName);
        return count != null && count > 0;
    }

    private String readBundledSql(String path) {
        ClassPathResource resource = new ClassPathResource(path);
        if (!resource.exists()) {
            return null;
        }
        try (InputStream inputStream = resource.getInputStream()) {
            return new String(inputStream.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException ignored) {
            return null;
        }
    }
}
