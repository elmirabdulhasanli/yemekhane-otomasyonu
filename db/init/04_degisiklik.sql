-- =====================================================================
-- Yemekhane Otomasyonu · Migration 04 · Değişiklik talebi
--   1. Yarım porsiyon: öğle ve akşamda seçilebilir, ücret tam fiyatın %60'ı.
--      Kahvaltıda yarım porsiyon yoktur. Geçmiş rezervasyonlar tam porsiyon sayılır.
--   2. Alerjen uyarısı: kullanıcı profilinde alerjenlerini seçer.
--
-- Çalışan sistemde (yalnızca KAYNAKTA, replikaya değişiklik replikasyonla geçer):
--   docker compose exec -T mysql-primary mysql -uroot -pyemekhane_kok yemekhane < db/init/04_degisiklik.sql
-- Sıfırdan kurulumda db/init içinde olduğu için 01 ve 02'den sonra otomatik çalışır.
--
-- Mevcut veriyi bozmaz: yalnızca sütun/tablo EKLER, var olan satırlar varsayılan
-- değerleri alır (porsiyon = 'tam'). Tekrar çalıştırılabilir (idempotent): ikinci
-- çalıştırmada eklenmiş sütunlar atlanır, yordam ve fonksiyon yeniden oluşturulur.
-- =====================================================================
SET NAMES utf8mb4;
USE yemekhane;

-- ---------------------------------------------------------------------
-- Yardımcı: sütun yoksa ekle (MySQL'de ADD COLUMN IF NOT EXISTS yok)
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS _m04_sutun_ekle;
DELIMITER $$
CREATE PROCEDURE _m04_sutun_ekle(IN p_tablo VARCHAR(64), IN p_sutun VARCHAR(64), IN p_tanim TEXT)
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_tablo AND COLUMN_NAME = p_sutun) THEN
        SET @m04_sql = CONCAT('ALTER TABLE `', p_tablo, '` ADD COLUMN `', p_sutun, '` ', p_tanim);
        PREPARE m04_ifade FROM @m04_sql;
        EXECUTE m04_ifade;
        DEALLOCATE PREPARE m04_ifade;
    END IF;
END$$
DELIMITER ;

-- ---------------------------------------------------------------------
-- 1a. Öğün bazında "yarım porsiyon seçilebilir mi" bilgisi
--     Kural koda gömülmez, veride durur: ileride kahvaltıya da açılırsa tek UPDATE yeter.
-- ---------------------------------------------------------------------
CALL _m04_sutun_ekle('ogunler', 'yarim_porsiyon',
    "TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Bu öğünde yarım porsiyon seçilebilir mi' AFTER `servis_bitis`");

UPDATE ogunler SET yarim_porsiyon = IF(id IN (2, 3), 1, 0);   -- 1 Kahvaltı: yok · 2 Öğle, 3 Akşam: var

-- ---------------------------------------------------------------------
-- 1b. Rezervasyonun porsiyonu. Var olan tüm satırlar DEFAULT ile 'tam' olur
--     (geçmiş rezervasyonlar tam porsiyon sayılır). ucret sütunu zaten ödenen tutarı tutar.
-- ---------------------------------------------------------------------
CALL _m04_sutun_ekle('rezervasyonlar', 'porsiyon',
    "ENUM('tam','yarim') NOT NULL DEFAULT 'tam' COMMENT 'yarim: tam fiyatın %60''ı' AFTER `durum`");

-- ---------------------------------------------------------------------
-- 2. Kullanıcının alerjenleri (çoka çok). Kullanıcı silinirse seçimleri de silinir.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kullanici_alerjenleri (
    kullanici_id  INT UNSIGNED NOT NULL,
    alerjen_id    TINYINT UNSIGNED NOT NULL,
    olusturma     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (kullanici_id, alerjen_id),
    KEY ix_ka_alerjen (alerjen_id),
    CONSTRAINT fk_ka_kullanici FOREIGN KEY (kullanici_id) REFERENCES kullanicilar (id) ON DELETE CASCADE,
    CONSTRAINT fk_ka_alerjen   FOREIGN KEY (alerjen_id)   REFERENCES alerjenler (id)
) ENGINE=InnoDB COMMENT='Kullanıcının profilinde seçtiği alerjenler (menüde uyarı için)';

DROP PROCEDURE IF EXISTS _m04_sutun_ekle;

-- ---------------------------------------------------------------------
-- Porsiyon ücreti: tek yerde tanımlı. Hem yordam hem uygulamanın fiyat
-- gösterimi bunu kullanır; oran değişirse yalnızca burası değişir.
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS fn_porsiyon_ucreti;
DELIMITER $$
CREATE FUNCTION fn_porsiyon_ucreti(p_tam_fiyat DECIMAL(8,2), p_porsiyon VARCHAR(5))
RETURNS DECIMAL(8,2)
DETERMINISTIC NO SQL
COMMENT 'Yarım porsiyon = tam fiyatın %60''ı (kuruşa yuvarlanır)'
BEGIN
    RETURN IF(p_porsiyon = 'yarim', ROUND(p_tam_fiyat * 0.60, 2), p_tam_fiyat);
END$$
DELIMITER ;

