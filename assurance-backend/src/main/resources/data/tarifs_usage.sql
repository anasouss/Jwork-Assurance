-- Converted from the Skay `usage_tarifs` dump for our `tarifs_usage` entity.
-- Import through reference codes/labels, not old numeric ids, so it works with generated Long ids.
-- Old max bounds equal to 0 are converted to NULL/open-ended when the criterion is present.
-- Legacy usage-id mapping used here:
-- 1=A, 2=C1, 3=C2, 4=CYCLOS, 5=D1, 6=D2, 7=D3, 8=D4_SC1, 9=D4_SC2,
-- 10=D5_SC1, 11=D5_SC2, 12=D6_SC1, 13=D6_SC2, 14=D6_SC3, 15=D6_SC4,
-- 16=D8, 19=REMORQUE, 20=D11, 21=D12, 22=D10, 24=B1, 25=B2, 26=P, 27=F,
-- 28=TRS D'ECOLIERS.

INSERT INTO tarifs_usage (
    created_at,
    updated_at,
    usage_id,
    carburant_id,
    puissance_fiscale_min,
    puissance_fiscale_max,
    nombre_places_min,
    nombre_places_max,
    ptc_min,
    ptc_max,
    sous_classe_id,
    prime_nette,
    prime_par_place,
    actif
)
SELECT
    NOW(),
    NOW(),
    usage_ref.id,
    carburant_ref.id,
    src.puissance_fiscale_min,
    src.puissance_fiscale_max,
    src.nombre_places_min,
    src.nombre_places_max,
    src.ptc_min,
    src.ptc_max,
    sous_classe_ref.id,
    src.prime_nette,
    src.prime_par_place,
    src.actif
