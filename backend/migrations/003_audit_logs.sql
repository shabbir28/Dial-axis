CREATE TABLE IF NOT EXISTS audit_logs (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 created_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz,
 actor_id integer NOT NULL,
 username varchar(64) NOT NULL,
 actor_role varchar(20) NOT NULL,
 action varchar(40) NOT NULL,
 dialer_id varchar(20),
 outcome varchar(20) NOT NULL DEFAULT 'pending',
 http_status integer,
 ip_address varchar(80),
 details jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs(created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS audit_logs_actor_idx ON audit_logs(actor_id,created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs(action,created_at DESC);
