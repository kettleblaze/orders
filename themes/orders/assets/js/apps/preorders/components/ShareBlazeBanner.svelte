<script>
  import { createEventDispatcher, onMount } from "svelte";

  // ====== Props ======
  export let lang = "it"; // "it", "en", "fr", "de", "es", "pl"
  export let orderId = ""; // usato per persistenza localStorage
  export let isEligible = true; // se false il banner non si mostra
  export let compact = false; // stile più compatto (es. pagina prodotto)
  export let uploadUrl = ""; // opzionale: se lo usi, mostra link "Vai al modulo"
  export let products = ["FlexiBell 2", "Magneti-X"]; // mostrati nel testo
  export let showPlatforms = [
    "Instagram",
    "YouTube",
    "Facebook",
    "Reddit",
    "TikTok",
  ];

  const dispatch = createEventDispatcher();

  const i18n = {
    it: {
      title: "#ShareBlaze",
      subtitle:
        "Condividi il tuo video con {products} e ricevi una ricompensa garantita.",
      ctaUpload: "Carica il tuo video",
      ctaGoToForm: "Vai al modulo",
      ctaRules: "Scopri le regole",
      dismiss: "Non ora",
      modalTitle: "Invia contributo #ShareBlaze",
      fieldPlatform: "Piattaforma",
      fieldHandle: "Username/Handle (opz.)",
      fieldLink: "Link del video (se pubblico)",
      or: "oppure",
      fieldFile: "Carica il file (MP4, MOV, max 200MB)*",
      rewardTitle: "Scegli la tua ricompensa*",
      r1: "Prodotto omaggio",
      r2: "Chargeback di 10€",
      r3: "Coupon sconto 10€",
      agree:
        "Ho letto e accetto le regole del programma (entro 7 giorni dalla consegna, contenuti autentici e conformi).",
      submit: "Invia",
      required: "I campi contrassegnati con * sono obbligatori.",
      success: "Grazie! Abbiamo ricevuto il tuo contributo.",
      errPlatform: "Seleziona una piattaforma.",
      errReward: "Seleziona una ricompensa.",
      errLinkOrFile: "Inserisci un link oppure carica un file.",
    },
    en: {
      title: "#ShareBlaze",
      subtitle: "Share your video with {products} and get a guaranteed reward.",
      ctaUpload: "Upload your video",
      ctaGoToForm: "Go to form",
      ctaRules: "See rules",
      dismiss: "Not now",
      modalTitle: "#ShareBlaze Submission",
      fieldPlatform: "Platform",
      fieldHandle: "Username/Handle (opt.)",
      fieldLink: "Video link (if public)",
      or: "or",
      fieldFile: "Upload file (MP4, MOV, max 200MB)*",
      rewardTitle: "Choose your reward*",
      r1: "Free product",
      r2: "€10 chargeback",
      r3: "€10 discount coupon",
      agree:
        "I have read and accept the program rules (within 7 days from delivery, authentic and compliant content).",
      submit: "Submit",
      required: "Fields marked with * are required.",
      success: "Thanks! We received your submission.",
      errPlatform: "Please select a platform.",
      errReward: "Please select a reward.",
      errLinkOrFile: "Add a link or upload a file.",
    },
    fr: {
      title: "#ShareBlaze",
      subtitle:
        "Partagez votre vidéo avec {products} et recevez une récompense garantie.",
      ctaUpload: "Téléverser votre vidéo",
      ctaGoToForm: "Aller au formulaire",
      ctaRules: "Voir les règles",
      dismiss: "Pas maintenant",
      modalTitle: "Soumission #ShareBlaze",
      fieldPlatform: "Plateforme",
      fieldHandle: "Nom d’utilisateur (facult.)",
      fieldLink: "Lien de la vidéo (si public)",
      or: "ou",
      fieldFile: "Téléverser le fichier (MP4, MOV, 200Mo max)*",
      rewardTitle: "Choisissez votre récompense*",
      r1: "Produit gratuit",
      r2: "Remboursement de 10 €",
      r3: "Coupon de 10 €",
      agree:
        "J’ai lu et j’accepte les règles du programme (sous 7 jours après livraison; contenu authentique et conforme).",
      submit: "Envoyer",
      required: "Les champs marqués d’un * sont obligatoires.",
      success: "Merci ! Nous avons reçu votre contribution.",
      errPlatform: "Sélectionnez une plateforme.",
      errReward: "Sélectionnez une récompense.",
      errLinkOrFile: "Ajoutez un lien ou téléversez un fichier.",
    },
    de: {
      title: "#ShareBlaze",
      subtitle:
        "Teile dein Video mit {products} und erhalte eine garantierte Belohnung.",
      ctaUpload: "Video hochladen",
      ctaGoToForm: "Zum Formular",
      ctaRules: "Regeln ansehen",
      dismiss: "Nicht jetzt",
      modalTitle: "#ShareBlaze Einreichung",
      fieldPlatform: "Plattform",
      fieldHandle: "Benutzername/Handle (opt.)",
      fieldLink: "Videolink (falls öffentlich)",
      or: "oder",
      fieldFile: "Datei hochladen (MP4, MOV, max. 200MB)*",
      rewardTitle: "Wähle deine Belohnung*",
      r1: "Kostenloses Produkt",
      r2: "10 € Rückerstattung",
      r3: "10 € Gutschein",
      agree:
        "Ich habe die Programmregeln gelesen und akzeptiere sie (innerhalb von 7 Tagen nach Lieferung; authentische, konforme Inhalte).",
      submit: "Senden",
      required: "Mit * markierte Felder sind Pflichtfelder.",
      success: "Danke! Wir haben deinen Beitrag erhalten.",
      errPlatform: "Bitte eine Plattform wählen.",
      errReward: "Bitte eine Belohnung wählen.",
      errLinkOrFile: "Bitte Link angeben oder Datei hochladen.",
    },
    es: {
      title: "#ShareBlaze",
      subtitle:
        "Comparte tu video con {products} y recibe una recompensa garantizada.",
      ctaUpload: "Sube tu video",
      ctaGoToForm: "Ir al formulario",
      ctaRules: "Ver reglas",
      dismiss: "Ahora no",
      modalTitle: "Envío #ShareBlaze",
      fieldPlatform: "Plataforma",
      fieldHandle: "Usuario/Handle (op.)",
      fieldLink: "Enlace del video (si es público)",
      or: "o",
      fieldFile: "Sube un archivo (MP4, MOV, máx. 200MB)*",
      rewardTitle: "Elige tu recompensa*",
      r1: "Producto gratuito",
      r2: "Reembolso de 10 €",
      r3: "Cupón de 10 €",
      agree:
        "He leído y acepto las reglas del programa (dentro de 7 días desde la entrega; contenido auténtico y conforme).",
      submit: "Enviar",
      required: "Los campos marcados con * son obligatorios.",
      success: "¡Gracias! Hemos recibido tu envío.",
      errPlatform: "Selecciona una plataforma.",
      errReward: "Selecciona una recompensa.",
      errLinkOrFile: "Añade un enlace o sube un archivo.",
    },
    pl: {
      title: "#ShareBlaze",
      subtitle:
        "Udostępnij swój film z {products} i otrzymaj gwarantowaną nagrodę.",
      ctaUpload: "Prześlij wideo",
      ctaGoToForm: "Przejdź do formularza",
      ctaRules: "Zobacz zasady",
      dismiss: "Nie teraz",
      modalTitle: "Zgłoszenie #ShareBlaze",
      fieldPlatform: "Platforma",
      fieldHandle: "Nazwa/Handle (opc.)",
      fieldLink: "Link do wideo (jeśli publiczne)",
      or: "albo",
      fieldFile: "Prześlij plik (MP4, MOV, maks. 200MB)*",
      rewardTitle: "Wybierz nagrodę*",
      r1: "Darmowy produkt",
      r2: "Zwrot 10 €",
      r3: "Kupon 10 €",
      agree:
        "Przeczytałem(-am) i akceptuję zasady programu (do 7 dni od dostawy; treści autentyczne i zgodne).",
      submit: "Wyślij",
      required: "Pola oznaczone * są obowiązkowe.",
      success: "Dziękujemy! Otrzymaliśmy Twoje zgłoszenie.",
      errPlatform: "Wybierz platformę.",
      errReward: "Wybierz nagrodę.",
      errLinkOrFile: "Dodaj link lub prześlij plik.",
    },
  };

  const T = i18n[lang] || i18n.it;
  const keyLS = (orderId) => `kblz_shareblaze_dismissed_${orderId || "none"}`;

  let dismissed = false;
  let showModal = false;

  // form state
  let platform = "";
  let handle = "";
  let link = "";
  let file = null;
  let reward = "";
  let agree = false;

  let successMsg = "";
  let errorMsg = "";

  onMount(() => {
    const saved = localStorage.getItem(keyLS(orderId));
    dismissed = saved === "1";
  });

  function dismiss() {
    dismissed = true;
    localStorage.setItem(keyLS(orderId), "1");
    dispatch("dismissed", { orderId });
  }

  function openModal() {
    showModal = true;
    successMsg = "";
    errorMsg = "";
  }

  function closeModal() {
    showModal = false;
  }

  function validate() {
    if (!platform) return T.errPlatform;
    if (!reward) return T.errReward;
    if (!link && !file) return T.errLinkOrFile;
    if (!agree) return T.errReward; // overload: costringe a leggere regole
    return "";
  }

  async function submitForm() {
    errorMsg = validate();
    if (errorMsg) return;

    // costruiamo payload e lo passiamo al parent
    const payload = {
      orderId,
      platform,
      handle: handle?.trim() || null,
      link: link?.trim() || null,
      // file: passiamo il File object, sarà il parent a gestire l'upload
      file,
      reward,
      lang,
      hashtag: "#ShareBlaze",
      ts: Date.now(),
    };

    dispatch("submit", payload);

    // opzionale: chiudi e mostra successo
    successMsg = T.success;
    // reset solo campi non-critici
    platform = "";
    handle = "";
    link = "";
    file = null;
    reward = "";
    agree = false;
    setTimeout(() => {
      showModal = false;
    }, 800);
  }

  function platformsLabel(p) {
    return p;
  }
