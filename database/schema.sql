-- ============================================================
-- MatkaBook Pro — PostgreSQL Schema (aligned with routes)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop existing tables in dependency order so we can recreate cleanly
DROP TABLE IF EXISTS audit_logs      CASCADE;
DROP TABLE IF EXISTS settlements     CASCADE;
DROP TABLE IF EXISTS results         CASCADE;
DROP TABLE IF EXISTS entry_items     CASCADE;
DROP TABLE IF EXISTS entry_batches   CASCADE;
DROP TABLE IF EXISTS payout_rates    CASCADE;
DROP TABLE IF EXISTS valid_panas     CASCADE;
DROP TABLE IF EXISTS markets         CASCADE;
DROP TABLE IF EXISTS brokers         CASCADE;
DROP TABLE IF EXISTS users           CASCADE;

-- ------------------------------------------------------------
-- 1. users
-- ------------------------------------------------------------
CREATE TABLE users (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    username      VARCHAR(50)  UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(20)  NOT NULL CHECK (role IN ('boss', 'broker')),
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 2. brokers
-- ------------------------------------------------------------
CREATE TABLE brokers (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    broker_code     VARCHAR(20)   UNIQUE NOT NULL,
    name            VARCHAR(100)  NOT NULL,
    phone           VARCHAR(20),
    address         TEXT,
    commission_rate DECIMAL(5,2)  NOT NULL DEFAULT 10.00,
    credit_limit    DECIMAL(15,2) NOT NULL DEFAULT 0,
    balance         DECIMAL(15,2) NOT NULL DEFAULT 0,
    is_active       BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP     NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 3. markets
-- ------------------------------------------------------------
CREATE TABLE markets (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name         VARCHAR(100) NOT NULL,
    code         VARCHAR(10)  NOT NULL UNIQUE,
    open_time    TIME         NOT NULL,
    close_time   TIME         NOT NULL,
    open_status  VARCHAR(20)  NOT NULL DEFAULT 'accepting',
    close_status VARCHAR(20)  NOT NULL DEFAULT 'accepting',
    is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
    updated_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_by   UUID         REFERENCES users(id)
);

-- ------------------------------------------------------------
-- 4. valid_panas
-- ------------------------------------------------------------
CREATE TABLE valid_panas (
    pana      VARCHAR(3)  PRIMARY KEY,
    ank       INTEGER     NOT NULL,
    pana_type VARCHAR(20) NOT NULL
);

-- ------------------------------------------------------------
-- 5. payout_rates
-- ------------------------------------------------------------
CREATE TABLE payout_rates (
    id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    bet_type   VARCHAR(50)   NOT NULL UNIQUE,
    rate       DECIMAL(10,2) NOT NULL,
    is_active  BOOLEAN       NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_by UUID          REFERENCES users(id)
);

-- ------------------------------------------------------------
-- 6. entry_batches
-- ------------------------------------------------------------
CREATE TABLE entry_batches (
    id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    broker_id    UUID          NOT NULL REFERENCES brokers(id),
    market_id    UUID          NOT NULL REFERENCES markets(id),
    token        VARCHAR(50)   NOT NULL UNIQUE,
    entry_date   DATE          NOT NULL DEFAULT NOW()::date,
    session      VARCHAR(10)   NOT NULL CHECK (session IN ('open', 'close')),
    status       VARCHAR(20)   NOT NULL DEFAULT 'confirmed',
    total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    notes        TEXT,
    created_at   TIMESTAMP     NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 7. entry_items
-- ------------------------------------------------------------
CREATE TABLE entry_items (
    id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id         UUID          NOT NULL REFERENCES entry_batches(id) ON DELETE CASCADE,
    bet_type         VARCHAR(50)   NOT NULL,
    number           VARCHAR(10)   NOT NULL,
    amount           DECIMAL(15,2) NOT NULL CHECK (amount > 0),
    potential_payout DECIMAL(15,2) NOT NULL DEFAULT 0,
    actual_payout    DECIMAL(15,2) NOT NULL DEFAULT 0,
    is_winner        BOOLEAN,
    created_at       TIMESTAMP     NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 8. results
-- ------------------------------------------------------------
CREATE TABLE results (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id        UUID         NOT NULL REFERENCES markets(id),
    result_date      DATE         NOT NULL,
    open_pana        VARCHAR(3),
    open_ank         INTEGER      CHECK (open_ank BETWEEN 0 AND 9),
    close_pana       VARCHAR(3),
    close_ank        INTEGER      CHECK (close_ank BETWEEN 0 AND 9),
    jodi             VARCHAR(2),
    status           VARCHAR(20)  NOT NULL DEFAULT 'pending',
    declared_by      UUID         REFERENCES users(id),
    declared_at      TIMESTAMP,
    correction_count INTEGER      NOT NULL DEFAULT 0,
    previous_results JSONB,
    created_at       TIMESTAMP    NOT NULL DEFAULT NOW(),
    UNIQUE (market_id, result_date)
);

-- ------------------------------------------------------------
-- 9. settlements
-- ------------------------------------------------------------
CREATE TABLE settlements (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    broker_id       UUID          NOT NULL REFERENCES brokers(id),
    settlement_date DATE          NOT NULL,
    settlement_type VARCHAR(20)   NOT NULL,
    amount          DECIMAL(15,2) NOT NULL DEFAULT 0,
    balance_before  DECIMAL(15,2) NOT NULL DEFAULT 0,
    balance_after   DECIMAL(15,2) NOT NULL DEFAULT 0,
    notes           TEXT,
    processed_by    UUID          REFERENCES users(id),
    created_at      TIMESTAMP     NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 10. audit_logs
-- ------------------------------------------------------------
CREATE TABLE audit_logs (
    id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID          REFERENCES users(id),
    action     VARCHAR(100)  NOT NULL,
    table_name VARCHAR(100),
    record_id  UUID,
    old_values TEXT,
    new_values TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP     NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------
CREATE INDEX idx_brokers_user_id        ON brokers(user_id);
CREATE INDEX idx_entry_batches_broker   ON entry_batches(broker_id);
CREATE INDEX idx_entry_batches_market   ON entry_batches(market_id);
CREATE INDEX idx_entry_batches_date     ON entry_batches(entry_date);
CREATE INDEX idx_entry_batches_token    ON entry_batches(token);
CREATE INDEX idx_entry_items_batch      ON entry_items(batch_id);
CREATE INDEX idx_results_market_date    ON results(market_id, result_date);
CREATE INDEX idx_settlements_broker     ON settlements(broker_id);
CREATE INDEX idx_settlements_date       ON settlements(settlement_date);
CREATE INDEX idx_audit_logs_user        ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created     ON audit_logs(created_at DESC);
