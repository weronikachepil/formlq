/**
 * Selling the advent calendar happens outside the site: a buyer writes to formlq, pays
 * directly, and an editor creates a personal code for them (or a pack of codes for a
 * teacher) in the cabinet — see AdventSharePanel and lib/advent-codes.ts.
 * The page only shows the prices and how to get in touch.
 */

export const PRICE_STUDENT = 149;

/** Teachers pay per student code, cheaper in bulk; their own access comes with any pack. */
export function teacherCodePrice(qty: number): number {
  return qty >= 20 ? 79 : 99;
}

/** Where buyers go to get a code: formlq's Telegram channel. Empty href = a plain hint instead. */
export const ORDER_CONTACT = { href: "https://t.me/+QKzVYue4pR41YzE6", label: "Перейти в Telegram-канал" };
