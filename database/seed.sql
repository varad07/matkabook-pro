-- ============================================================
-- MatkaBook Pro — Seed Data
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- Users  (boss + 3 brokers)
-- ------------------------------------------------------------
INSERT INTO users (username, password_hash, role) VALUES
    ('boss',   crypt('boss123',   gen_salt('bf', 10)), 'boss'),
    ('brk001', crypt('broker123', gen_salt('bf', 10)), 'broker'),
    ('brk002', crypt('broker123', gen_salt('bf', 10)), 'broker'),
    ('brk003', crypt('broker123', gen_salt('bf', 10)), 'broker')
ON CONFLICT (username) DO NOTHING;

-- ------------------------------------------------------------
-- Brokers
-- ------------------------------------------------------------
INSERT INTO brokers (user_id, broker_code, name, phone, commission_rate)
SELECT id, 'BRK001', 'Raj',   '9999900001', 10 FROM users WHERE username='brk001'
ON CONFLICT (broker_code) DO NOTHING;

INSERT INTO brokers (user_id, broker_code, name, phone, commission_rate)
SELECT id, 'BRK002', 'Amit',  '9999900002', 10 FROM users WHERE username='brk002'
ON CONFLICT (broker_code) DO NOTHING;

INSERT INTO brokers (user_id, broker_code, name, phone, commission_rate)
SELECT id, 'BRK003', 'Vijay', '9999900003', 10 FROM users WHERE username='brk003'
ON CONFLICT (broker_code) DO NOTHING;

-- ------------------------------------------------------------
-- Markets  (column names: code, open_time, close_time)
-- ------------------------------------------------------------
INSERT INTO markets (name, code, open_time, close_time) VALUES
    ('Kalyan',      'KAL', '15:45', '17:45'),
    ('Milan Day',   'MID', '13:28', '14:28'),
    ('Milan Night', 'MIN', '21:00', '21:30'),
    ('Time Bazar',  'TIM', '13:00', '14:00'),
    ('Main Bazar',  'MAB', '21:15', '23:30')
ON CONFLICT (code) DO NOTHING;

-- ------------------------------------------------------------
-- Payout Rates
-- ------------------------------------------------------------
INSERT INTO payout_rates (bet_type, rate, is_active) VALUES
    ('single_ank',   9,   TRUE),
    ('jodi',        90,   TRUE),
    ('single_pana', 150,  TRUE),
    ('double_pana', 300,  TRUE),
    ('triple_pana', 600,  TRUE)
ON CONFLICT (bet_type) DO NOTHING;

-- ------------------------------------------------------------
-- Valid Panas — authoritative Matka pana list
-- ank = (d1 + d2 + d3) % 10
-- pana_type computed from digit equality (NOT sort order)
-- ------------------------------------------------------------
INSERT INTO valid_panas (pana, ank, pana_type)
SELECT
    p,
    (CAST(SUBSTRING(p,1,1) AS INT)
   + CAST(SUBSTRING(p,2,1) AS INT)
   + CAST(SUBSTRING(p,3,1) AS INT)) % 10,
    CASE
        WHEN SUBSTRING(p,1,1)=SUBSTRING(p,2,1) AND SUBSTRING(p,2,1)=SUBSTRING(p,3,1) THEN 'triple_pana'
        WHEN SUBSTRING(p,1,1)=SUBSTRING(p,2,1) OR SUBSTRING(p,2,1)=SUBSTRING(p,3,1) OR SUBSTRING(p,1,1)=SUBSTRING(p,3,1) THEN 'double_pana'
        ELSE 'single_pana'
    END
FROM (VALUES
    -- Single Panas (120)
    ('128'),('137'),('146'),('236'),('245'),('290'),('380'),('470'),('489'),('560'),('678'),('579'),
    ('129'),('138'),('147'),('156'),('237'),('246'),('345'),('390'),('480'),('570'),('679'),('589'),
    ('120'),('139'),('148'),('157'),('238'),('247'),('256'),('346'),('490'),('580'),('670'),('689'),
    ('130'),('149'),('158'),('167'),('239'),('248'),('257'),('347'),('356'),('590'),('680'),('789'),
    ('140'),('159'),('168'),('230'),('249'),('258'),('267'),('348'),('357'),('456'),('690'),('780'),
    ('123'),('150'),('169'),('178'),('240'),('259'),('268'),('349'),('358'),('457'),('367'),('790'),
    ('124'),('160'),('179'),('250'),('269'),('278'),('340'),('359'),('368'),('458'),('467'),('890'),
    ('125'),('134'),('170'),('189'),('260'),('279'),('350'),('369'),('378'),('459'),('567'),('468'),
    ('126'),('135'),('180'),('234'),('270'),('289'),('360'),('379'),('450'),('469'),('478'),('568'),
    ('127'),('136'),('145'),('190'),('235'),('280'),('370'),('389'),('460'),('479'),('569'),('578'),
    -- Double Panas (80)
    ('119'),('155'),('227'),('335'),('344'),('399'),('588'),('669'),
    ('110'),('228'),('255'),('336'),('499'),('660'),('688'),('778'),
    ('166'),('229'),('337'),('355'),('445'),('599'),('779'),('788'),
    ('112'),('220'),('266'),('338'),('446'),('455'),('699'),('770'),
    ('113'),('122'),('177'),('339'),('366'),('447'),('799'),('889'),
    ('114'),('277'),('330'),('448'),('466'),('556'),('880'),('899'),
    ('115'),('133'),('188'),('223'),('377'),('449'),('557'),('566'),
    ('116'),('224'),('233'),('288'),('440'),('477'),('558'),('990'),
    ('117'),('144'),('199'),('225'),('388'),('559'),('577'),('667'),
    ('118'),('226'),('244'),('299'),('334'),('488'),('668'),('677'),
    -- Triple Panas (10)
    ('111'),('222'),('333'),('444'),('555'),('666'),('777'),('888'),('999'),('000')
) AS t(p)
ON CONFLICT (pana) DO UPDATE SET ank=EXCLUDED.ank, pana_type=EXCLUDED.pana_type;

COMMIT;
