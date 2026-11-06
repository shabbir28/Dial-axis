CREATE TABLE IF NOT EXISTS app_users (
 id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 username varchar(64) NOT NULL UNIQUE,
 display_name varchar(100) NOT NULL,
 password_hash text NOT NULL,
 role varchar(20) NOT NULL CHECK (role IN ('user','admin')),
 active boolean NOT NULL DEFAULT true,
 must_change_password boolean NOT NULL DEFAULT true,
 token_version integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now()
);
