-- Remember the site language the login was started in, so the bot can greet the user in their
-- own language (uz/ru/en) on the consent + success messages.
alter table telegram_login add column if not exists lang text not null default 'uz';
