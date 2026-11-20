/*
 * Memon Book Store — front-end configuration.
 * There are NO passwords or secrets in this file (or anywhere in the front-end).
 */
window.MBS_CONFIG = {
  /*
   * Address of the secure backend (database + admin panel).
   *  - Leave "" when the website and the backend are served from the same address.
   *  - When the static site is on GitHub Pages and the backend is hosted elsewhere,
   *    put the backend address here, for example "https://admin.your-domain.com".
   *    The public pages will then show live data edited in the admin panel.
   */
  apiBase: "",

  /* true = never contact a backend; always read data/catalogue.json. */
  staticOnly: false,

  /* Fallback WhatsApp number (international format, digits only) used before data loads. */
  whatsapp: "923339230528",
};
