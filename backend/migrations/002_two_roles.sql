LOCK TABLE app_users IN ACCESS EXCLUSIVE MODE;
ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_role_check;
UPDATE app_users SET role='admin',
 display_name=CASE WHEN display_name='Super Admin' THEN 'Admin' ELSE display_name END
 WHERE role='super_admin';
ALTER TABLE app_users ADD CONSTRAINT app_users_role_check CHECK (role IN ('user','admin'));