-- ---------------------------------------------------------------------
-- sp_rezervasyon_yap(kullanici_id, menu_id, porsiyon)   [GÜNCELLENDİ]
-- porsiyon: 'tam' | 'yarim' (NULL → 'tam')
-- Yeni hatalar: 'Geçersiz porsiyon seçimi.', 'Bu öğünde yarım porsiyon seçilemez.'
-- Dönen satır: rezervasyon_id, ucret, bakiye, porsiyon
-- Değişmeyenler: kilitleme sırası, kapasite/son saat/bakiye kontrolleri, iptal edilmiş
-- kaydın yeniden etkinleşmesi (porsiyonu da yeni seçime göre güncellenir).
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_rezervasyon_yap;
DELIMITER $$
CREATE PROCEDURE sp_rezervasyon_yap(
    IN p_kullanici_id INT UNSIGNED,
    IN p_menu_id      INT UNSIGNED,
    IN p_porsiyon     VARCHAR(5)
)
BEGIN
    DECLARE v_rol          VARCHAR(10)  DEFAULT NULL;
    DECLARE v_aktif        TINYINT      DEFAULT NULL;
    DECLARE v_bakiye       DECIMAL(10,2) DEFAULT NULL;
    DECLARE v_son          DATETIME     DEFAULT NULL;
    DECLARE v_kapasite     INT          DEFAULT NULL;
    DECLARE v_ogr_fiyat    DECIMAL(8,2) DEFAULT NULL;
    DECLARE v_per_fiyat    DECIMAL(8,2) DEFAULT NULL;
    DECLARE v_yarim_var    TINYINT      DEFAULT 0;
    DECLARE v_porsiyon     VARCHAR(5)   DEFAULT 'tam';
    DECLARE v_ucret        DECIMAL(8,2) DEFAULT NULL;
    DECLARE v_dolu         INT          DEFAULT 0;
    DECLARE v_mevcut_id    INT UNSIGNED DEFAULT NULL;
    DECLARE v_mevcut_durum VARCHAR(12)  DEFAULT NULL;
    DECLARE v_rez_id       INT UNSIGNED DEFAULT NULL;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;

    SET v_porsiyon = COALESCE(p_porsiyon, 'tam');
    IF v_porsiyon NOT IN ('tam', 'yarim') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Geçersiz porsiyon seçimi.';
    END IF;

    START TRANSACTION;

    -- Kullanıcı satırını kilitle (eşzamanlı bakiye işlemlerine karşı)
    SELECT rol, aktif, bakiye INTO v_rol, v_aktif, v_bakiye
      FROM kullanicilar WHERE id = p_kullanici_id FOR UPDATE;
    IF v_rol IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Kullanıcı bulunamadı.';
    END IF;
    IF v_aktif = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Hesabınız pasif durumda.';
    END IF;

    -- Menü satırını kilitle (eşzamanlı kapasite kontrolüne karşı)
    SELECT TIMESTAMP(m.tarih, o.son_saat), yh.kapasite, m.ogrenci_fiyati, m.personel_fiyati, o.yarim_porsiyon
      INTO v_son, v_kapasite, v_ogr_fiyat, v_per_fiyat, v_yarim_var
      FROM menuler m
      JOIN ogunler o       ON o.id  = m.ogun_id
      JOIN yemekhaneler yh ON yh.id = m.yemekhane_id
     WHERE m.id = p_menu_id
       FOR UPDATE;
    IF v_son IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Menü bulunamadı.';
    END IF;
    IF v_porsiyon = 'yarim' AND v_yarim_var = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Bu öğünde yarım porsiyon seçilemez.';
    END IF;
    IF NOW() >= v_son THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Bu menü için rezervasyon süresi doldu.';
    END IF;

    SELECT id, durum INTO v_mevcut_id, v_mevcut_durum
      FROM rezervasyonlar
     WHERE kullanici_id = p_kullanici_id AND menu_id = p_menu_id
       FOR UPDATE;
    IF v_mevcut_durum IN ('aktif', 'kullanildi') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Bu menü için zaten rezervasyonunuz var.';
    END IF;

    SELECT COUNT(*) INTO v_dolu
      FROM rezervasyonlar
     WHERE menu_id = p_menu_id AND durum IN ('aktif', 'kullanildi');
    IF v_dolu >= v_kapasite THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Yemekhane kapasitesi dolu.';
    END IF;

    -- Yarım porsiyon da bir kişilik yer kaplar; yalnızca ücret değişir.
    SET v_ucret = fn_porsiyon_ucreti(IF(v_rol = 'ogrenci', v_ogr_fiyat, v_per_fiyat), v_porsiyon);
    IF v_bakiye < v_ucret THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Bakiye yetersiz.';
    END IF;

    IF v_mevcut_id IS NULL THEN
        INSERT INTO rezervasyonlar (kullanici_id, menu_id, durum, porsiyon, ucret)
        VALUES (p_kullanici_id, p_menu_id, 'aktif', v_porsiyon, v_ucret);
        SET v_rez_id = LAST_INSERT_ID();
    ELSE
        -- Daha önce iptal edilmiş kayıt yeniden etkinleşir
        UPDATE rezervasyonlar
           SET durum = 'aktif', porsiyon = v_porsiyon, ucret = v_ucret, olusturma = NOW(),
               iptal_zamani = NULL, kullanma_zamani = NULL
         WHERE id = v_mevcut_id;
        SET v_rez_id = v_mevcut_id;
    END IF;

    UPDATE kullanicilar SET bakiye = bakiye - v_ucret WHERE id = p_kullanici_id;

    INSERT INTO bakiye_hareketleri (kullanici_id, tur, tutar, rezervasyon_id, aciklama)
    VALUES (p_kullanici_id, 'rezervasyon', -v_ucret, v_rez_id,
            IF(v_porsiyon = 'yarim', 'Rezervasyon (yarım porsiyon)', 'Rezervasyon'));

    COMMIT;

    SELECT v_rez_id AS rezervasyon_id, v_ucret AS ucret, v_bakiye - v_ucret AS bakiye, v_porsiyon AS porsiyon;
END$$
DELIMITER ;
