/* Throwaway inbox providers. Sign-ups from these are refused so one person cannot farm free accounts.
   Not exhaustive: it covers the services people actually reach for. Shared by the browser and the server. */
const DISPOSABLE = new Set([
  "10minutemail.com", "10minutemail.net", "20minutemail.com", "33mail.com", "anonaddy.me", "burnermail.io", "byom.de",
  "discard.email", "dispostable.com", "dropmail.me", "emailondeck.com", "emailfake.com", "fakeinbox.com", "fakemail.net",
  "getairmail.com", "getnada.com", "guerrillamail.biz", "guerrillamail.com", "guerrillamail.de", "guerrillamail.info",
  "guerrillamail.net", "guerrillamail.org", "guerrillamailblock.com", "harakirimail.com", "inboxbear.com", "incognitomail.org",
  "jetable.org", "linshiyouxiang.net", "mail.tm", "mail-temp.com", "mailcatch.com", "maildrop.cc", "mailinator.com",
  "mailinator.net", "mailinator2.com", "mailnesia.com", "mailpoof.com", "mailsac.com", "mintemail.com", "mohmal.com",
  "moakt.com", "mytemp.email", "nada.email", "throwawaymail.com", "temp-mail.io", "temp-mail.org", "tempail.com",
  "tempinbox.com", "tempmail.com", "tempmail.dev", "tempmail.net", "tempmail.plus", "tempmailo.com", "tempr.email",
  "trashmail.com", "trashmail.de", "trashmail.net", "trbvm.com", "sharklasers.com", "spam4.me", "spamgourmet.com",
  "yopmail.com", "yopmail.fr", "yopmail.net", "wegwerfmail.de", "emailtemporanea.com", "tmpmail.org", "tmpmail.net",
  "tmail.ws", "fexbox.org", "rootfest.net", "cuvox.de", "armyspy.com", "dayrep.com", "einrot.com", "fleckens.hu",
  "gustr.com", "jourrapide.com", "rhyta.com", "superrito.com", "teleworm.us", "grr.la", "pokemail.net", "spambox.us",
  "mailnull.com", "owlymail.com", "luxusmail.org", "1secmail.com", "1secmail.net", "1secmail.org", "emltmp.com",
  "minuteinbox.com", "tempmailaddress.com", "inboxkitten.com", "spamdecoy.net", "mvrht.net", "vomoto.com",
]);

/** True for an address at a known throwaway-inbox provider (or a subdomain of one). */
export function isDisposable(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@")[1] ?? "";
  const parts = domain.split(".");
  for (let i = 0; i < parts.length - 1; i++) if (DISPOSABLE.has(parts.slice(i).join("."))) return true;
  return false;
}
