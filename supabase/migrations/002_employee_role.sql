-- Commit the enum value before using it in the following migration.
alter type public.app_role add value if not exists 'employee';
