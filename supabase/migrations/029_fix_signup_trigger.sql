-- Restore the account-bootstrapping signup trigger.
--
-- Migration 017 installed a handle_new_user that creates an account +
-- profile for every new auth user. The live function had regressed
-- out-of-band to the pre-accounts version, which only inserted
-- profiles(user_id, full_name, email). Since profiles.account_id and
-- profiles.account_role are NOT NULL, that insert always failed — and
-- the EXCEPTION WHEN OTHERS handler swallowed the error, leaving auth
-- users with no profile at all (so the app resolved account_id = null
-- and showed nothing).
--
-- This re-asserts the correct body and deliberately DROPS the silent
-- exception handler: if bootstrapping ever fails again, the signup
-- fails loudly instead of silently orphaning the user.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name TEXT;
  v_account_id UUID;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');

  INSERT INTO public.accounts (name, owner_user_id)
  VALUES (COALESCE(NULLIF(v_full_name, ''), NEW.email, 'My account'), NEW.id)
  RETURNING id INTO v_account_id;

  INSERT INTO public.profiles (user_id, full_name, email, account_id, account_role)
  VALUES (NEW.id, v_full_name, NEW.email, v_account_id, 'owner');

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
