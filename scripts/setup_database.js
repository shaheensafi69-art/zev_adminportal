const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:Japan%23%2312345%40%40@db.zjwmioalrhkyfbzhdnnw.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🚀 Starting ZEV Master Database Schema Synchronization...');
    await client.query('BEGIN');

    // 1. USER TRUSTED DEVICES TABLE (For Authenticator 1-Time per Device Verification)
    console.log('1. Setting up public.user_trusted_devices...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.user_trusted_devices (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        device_id text NOT NULL,
        device_name text,
        platform text,
        is_trusted boolean DEFAULT true,
        ip_address text,
        user_agent text,
        last_authenticated_at timestamptz DEFAULT NOW(),
        created_at timestamptz DEFAULT NOW(),
        CONSTRAINT uq_user_device UNIQUE (user_id, device_id)
      );

      CREATE INDEX IF NOT EXISTS idx_user_trusted_devices_lookup 
        ON public.user_trusted_devices(user_id, device_id);

      ALTER TABLE public.user_trusted_devices ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS "Users can read own trusted devices" ON public.user_trusted_devices;
      CREATE POLICY "Users can read own trusted devices"
        ON public.user_trusted_devices FOR SELECT
        USING (auth.uid() = user_id);

      DROP POLICY IF EXISTS "Users can insert own trusted devices" ON public.user_trusted_devices;
      CREATE POLICY "Users can insert own trusted devices"
        ON public.user_trusted_devices FOR INSERT
        WITH CHECK (auth.uid() = user_id);

      DROP POLICY IF EXISTS "Users can update own trusted devices" ON public.user_trusted_devices;
      CREATE POLICY "Users can update own trusted devices"
        ON public.user_trusted_devices FOR UPDATE
        USING (auth.uid() = user_id);

      DROP POLICY IF EXISTS "Users can delete own trusted devices" ON public.user_trusted_devices;
      CREATE POLICY "Users can delete own trusted devices"
        ON public.user_trusted_devices FOR DELETE
        USING (auth.uid() = user_id);
    `);

    // 2. SUBSCRIPTIONS TABLE ENHANCEMENTS
    console.log('2. Enhancing public.subscriptions schema & columns...');
    await client.query(`
      ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS plan text;
      ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS amount numeric;
      ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS currency text DEFAULT 'USD';
      ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'Direct/In-App';
      ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT false;

      -- Sync trigger for plan <-> plan_type and plan_price <-> amount
      CREATE OR REPLACE FUNCTION sync_subscription_fields()
      RETURNS trigger AS $$
      BEGIN
        IF NEW.plan IS NOT NULL AND (NEW.plan_type IS NULL OR NEW.plan_type = '') THEN
          NEW.plan_type := NEW.plan;
        END IF;
        IF NEW.plan_type IS NOT NULL AND (NEW.plan IS NULL OR NEW.plan = '') THEN
          NEW.plan := NEW.plan_type;
        END IF;
        IF NEW.amount IS NOT NULL AND (NEW.plan_price IS NULL OR NEW.plan_price = '') THEN
          NEW.plan_price := '$' || NEW.amount::text;
        END IF;
        IF NEW.status = 'active' THEN
          NEW.is_active := true;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_sync_subscription_fields ON public.subscriptions;
      CREATE TRIGGER trg_sync_subscription_fields
        BEFORE INSERT OR UPDATE ON public.subscriptions
        FOR EACH ROW
        EXECUTE FUNCTION sync_subscription_fields();

      -- Ensure unique subscription per user so upsert works cleanly
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'uq_subscriptions_user_id'
        ) THEN
          ALTER TABLE public.subscriptions ADD CONSTRAINT uq_subscriptions_user_id UNIQUE (user_id);
        END IF;
      EXCEPTION
        WHEN others THEN NULL;
      END $$;
    `);

    // 3. REFERRALS TABLE ENHANCEMENTS & SYNC
    console.log('3. Enhancing public.referrals schema & trigger...');
    await client.query(`
      ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS referred_id uuid;

      -- Sync trigger for referee_id <-> referred_id
      CREATE OR REPLACE FUNCTION sync_referral_fields()
      RETURNS trigger AS $$
      BEGIN
        IF NEW.referee_id IS NOT NULL AND NEW.referred_id IS NULL THEN
          NEW.referred_id := NEW.referee_id;
        END IF;
        IF NEW.referred_id IS NOT NULL AND NEW.referee_id IS NULL THEN
          NEW.referee_id := NEW.referred_id;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_sync_referral_fields ON public.referrals;
      CREATE TRIGGER trg_sync_referral_fields
        BEFORE INSERT OR UPDATE ON public.referrals
        FOR EACH ROW
        EXECUTE FUNCTION sync_referral_fields();

      -- Prevent duplicate referrals between same users
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'uq_referrals_pair'
        ) THEN
          ALTER TABLE public.referrals ADD CONSTRAINT uq_referrals_pair UNIQUE (referrer_id, referee_id);
        END IF;
      EXCEPTION
        WHEN others THEN NULL;
      END $$;
    `);

    // 4. USER SUPPORT TICKETS TABLE
    console.log('4. Setting up public.user_support_tickets...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.user_support_tickets (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
        username text,
        email text,
        phone text,
        category text NOT NULL,
        subject text NOT NULL,
        description text NOT NULL,
        status text DEFAULT 'open',
        priority text DEFAULT 'normal',
        admin_notes text,
        created_at timestamptz DEFAULT NOW(),
        updated_at timestamptz DEFAULT NOW()
      );

      ALTER TABLE public.user_support_tickets ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS "Users can read own support tickets" ON public.user_support_tickets;
      CREATE POLICY "Users can read own support tickets"
        ON public.user_support_tickets FOR SELECT
        USING (auth.uid() = user_id);

      DROP POLICY IF EXISTS "Users can insert own support tickets" ON public.user_support_tickets;
      CREATE POLICY "Users can insert own support tickets"
        ON public.user_support_tickets FOR INSERT
        WITH CHECK (auth.uid() = user_id);
    `);

    // 5. USER VERIFICATIONS CONSTRAINTS
    console.log('5. Ensuring unique constraint on public.user_verifications(user_id)...');
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'uq_user_verifications_user_id'
        ) THEN
          ALTER TABLE public.user_verifications ADD CONSTRAINT uq_user_verifications_user_id UNIQUE (user_id);
        END IF;
      EXCEPTION
        WHEN others THEN NULL;
      END $$;
    `);

    await client.query('COMMIT');
    console.log('✅ ALL DATABASE MIGRATIONS COMPLETED SUCCESSFULLY!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();