</script>

{#if isEligible && !dismissed}
  <div class="box shareblaze-banner" class:compact>
    <div class="columns is-variable is-1 is-vcentered is-multiline">
      <div class="column is-narrow mb-3">
        <span class="tag is-danger is-light is-medium">#ShareBlaze</span>
      </div>

      <div class="column body-col is-12-mobile is-7-tablet is-7-desktop">
        <h3 class="title is-5 m-0">{T.title}</h3>
        <p class="subtitle is-6 mt-1">
          {@html T.subtitle.replace("{products}", products.join(" & "))}
        </p>

        <div class="tags mt-2">
          {#each showPlatforms as p}
            <span class="tag is-light">{platformsLabel(p)}</span>
          {/each}
        </div>
      </div>

      <div
        class="column actions-col is-12-mobile has-text-right-tablet mt-5"
      >
        <div
          class="buttons is-right is-flex is-flex-wrap-wrap is-justify-content-flex-start is-justify-content-flex-end-tablet"
        >
          {#if uploadUrl}
          <!--  <a class="button is-primary" href={uploadUrl}>{T.ctaGoToForm}</a>-->
            <button class="button is-info is-light" on:click={openModal}
              >{T.ctaUpload}</button
            >
          {:else}
            <button class="button is-primary" on:click={openModal}
              >{T.ctaUpload}</button
            >
          {/if}
          <button
            class="button is-white is-light"
            on:click={() => dispatch("rules")}>{T.ctaRules}</button
          >
          <!--<button class="button is-text" on:click={dismiss}>{T.dismiss}</button>-->
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Modal -->
<div class={"modal " + (showModal ? "is-active" : "")}>
  <div class="modal-background" on:click={closeModal}></div>
  <div class="modal-card">
    <header class="modal-card-head">
      <p class="modal-card-title">{T.modalTitle}</p>
      <button class="delete" aria-label="close" on:click={closeModal}></button>
    </header>
    <section class="modal-card-body">
      {#if errorMsg}
        <div class="notification is-danger is-light">{errorMsg}</div>
      {/if}
      {#if successMsg}
        <div class="notification is-success is-light">{successMsg}</div>
      {/if}

      <div class="field">
        <label class="label">{T.fieldPlatform}*</label>
        <div class="control">
          <div class="select is-fullwidth">
            <select bind:value={platform}>
              <option value="" disabled selected>—</option>
              {#each showPlatforms as p}
                <option value={p}>{platformsLabel(p)}</option>
              {/each}
            </select>
          </div>
        </div>
      </div>

      <div class="field">
        <label class="label">{T.fieldHandle}</label>
        <div class="control">
          <input
            class="input"
            type="text"
            bind:value={handle}
            placeholder="@tuo_handle"
          />
        </div>
      </div>

      <div class="field">
        <label class="label">{T.fieldLink}</label>
        <div class="control">
          <input
            class="input"
            type="url"
            bind:value={link}
            placeholder="https://…"
          />
        </div>
      </div>

      <div class="has-text-centered my-2"><em>{T.or}</em></div>

      <div class="field">
        <label class="label">{T.fieldFile}</label>
        <div class="file has-name is-fullwidth">
          <label class="file-label">
            <input
              class="file-input"
              type="file"
              accept=".mp4,.mov,video/*"
              on:change={(e) => {
                file = e.target.files?.[0] || null;
              }}
            />
            <span class="file-cta">
              <span class="file-icon">🎥</span>
              <span class="file-label">Browse…</span>
            </span>
            <span class="file-name">{file ? file.name : "—"}</span>
          </label>
        </div>
      </div>

      <div class="field">
        <label class="label">{T.rewardTitle}</label>
        <div class="control">
          <div class="select is-fullwidth">
            <select bind:value={reward}>
              <option value="" disabled selected>—</option>
              <option value="gift">{T.r1}</option>
              <option value="chargeback_10">{T.r2}</option>
              <option value="coupon_10">{T.r3}</option>
            </select>
          </div>
        </div>
      </div>

      <p class="help">{T.required}</p>

      <div class="field mt-3">
        <label class="checkbox">
          <input type="checkbox" bind:checked={agree} />
          <span class="ml-2">{T.agree}</span>
        </label>
      </div>
    </section>
    <footer class="modal-card-foot">
      <button class="button is-primary" on:click={submitForm}>{T.submit}</button
      >
      <button class="button" on:click={closeModal}>Close</button>
    </footer>
  </div>
</div>

<style>
  .shareblaze-banner.compact {
    padding: 0.75rem 1rem;
  }
  .shareblaze-banner .title.m-0 {
    margin: 0;
  }
  .shareblaze-banner .buttons .button.is-text {
    color: #7a7a7a;
  }
  .modal-card {
    max-width: 720px;
    width: calc(100% - 2rem);
  }

  .shareblaze-banner {
    overflow: hidden;
  }
  .shareblaze-banner .columns {
    gap: 0.75rem;
  }

  /* Evita che la colonna testo diventi troppo stretta su desktop */
  .shareblaze-banner .body-col {
    min-width: 320px;
  }

  /* Spazio verticale fra bottoni quando vanno a capo */
  .shareblaze-banner .actions-col .buttons > .button {
    margin-bottom: 0.5rem;
  }

  /* Su tablet+ riallinea i bottoni a destra */
  @media screen and (min-width: 769px) {
    .shareblaze-banner .actions-col .buttons {
      justify-content: flex-end;
    }
  }
</style>
