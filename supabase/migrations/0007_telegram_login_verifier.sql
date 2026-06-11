-- Bind each login nonce to the browser that started it (a hashed verifier kept in an httpOnly
-- cookie), so a leaked/observed nonce cannot be redeemed by anyone else at /poll.
alter table telegram_login add column if not exists verifier_hash text;
