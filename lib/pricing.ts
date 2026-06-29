// Direct-booking discount. Booking on the site (the direct channel) is cheaper than the OTAs —
// the guest pays (1 - WEBSITE_DISCOUNT) of the full nightly total. This is the SINGLE source of
// truth: the server applies it to the canonical total_usd (app/api/book) and the client uses the
// same helpers for display, so the shown price and the charged price can never drift.
//
// Scope: website bookings only. Manual/OTA bookings (admin) stay at full price — the OTA already
// takes its own cut, and the 10% is specifically the reward for booking direct.

export const WEBSITE_DISCOUNT = 0.10; // 10% off

// percent shown in UI/badges (e.g. "−10%"), derived so copy never hardcodes the number
export const WEBSITE_DISCOUNT_PCT = Math.round(WEBSITE_DISCOUNT * 100);

// full nightly total (price × nights, USD) → what the guest actually pays, rounded to whole USD
export const directTotal = (fullUsd: number): number => Math.round(fullUsd * (1 - WEBSITE_DISCOUNT));

// how much the guest saves vs the full total (the two always sum back to the full, rounded)
export const directSavings = (fullUsd: number): number => Math.round(fullUsd) - directTotal(fullUsd);