FROM (
    SELECT 1 AS skay_id, 'A' AS usage_code, 'Essence' AS carburant_libelle, 0 AS puissance_fiscale_min, 6 AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 1840 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 2 AS skay_id, 'A' AS usage_code, 'Essence' AS carburant_libelle, 7 AS puissance_fiscale_min, 8 AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 2238 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 3 AS skay_id, 'A' AS usage_code, 'Essence' AS carburant_libelle, 9 AS puissance_fiscale_min, 10 AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 2429 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 4 AS skay_id, 'A' AS usage_code, 'Diesel' AS carburant_libelle, 11 AS puissance_fiscale_min, NULL AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 3490 AS prime_nette, 0 AS prime_par_place, false AS actif
    UNION ALL
    SELECT 5 AS skay_id, 'A' AS usage_code, 'Essence' AS carburant_libelle, 11 AS puissance_fiscale_min, NULL AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 3490 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 6 AS skay_id, 'A' AS usage_code, 'Diesel' AS carburant_libelle, 0 AS puissance_fiscale_min, 4 AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 1840 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 7 AS skay_id, 'A' AS usage_code, 'Diesel' AS carburant_libelle, 5 AS puissance_fiscale_min, 5 AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 2238 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 8 AS skay_id, 'A' AS usage_code, 'Diesel' AS carburant_libelle, 6 AS puissance_fiscale_min, 7 AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 2429 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 9 AS skay_id, 'A' AS usage_code, 'Diesel' AS carburant_libelle, 8 AS puissance_fiscale_min, NULL AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 3490 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 10 AS skay_id, 'C1' AS usage_code, 'Essence' AS carburant_libelle, 0 AS puissance_fiscale_min, 7 AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 2704 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 11 AS skay_id, 'C1' AS usage_code, 'Essence' AS carburant_libelle, 8 AS puissance_fiscale_min, 10 AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 4146 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 12 AS skay_id, 'C1' AS usage_code, 'Essence' AS carburant_libelle, 11 AS puissance_fiscale_min, NULL AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 4172 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 13 AS skay_id, 'C1' AS usage_code, 'Diesel' AS carburant_libelle, 0 AS puissance_fiscale_min, 5 AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 2704 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 14 AS skay_id, 'C1' AS usage_code, 'Diesel' AS carburant_libelle, 6 AS puissance_fiscale_min, 7 AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 4146 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 15 AS skay_id, 'C1' AS usage_code, 'Diesel' AS carburant_libelle, 8 AS puissance_fiscale_min, NULL AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 4172 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 16 AS skay_id, 'C2' AS usage_code, NULL AS carburant_libelle, NULL AS puissance_fiscale_min, NULL AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, 0 AS ptc_min, 6 AS ptc_max, NULL AS sous_classe, 6133 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 17 AS skay_id, 'C2' AS usage_code, NULL AS carburant_libelle, NULL AS puissance_fiscale_min, NULL AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, 7 AS ptc_min, 12 AS ptc_max, NULL AS sous_classe, 6162 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 18 AS skay_id, 'C2' AS usage_code, NULL AS carburant_libelle, NULL AS puissance_fiscale_min, NULL AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, 13 AS ptc_min, 44 AS ptc_max, NULL AS sous_classe, 6775 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 19 AS skay_id, 'CYCLOS' AS usage_code, NULL AS carburant_libelle, NULL AS puissance_fiscale_min, NULL AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, 'SC1' AS sous_classe, 602 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 20 AS skay_id, 'CYCLOS' AS usage_code, NULL AS carburant_libelle, NULL AS puissance_fiscale_min, NULL AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, 'SC2' AS sous_classe, 1217 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 21 AS skay_id, 'CYCLOS' AS usage_code, NULL AS carburant_libelle, NULL AS puissance_fiscale_min, NULL AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, 'SC3' AS sous_classe, 1581 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 22 AS skay_id, 'CYCLOS' AS usage_code, NULL AS carburant_libelle, NULL AS puissance_fiscale_min, NULL AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, 'SC5' AS sous_classe, 2216 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 23 AS skay_id, 'CYCLOS' AS usage_code, NULL AS carburant_libelle, NULL AS puissance_fiscale_min, NULL AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, 'SC6' AS sous_classe, 1883 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 24 AS skay_id, 'D1' AS usage_code, 'Essence' AS carburant_libelle, 0 AS puissance_fiscale_min, 7 AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 5408 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 25 AS skay_id, 'D1' AS usage_code, 'Essence' AS carburant_libelle, 8 AS puissance_fiscale_min, 10 AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 8292 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 26 AS skay_id, 'D1' AS usage_code, 'Essence' AS carburant_libelle, 11 AS puissance_fiscale_min, NULL AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 8344 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 27 AS skay_id, 'D1' AS usage_code, 'Diesel' AS carburant_libelle, 0 AS puissance_fiscale_min, 5 AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 5408 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 28 AS skay_id, 'D1' AS usage_code, 'Diesel' AS carburant_libelle, 6 AS puissance_fiscale_min, 7 AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 8292 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 29 AS skay_id, 'D1' AS usage_code, 'Diesel' AS carburant_libelle, 8 AS puissance_fiscale_min, NULL AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 8344 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 30 AS skay_id, 'D2' AS usage_code, NULL AS carburant_libelle, NULL AS puissance_fiscale_min, NULL AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, 0 AS ptc_min, 6 AS ptc_max, NULL AS sous_classe, 12266 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 31 AS skay_id, 'D2' AS usage_code, NULL AS carburant_libelle, NULL AS puissance_fiscale_min, NULL AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, 7 AS ptc_min, 12 AS ptc_max, NULL AS sous_classe, 12324 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 32 AS skay_id, 'D2' AS usage_code, NULL AS carburant_libelle, NULL AS puissance_fiscale_min, NULL AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, 13 AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 13550 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 33 AS skay_id, 'D3' AS usage_code, 'Essence' AS carburant_libelle, 0 AS puissance_fiscale_min, 7 AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 1892.8 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 34 AS skay_id, 'D3' AS usage_code, 'Essence' AS carburant_libelle, 8 AS puissance_fiscale_min, 10 AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 2902.2 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 35 AS skay_id, 'D3' AS usage_code, 'Essence' AS carburant_libelle, 11 AS puissance_fiscale_min, NULL AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 2920.4 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 36 AS skay_id, 'D3' AS usage_code, 'Diesel' AS carburant_libelle, 0 AS puissance_fiscale_min, 5 AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 1892.8 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 37 AS skay_id, 'D3' AS usage_code, 'Diesel' AS carburant_libelle, 6 AS puissance_fiscale_min, 7 AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 2902.2 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 38 AS skay_id, 'D3' AS usage_code, 'Diesel' AS carburant_libelle, 8 AS puissance_fiscale_min, NULL AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 2920.4 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 39 AS skay_id, 'D4_SC1' AS usage_code, 'Essence' AS carburant_libelle, 0 AS puissance_fiscale_min, 7 AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 1892.8 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 40 AS skay_id, 'D4_SC1' AS usage_code, 'Essence' AS carburant_libelle, 8 AS puissance_fiscale_min, 10 AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 2902.2 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 41 AS skay_id, 'D4_SC1' AS usage_code, 'Essence' AS carburant_libelle, 11 AS puissance_fiscale_min, NULL AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 2920.4 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 42 AS skay_id, 'D4_SC1' AS usage_code, 'Diesel' AS carburant_libelle, 0 AS puissance_fiscale_min, 5 AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 1892.8 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 43 AS skay_id, 'D4_SC1' AS usage_code, 'Diesel' AS carburant_libelle, 6 AS puissance_fiscale_min, 7 AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 2902.2 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 44 AS skay_id, 'D4_SC1' AS usage_code, 'Diesel' AS carburant_libelle, 8 AS puissance_fiscale_min, NULL AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 2920.4 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 45 AS skay_id, 'D4_SC2' AS usage_code, NULL AS carburant_libelle, NULL AS puissance_fiscale_min, NULL AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, 0 AS ptc_min, 6 AS ptc_max, NULL AS sous_classe, 4293.1 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 46 AS skay_id, 'D4_SC2' AS usage_code, NULL AS carburant_libelle, NULL AS puissance_fiscale_min, NULL AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, 7 AS ptc_min, 12 AS ptc_max, NULL AS sous_classe, 4313.4 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 47 AS skay_id, 'D4_SC2' AS usage_code, NULL AS carburant_libelle, NULL AS puissance_fiscale_min, NULL AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, 13 AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 4742.5 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 48 AS skay_id, 'D5_SC1' AS usage_code, 'Essence' AS carburant_libelle, 0 AS puissance_fiscale_min, 7 AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 3515.2 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 49 AS skay_id, 'D5_SC1' AS usage_code, 'Essence' AS carburant_libelle, 8 AS puissance_fiscale_min, 10 AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 5389.8 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 50 AS skay_id, 'D5_SC1' AS usage_code, 'Essence' AS carburant_libelle, 11 AS puissance_fiscale_min, NULL AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 5423.6 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 51 AS skay_id, 'D5_SC1' AS usage_code, 'Diesel' AS carburant_libelle, 0 AS puissance_fiscale_min, 5 AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 3515.2 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 52 AS skay_id, 'D5_SC1' AS usage_code, 'Diesel' AS carburant_libelle, 6 AS puissance_fiscale_min, 7 AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 5389.8 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 53 AS skay_id, 'D5_SC1' AS usage_code, 'Diesel' AS carburant_libelle, 8 AS puissance_fiscale_min, NULL AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 5423.6 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 54 AS skay_id, 'D5_SC2' AS usage_code, NULL AS carburant_libelle, NULL AS puissance_fiscale_min, NULL AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, 0 AS ptc_min, 6 AS ptc_max, NULL AS sous_classe, 7972.9 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 55 AS skay_id, 'D5_SC2' AS usage_code, NULL AS carburant_libelle, NULL AS puissance_fiscale_min, NULL AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, 7 AS ptc_min, 12 AS ptc_max, NULL AS sous_classe, 8010.6 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 56 AS skay_id, 'D5_SC2' AS usage_code, NULL AS carburant_libelle, NULL AS puissance_fiscale_min, NULL AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, 13 AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 8807.5 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 57 AS skay_id, 'D6_SC1' AS usage_code, NULL AS carburant_libelle, NULL AS puissance_fiscale_min, NULL AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 2659.2 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 58 AS skay_id, 'D6_SC2' AS usage_code, 'Essence' AS carburant_libelle, 0 AS puissance_fiscale_min, 6 AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 2208 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 59 AS skay_id, 'D6_SC2' AS usage_code, 'Essence' AS carburant_libelle, 7 AS puissance_fiscale_min, 8 AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 2685.6 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 60 AS skay_id, 'D6_SC2' AS usage_code, 'Essence' AS carburant_libelle, 9 AS puissance_fiscale_min, 10 AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 2914.8 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 61 AS skay_id, 'D6_SC2' AS usage_code, 'Essence' AS carburant_libelle, 11 AS puissance_fiscale_min, NULL AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 4188 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 62 AS skay_id, 'D6_SC2' AS usage_code, 'Diesel' AS carburant_libelle, 0 AS puissance_fiscale_min, 4 AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 2208 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 63 AS skay_id, 'D6_SC2' AS usage_code, 'Diesel' AS carburant_libelle, 5 AS puissance_fiscale_min, 5 AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 2685.6 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 64 AS skay_id, 'D6_SC2' AS usage_code, 'Diesel' AS carburant_libelle, 6 AS puissance_fiscale_min, 7 AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 2914.8 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 65 AS skay_id, 'D6_SC2' AS usage_code, 'Diesel' AS carburant_libelle, 8 AS puissance_fiscale_min, NULL AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 4188 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 66 AS skay_id, 'D6_SC3' AS usage_code, 'Essence' AS carburant_libelle, 0 AS puissance_fiscale_min, 7 AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 3244.8 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 67 AS skay_id, 'D6_SC3' AS usage_code, 'Essence' AS carburant_libelle, 8 AS puissance_fiscale_min, 10 AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 4975.2 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 68 AS skay_id, 'D6_SC3' AS usage_code, 'Essence' AS carburant_libelle, 11 AS puissance_fiscale_min, NULL AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 5006.4 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 69 AS skay_id, 'D6_SC3' AS usage_code, 'Diesel' AS carburant_libelle, 0 AS puissance_fiscale_min, 5 AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 3244.8 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 70 AS skay_id, 'D6_SC3' AS usage_code, 'Diesel' AS carburant_libelle, 6 AS puissance_fiscale_min, 7 AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 4975.2 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 71 AS skay_id, 'D6_SC3' AS usage_code, 'Diesel' AS carburant_libelle, 8 AS puissance_fiscale_min, NULL AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 5006.4 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 72 AS skay_id, 'D6_SC4' AS usage_code, NULL AS carburant_libelle, NULL AS puissance_fiscale_min, NULL AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 7359.6 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 74 AS skay_id, 'D8' AS usage_code, NULL AS carburant_libelle, NULL AS puissance_fiscale_min, NULL AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 1412 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 75 AS skay_id, 'REMORQUE' AS usage_code, NULL AS carburant_libelle, NULL AS puissance_fiscale_min, NULL AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 872 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 76 AS skay_id, 'D11' AS usage_code, 'Essence' AS carburant_libelle, 0 AS puissance_fiscale_min, 7 AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 2704 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 77 AS skay_id, 'D11' AS usage_code, 'Essence' AS carburant_libelle, 8 AS puissance_fiscale_min, 10 AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 4146 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 78 AS skay_id, 'D11' AS usage_code, 'Essence' AS carburant_libelle, 11 AS puissance_fiscale_min, NULL AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 4172 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 79 AS skay_id, 'D11' AS usage_code, 'Diesel' AS carburant_libelle, 0 AS puissance_fiscale_min, 5 AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 2704 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 80 AS skay_id, 'D11' AS usage_code, 'Diesel' AS carburant_libelle, 6 AS puissance_fiscale_min, 7 AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 4146 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 81 AS skay_id, 'D11' AS usage_code, 'Diesel' AS carburant_libelle, 8 AS puissance_fiscale_min, NULL AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 4172 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 82 AS skay_id, 'D12' AS usage_code, NULL AS carburant_libelle, NULL AS puissance_fiscale_min, NULL AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, 0 AS ptc_min, 6 AS ptc_max, NULL AS sous_classe, 6133 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 83 AS skay_id, 'D12' AS usage_code, NULL AS carburant_libelle, NULL AS puissance_fiscale_min, NULL AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, 7 AS ptc_min, 12 AS ptc_max, NULL AS sous_classe, 6162 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 84 AS skay_id, 'D12' AS usage_code, NULL AS carburant_libelle, NULL AS puissance_fiscale_min, NULL AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, 13 AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 6775 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 85 AS skay_id, 'D10' AS usage_code, 'Essence' AS carburant_libelle, 0 AS puissance_fiscale_min, 7 AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 2704 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 86 AS skay_id, 'D10' AS usage_code, 'Essence' AS carburant_libelle, 8 AS puissance_fiscale_min, 10 AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 4146 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 87 AS skay_id, 'D10' AS usage_code, 'Essence' AS carburant_libelle, 11 AS puissance_fiscale_min, NULL AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 4172 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 88 AS skay_id, 'D10' AS usage_code, 'Diesel' AS carburant_libelle, 0 AS puissance_fiscale_min, 5 AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 2704 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 89 AS skay_id, 'D10' AS usage_code, 'Diesel' AS carburant_libelle, 6 AS puissance_fiscale_min, 7 AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 4146 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 90 AS skay_id, 'D10' AS usage_code, 'Diesel' AS carburant_libelle, 8 AS puissance_fiscale_min, NULL AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 4172 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 91 AS skay_id, 'B1' AS usage_code, NULL AS carburant_libelle, NULL AS puissance_fiscale_min, NULL AS puissance_fiscale_max, 3 AS nombre_places_min, 4 AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 4784 AS prime_nette, 306 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 92 AS skay_id, 'B1' AS usage_code, NULL AS carburant_libelle, NULL AS puissance_fiscale_min, NULL AS puissance_fiscale_max, 5 AS nombre_places_min, 7 AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 6000 AS prime_nette, 270 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 93 AS skay_id, 'B1' AS usage_code, NULL AS carburant_libelle, NULL AS puissance_fiscale_min, NULL AS puissance_fiscale_max, 8 AS nombre_places_min, 29 AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 10549 AS prime_nette, 286 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 94 AS skay_id, 'B1' AS usage_code, NULL AS carburant_libelle, NULL AS puissance_fiscale_min, NULL AS puissance_fiscale_max, 30 AS nombre_places_min, 50 AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 10846 AS prime_nette, 363 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 95 AS skay_id, 'B1' AS usage_code, NULL AS carburant_libelle, NULL AS puissance_fiscale_min, NULL AS puissance_fiscale_max, 51 AS nombre_places_min, 62 AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 26901 AS prime_nette, 190 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 96 AS skay_id, 'B1' AS usage_code, NULL AS carburant_libelle, NULL AS puissance_fiscale_min, NULL AS puissance_fiscale_max, 63 AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 29337 AS prime_nette, 168 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 97 AS skay_id, 'B2' AS usage_code, NULL AS carburant_libelle, NULL AS puissance_fiscale_min, NULL AS puissance_fiscale_max, 1 AS nombre_places_min, 40 AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 9440 AS prime_nette, 410 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 98 AS skay_id, 'B2' AS usage_code, NULL AS carburant_libelle, NULL AS puissance_fiscale_min, NULL AS puissance_fiscale_max, 41 AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 14174 AS prime_nette, 334 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 99 AS skay_id, 'P' AS usage_code, 'Essence' AS carburant_libelle, 0 AS puissance_fiscale_min, 7 AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 3245 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 100 AS skay_id, 'P' AS usage_code, 'Essence' AS carburant_libelle, 8 AS puissance_fiscale_min, 10 AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 4975 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 101 AS skay_id, 'P' AS usage_code, 'Essence' AS carburant_libelle, 11 AS puissance_fiscale_min, NULL AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 5006 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 102 AS skay_id, 'P' AS usage_code, 'Diesel' AS carburant_libelle, 0 AS puissance_fiscale_min, 5 AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 3245 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 103 AS skay_id, 'P' AS usage_code, 'Diesel' AS carburant_libelle, 6 AS puissance_fiscale_min, 7 AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 4975 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 104 AS skay_id, 'P' AS usage_code, 'Diesel' AS carburant_libelle, 8 AS puissance_fiscale_min, NULL AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 5006 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 105 AS skay_id, 'F' AS usage_code, NULL AS carburant_libelle, NULL AS puissance_fiscale_min, NULL AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, 3.5001 AS ptc_min, 6 AS ptc_max, NULL AS sous_classe, 7360 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 106 AS skay_id, 'F' AS usage_code, NULL AS carburant_libelle, NULL AS puissance_fiscale_min, NULL AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, 6.0001 AS ptc_min, 12 AS ptc_max, NULL AS sous_classe, 7394 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 107 AS skay_id, 'F' AS usage_code, NULL AS carburant_libelle, NULL AS puissance_fiscale_min, NULL AS puissance_fiscale_max, NULL AS nombre_places_min, NULL AS nombre_places_max, 12.0001 AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 8130 AS prime_nette, 0 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 108 AS skay_id, 'TRS D''ECOLIERS' AS usage_code, NULL AS carburant_libelle, NULL AS puissance_fiscale_min, NULL AS puissance_fiscale_max, 3 AS nombre_places_min, 4 AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 4784 AS prime_nette, 306 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 109 AS skay_id, 'TRS D''ECOLIERS' AS usage_code, NULL AS carburant_libelle, NULL AS puissance_fiscale_min, NULL AS puissance_fiscale_max, 5 AS nombre_places_min, 7 AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 6000 AS prime_nette, 270 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 110 AS skay_id, 'TRS D''ECOLIERS' AS usage_code, NULL AS carburant_libelle, NULL AS puissance_fiscale_min, NULL AS puissance_fiscale_max, 8 AS nombre_places_min, 29 AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 8720 AS prime_nette, 235 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 111 AS skay_id, 'TRS D''ECOLIERS' AS usage_code, NULL AS carburant_libelle, NULL AS puissance_fiscale_min, NULL AS puissance_fiscale_max, 30 AS nombre_places_min, 50 AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 8960 AS prime_nette, 303 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 112 AS skay_id, 'TRS D''ECOLIERS' AS usage_code, NULL AS carburant_libelle, NULL AS puissance_fiscale_min, NULL AS puissance_fiscale_max, 51 AS nombre_places_min, 62 AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 23290 AS prime_nette, 162 AS prime_par_place, true AS actif
    UNION ALL
    SELECT 113 AS skay_id, 'TRS D''ECOLIERS' AS usage_code, NULL AS carburant_libelle, NULL AS puissance_fiscale_min, NULL AS puissance_fiscale_max, 63 AS nombre_places_min, NULL AS nombre_places_max, NULL AS ptc_min, NULL AS ptc_max, NULL AS sous_classe, 25400 AS prime_nette, 146 AS prime_par_place, true AS actif
) src
JOIN usages usage_ref ON UPPER(usage_ref.code) = UPPER(src.usage_code)
LEFT JOIN carburants carburant_ref
    ON src.carburant_libelle IS NOT NULL
    AND (UPPER(carburant_ref.libelle) = UPPER(src.carburant_libelle)
        OR UPPER(carburant_ref.code) = UPPER(src.carburant_libelle))
LEFT JOIN sous_classes sous_classe_ref
    ON src.sous_classe IS NOT NULL
    AND UPPER(sous_classe_ref.code) = UPPER(src.sous_classe)
WHERE (src.carburant_libelle IS NULL OR carburant_ref.id IS NOT NULL)
  AND (src.sous_classe IS NULL OR sous_classe_ref.id IS NOT NULL);
