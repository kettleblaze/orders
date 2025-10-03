<script>
  import { createEventDispatcher, onMount } from "svelte";

  // ====== Props ======
  export let lang;
  export let orderId = ""; // usato per persistenza localStorage
  export let order;
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

  let hideSuccessOverlay = false;
  const dispatch = createEventDispatcher();
 
  const i18n = {
    it: {
      title: "#ShareBlaze",
      subtitle:
        "Condividi il tuo video con {products} e ricevi una ricompensa garantita.",
      ctaUpload: "Carica il tuo video",
      ctaGoToForm: "Vai al modulo",
      ctaRules: "Leggi le regole",
      urlRules:
        "https://kettleblaze.store/en/blog/shareblaze-referral-kettlebell-magnetix-flexibell2",
      dismiss: "Non ora",
      modalTitle: "Invia contributo #ShareBlaze",
      fieldPlatform: "Piattaforma",
      fieldHandle: "Username/Handle (opz.)",
      fieldLink: "Link del video (se pubblico)",
      or: "oppure",
      fieldFile: "Carica il file (MP4, MOV, max 200MB)*",
      rewardTitle: "Scegli la tua ricompensa*",
      r1: "Prodotto omaggio",
      r2: "Chargeback di 5€",
      r3: "Coupon sconto 10€",
      agree:
        "Ho letto e accetto le regole del programma (entro 7 giorni dalla consegna, contenuti autentici e conformi).",
      submit: "Invia",
      required: "I campi contrassegnati con * sono obbligatori.",
      success: "Grazie! Abbiamo ricevuto il tuo contributo.",
      errPlatform: "Seleziona una piattaforma.",
      errReward: "Seleziona una ricompensa.",
      errLinkOrFile: "Inserisci un link oppure carica un file.",
      errChosenGift: "Non hai scelto il tuo omaggio!",
      upload_confirmation: "Video caricato correttamente!",
      upload_greetings:
        'Hai già caricato il tuo video in data {date}: grazie!!<br>Hai scelto come ricompensa: {chosenReward}.<br><ol class="is-size-6 mt-4 px-4" type="1"><li>Se si tratta di un prodotto omaggio verrà spedito a breve.</li><li> Se un coupon, lo riceverai a breve via email</li><li>Se invece è un chargeback verrà emesso a breve e entro pochi giorni lo vedrai accreditato nel metodo di pagamento utilizzato in questo ordine.</li></ol>',
      upload: "Carica",
      blazebands: "i polsini BlazeBands",
      hexapad: "l'HexaPad",
      t_shirt: "la t-shirt con logo kettleblaze",
      gymdry: "la salvietta da palestra GymDry",
      chargeback: "il chargeback da € 5,00",
      coupon: "il coupon da € 10,00",
    },

    en: {
      title: "#ShareBlaze",
      subtitle: "Share your video with {products} and get a guaranteed reward.",
      ctaUpload: "Upload your video",
      ctaGoToForm: "Go to the form",
      ctaRules: "Read the rules",
      urlRules:
        "https://kettleblaze.store/en/blog/shareblaze-referral-kettlebell-magnetix-flexibell2",
      dismiss: "Not now",
      modalTitle: "Send your #ShareBlaze submission",
      fieldPlatform: "Platform",
      fieldHandle: "Username/Handle (opt.)",
      fieldLink: "Video link (if public)",
      or: "or",
      fieldFile: "Upload file (MP4, MOV, max 200MB)*",
      rewardTitle: "Choose your reward*",
      r1: "Free gift",
      r2: "€5 chargeback",
      r3: "€10 discount coupon",
      agree:
        "I have read and accept the program rules (within 7 days of delivery, authentic and compliant content).",
      submit: "Send",
      required: "Fields marked with * are required.",
      success: "Thanks! We’ve received your submission.",
      errPlatform: "Select a platform.",
      errReward: "Select a reward.",
      errLinkOrFile: "Enter a link or upload a file.",
      errChosenGift: "You haven’t chosen your free gift!",
      upload_confirmation: "Video successfully uploaded!",
      upload_greetings:
        'You already uploaded your video on {date}: thank you!!<br>You chose as your reward: {chosenReward}.<br><ol class="is-size-6 mt-4 px-4" type="1"><li>If it’s a free product, it will be shipped soon.</li><li>If it’s a coupon, you’ll receive it by email shortly.</li><li>If it’s a chargeback, it will be issued soon and within a few days you’ll see it credited to the payment method used for this order.</li></ol>',
      upload: "Upload",
      blazebands: "BlazeBands wristbands",
      hexapad: "HexaPad",
      t_shirt: "Kettleblaze logo T-shirt",
      gymdry: "GymDry workout towel",
      chargeback: "the € 5.00 chargeback",
      coupon: "the € 10.00 coupon",
    },

    fr: {
      title: "#ShareBlaze",
      subtitle:
        "Partage ta vidéo avec {products} et reçois une récompense garantie.",
      ctaUpload: "Envoie ta vidéo",
      ctaGoToForm: "Accéder au formulaire",
      ctaRules: "Lire les règles",
      urlRules:
        "https://kettleblaze.store/en/blog/shareblaze-referral-kettlebell-magnetix-flexibell2",
      dismiss: "Pas maintenant",
      modalTitle: "Envoyer ta contribution #ShareBlaze",
      fieldPlatform: "Plateforme",
      fieldHandle: "Nom d’utilisateur/Handle (facult.)",
      fieldLink: "Lien de la vidéo (si publique)",
      or: "ou",
      fieldFile: "Importer le fichier (MP4, MOV, 200 Mo max)*",
      rewardTitle: "Choisis ta récompense*",
      r1: "Cadeau gratuit",
      r2: "Remboursement de 5 €",
      r3: "Coupon de réduction de 10 €",
      agree:
        "J’ai lu et j’accepte le règlement du programme (dans les 7 jours suivant la livraison, contenus authentiques et conformes).",
      submit: "Envoyer",
      required: "Les champs marqués d’un * sont obligatoires.",
      success: "Merci ! Nous avons bien reçu ta contribution.",
      errPlatform: "Sélectionne une plateforme.",
      errReward: "Sélectionne une récompense.",
      errLinkOrFile: "Saisis un lien ou importe un fichier.",
      errChosenGift: "Tu n’as pas choisi ton cadeau !",
      upload_confirmation: "Vidéo importée avec succès !",
      upload_greetings:
        'Tu as déjà téléversé ta vidéo le {date} : merci !!<br>Tu as choisi comme récompense : {chosenReward}.<br><ol class="is-size-6 mt-4 px-4" type="1"><li>S’il s’agit d’un produit cadeau, il sera expédié prochainement.</li><li>S’il s’agit d’un coupon, tu le recevras bientôt par e-mail.</li><li>S’il s’agit d’un remboursement, il sera émis prochainement et, sous quelques jours, tu le verras crédité sur le moyen de paiement utilisé pour cette commande.</li></ol>',
      upload: "Téléverser",
      blazebands: "les bracelets de poignet BlazeBands",
      hexapad: "l’HexaPad",
      t_shirt: "le T-shirt logo Kettleblaze",
      gymdry: "la serviette de sport GymDry",
      chargeback: "le remboursement de 5,00 €",
      coupon: "le coupon de 10,00 €",
    },

    de: {
      title: "#ShareBlaze",
      subtitle:
        "Teile dein Video mit {products} und erhalte eine garantierte Belohnung.",
      ctaUpload: "Dein Video hochladen",
      ctaGoToForm: "Zum Formular",
      ctaRules: "Regeln lesen",
      urlRules:
        "https://kettleblaze.store/en/blog/shareblaze-referral-kettlebell-magnetix-flexibell2",
      dismiss: "Nicht jetzt",
      modalTitle: "Deinen #ShareBlaze-Beitrag senden",
      fieldPlatform: "Plattform",
      fieldHandle: "Benutzername/Handle (optional)",
      fieldLink: "Videolink (falls öffentlich)",
      or: "oder",
      fieldFile: "Datei hochladen (MP4, MOV, max. 200 MB)*",
      rewardTitle: "Wähle deine Belohnung*",
      r1: "Gratisprodukt",
      r2: "Rückerstattung von 5 €",
      r3: "Gutschein über 10 €",
      agree:
        "Ich habe die Programmregeln gelesen und akzeptiere sie (innerhalb von 7 Tagen nach Lieferung, authentische und konforme Inhalte).",
      submit: "Senden",
      required: "Mit * markierte Felder sind Pflichtfelder.",
      success: "Danke! Wir haben deinen Beitrag erhalten.",
      errPlatform: "Plattform auswählen.",
      errReward: "Belohnung auswählen.",
      errLinkOrFile: "Link angeben oder Datei hochladen.",
      errChosenGift: "Du hast dein Gratisgeschenk nicht ausgewählt!",
      upload_confirmation: "Video erfolgreich hochgeladen!",
      upload_greetings:
        'Du hast dein Video bereits am {date} hochgeladen: danke!!<br>Als Belohnung hast du gewählt: {chosenReward}.<br><ol class="is-size-6 mt-4 px-4" type="1"><li>Handelt es sich um ein Gratisprodukt, wird es in Kürze versendet.</li><li>Ist es ein Gutschein, erhältst du ihn bald per E-Mail.</li><li>Bei einer Rückerstattung wird diese zeitnah veranlasst und innerhalb weniger Tage auf die für diese Bestellung verwendete Zahlungsmethode gutgeschrieben.</li></ol>',
      upload: "Hochladen",
      blazebands: "BlazeBands-Handgelenkbänder",
      hexapad: "HexaPad",
      t_shirt: "Kettleblaze Logo-T-Shirt",
      gymdry: "GymDry Trainingshandtuch",
      chargeback: "die Rückerstattung von 5,00 €",
      coupon: "den Gutschein über 10,00 €",
    },

    es: {
      title: "#ShareBlaze",
      subtitle:
        "Comparte tu vídeo con {products} y recibe una recompensa garantizada.",
      ctaUpload: "Sube tu vídeo",
      ctaGoToForm: "Ir al formulario",
      ctaRules: "Leer las reglas",
      urlRules:
        "https://kettleblaze.store/en/blog/shareblaze-referral-kettlebell-magnetix-flexibell2",
      dismiss: "Ahora no",
      modalTitle: "Enviar contribución #ShareBlaze",
      fieldPlatform: "Plataforma",
      fieldHandle: "Usuario/Handle (opc.)",
      fieldLink: "Enlace del vídeo (si es público)",
      or: "o",
      fieldFile: "Sube el archivo (MP4, MOV, máx. 200 MB)*",
      rewardTitle: "Elige tu recompensa*",
      r1: "Producto de regalo",
      r2: "Reembolso de 5 €",
      r3: "Cupón de 10 €",
      agree:
        "He leído y acepto las reglas del programa (dentro de 7 días desde la entrega, contenido auténtico y conforme).",
      submit: "Enviar",
      required: "Los campos marcados con * son obligatorios.",
      success: "¡Gracias! Hemos recibido tu contribución.",
      errPlatform: "Selecciona una plataforma.",
      errReward: "Selecciona una recompensa.",
      errLinkOrFile: "Introduce un enlace o sube un archivo.",
      errChosenGift: "¡No has elegido tu regalo!",
      upload_confirmation: "¡Vídeo subido correctamente!",
      upload_greetings:
        'Ya subiste tu vídeo el {date}: ¡gracias!<br>Elegiste como recompensa: {chosenReward}.<br><ol class="is-size-6 mt-4 px-4" type="1"><li>Si es un producto de regalo, se enviará en breve.</li><li>Si es un cupón, lo recibirás por correo en breve.</li><li>Si es un reembolso, se emitirá en breve y en unos días lo verás abonado en el método de pago usado en este pedido.</li></ol>',
      upload: "Subir",
      blazebands: "las muñequeras BlazeBands",
      hexapad: "el HexaPad",
      t_shirt: "la camiseta con logo Kettleblaze",
      gymdry: "la toalla de gimnasio GymDry",
      chargeback: "el reembolso de 5,00 €",
      coupon: "el cupón de 10,00 €",
    },

    pl: {
      title: "#ShareBlaze",
      subtitle:
        "Udostępnij swój film z {products} i odbierz gwarantowaną nagrodę.",
      ctaUpload: "Prześlij swój film",
      ctaGoToForm: "Przejdź do formularza",
      ctaRules: "Przeczytaj zasady",
      urlRules:
        "https://kettleblaze.store/en/blog/shareblaze-referral-kettlebell-magnetix-flexibell2",
      dismiss: "Nie teraz",
      modalTitle: "Wyślij zgłoszenie #ShareBlaze",
      fieldPlatform: "Platforma",
      fieldHandle: "Nazwa użytkownika/Handle (opc.)",
      fieldLink: "Link do filmu (jeśli publiczny)",
      or: "albo",
      fieldFile: "Prześlij plik (MP4, MOV, maks. 200 MB)*",
      rewardTitle: "Wybierz nagrodę*",
      r1: "Prezent gratis",
      r2: "Zwrot 5 €",
      r3: "Kupon rabatowy 10 €",
      agree:
        "Przeczytałem(am) i akceptuję zasady programu (do 7 dni od doręczenia, treści autentyczne i zgodne).",
      submit: "Wyślij",
      required: "Pola oznaczone * są obowiązkowe.",
      success: "Dziękujemy! Otrzymaliśmy Twoje zgłoszenie.",
      errPlatform: "Wybierz platformę.",
      errReward: "Wybierz nagrodę.",
      errLinkOrFile: "Podaj link lub prześlij plik.",
      errChosenGift: "Nie wybrałeś(aś) prezentu!",
      upload_confirmation: "Wideo zostało pomyślnie przesłane!",
      upload_greetings:
        'Już przesłałeś(aś) swój film w dniu {date}: dziękujemy!!<br>Wybrana nagroda: {chosenReward}.<br><ol class="is-size-6 mt-4 px-4" type="1"><li>Jeśli to prezent, zostanie wkrótce wysłany.</li><li>Jeśli to kupon, wkrótce otrzymasz go e-mailem.</li><li>Jeśli to zwrot, zostanie on wkrótce zrealizowany i w ciągu kilku dni pojawi się na metodzie płatności użytej w tym zamówieniu.</li></ol>',
      upload: "Prześlij",
      blazebands: "opaski nadgarstkowe BlazeBands",
      hexapad: "HexaPad",
      t_shirt: "koszulka z logo Kettleblaze",
      gymdry: "ręcznik treningowy GymDry",
      chargeback: "zwrot 5,00 €",
      coupon: "kupon 10,00 €",
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
  let chosenGift = "blazebands";
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
    document.body.style = "overflow-y:hidden;";
    if (window.tidioChatApi) {
      window.tidioChatApi.hide();
    }
    showModal = true;
    successMsg = "";
    errorMsg = "";
  }

  async function closeModal() {
    document.body.style = "overflow-y:hidden;";
    if (hasOrderVideo) {
      await deleteOrderVideo();
      hasOrderVideo = false;
    }
    showModal = false;
    if (window.tidioChatApi) {
      window.tidioChatApi.hide();
    }
  }

  function validate() {
    if (!platform) return T.errPlatform;
    if (!link) return T.errLinkOrFile;
    if (!hasOrderVideo) return T.errLinkOrFile;
    if (!reward) return T.errReward;
    if (reward === "gift") {
      if (!chosenGift) return T.errChosenGift;
    }
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
      username: handle?.trim() || null,
      video_url: link?.trim() || null,
      chosen_reward: reward === "gift" ? chosenGift : reward,
      lang: order.lang,
      accept_terms_and_condition: agree,
    };

    const r = await fetch(API_UPDATE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }).then((resp) => {
      return resp.json();
    });

    if (r) {
      // opzionale: chiudi e mostra successo
      successMsg = T.success;
      await fetchOrderVideoStatus();
      setTimeout(() => {
        showModal = false;
        setTimeout(() => {
          hideSuccessOverlay = true;
        }, 1500);
      }, 3000);
    }
    // reset solo campi non-critici
    platform = "";
    handle = "";
    link = "";
    file = null;
    reward = "";
    agree = false;
    chosenGift = "blazebands";
  }

  function platformsLabel(p) {
    return p;
  }
  // ====== UI: expand/collapse ======
  let expanded = false; // inizialmente mostra solo l'header
  const toggleExpand = () => {
    expanded = !expanded;
  };

  // 🔐 Cloudinary config —> SOSTITUISCI con i tuoi
  const CLOUD_NAME = "dnhclxe7k";
  const UPLOAD_PRESET = "ml_default"; // unsigned o signed preset già configurato
  const FOLDER = "shareblaze"; // es. "shareblaze" o "kettleblaze/shareblaze"
  const API_STATUS_URL = "https://kettleblaze-store-server.fly.dev/shareblaze-order-upload/status"; // GET ?orderId=...
  const API_SAVE_URL = "https://kettleblaze-store-server.fly.dev/shareblaze-order-upload"; // POST
  const API_UPDATE_URL = "https://kettleblaze-store-server.fly.dev/shareblaze-order-update"; // POST
  const API_DELETE_URL = "https://kettleblaze-store-server.fly.dev/shareblaze-delete-video"; // DELETE
  let hasOrderVideo = false; // 🔸 server dice se c’è già un video
  let uploadBtnEl; // se vuoi bindare il pulsante esistente
  let widget; // istanza upload widget
  let widgetReady = false;
  let isUploading = false;
  let isComplete = false;
  let chosenReward = "";
  let shareDate = null;
  async function fetchOrderVideoStatus() {
    try {
      const r = await fetch(
        `${API_STATUS_URL}?orderId=${encodeURIComponent(orderId)}`
      );
      const j = await r.json();
      hasOrderVideo = !!j?.hasVideo;
      isComplete = j?.isComplete;
      chosenReward = j?.chosenReward;
      shareDate = new Date(j?.createdAt);
    } catch (e) {
      console.warn("Impossibile leggere stato video ordine:", e);
      // fallback: lasciare hasOrderVideo = false
    }
  }

  async function deleteOrderVideo() {
    try {
      const r = await fetch(
        `${API_DELETE_URL}?orderId=${encodeURIComponent(orderId)}`,
        { method: "POST" }
      );
      const j = await r.json();
      hasOrderVideo = !!j?.hasVideo;
    } catch (e) {
      console.warn("Impossibile eliminare il video:", e);
      // fallback: lasciare hasOrderVideo = false
    }
  }

  function openUploadWidget() {
    if (hasOrderVideo) {
      alert("È già stato caricato un video per questo ordine.");
      return;
    }
    if (widgetReady && widget) widget.open();
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) return resolve();
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  // Utility: costruisco una poster frame URL per il video
  function makePosterUrl(publicId) {
    // Poster al secondo 1 (so_1) — puoi cambiare il tempo
    return `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/so_1/${publicId}.jpg`;
  }

  async function registerVideoOnServer(info) {
    const payload = {
      orderId,
      video: {
        url: info.secure_url,
        publicId: info.public_id,
        bytes: info.bytes,
        duration: info.duration,
        format: info.format,
        width: info.width,
        height: info.height,
        // poster se già usi la funzione makePosterUrl:
        // poster: makePosterUrl(info.public_id),
        tags: ["shareblaze", `order_${orderId}`, order.lang],
      },
    };

    const res = await fetch(API_SAVE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      hasOrderVideo = true; // 🔒 blocca altri upload
      return;
    }

    // gestione conflitto: server dice che esiste già
    if (res.status === 409) {
      hasOrderVideo = true; // allinea stato UI
      const j = await res.json().catch(() => ({}));
      alert(j?.message || "Esiste già un video per questo ordine.");
      return;
    }

    // altro errore
    const j = await res.json().catch(() => ({}));
    throw new Error(j?.error || "upload_register_failed");
  }

  onMount(async () => {
    await fetchOrderVideoStatus();

    if (!hasOrderVideo) {
      // 1) carico il widget in modo non bloccante
      await loadScript("https://widget.cloudinary.com/v2.0/global/all.js");

      // 2) creo il widget
      widget = window.cloudinary.createUploadWidget(
        {
          cloudName: CLOUD_NAME,
          uploadPreset: UPLOAD_PRESET,
          sources: ["local", "camera", "url"],
          multiple: false,
          resourceType: "video",
          folder: FOLDER,
          tags: ["shareblaze", `order_${orderId}`, order.lang].filter(Boolean),
          context: {
            order_id: orderId,
            source: "order-page",
            lang: order.lang,
          },
          clientAllowedFormats: ["mp4", "webm", "mov", "mkv"],
          maxFileSize: 150 * 1024 * 1024, // 150MB, regola se serve
          showPoweredBy: false,
        },
        async (error, result) => {
          if (error) {
            console.error("Cloudinary widget error:", error);
            isUploading = false;
            return;
          }
          if (result?.event === "upload-added") {
            isUploading = true;
          }
          if (result?.event === "success") {
            try {
              await registerVideoOnServer(result.info);
            } catch (e) {
              console.error(e);
              alert(
                "Errore durante il salvataggio del video. Riprova più tardi."
              );
            } finally {
              isUploading = false;
            }
          }
        }
      );

      widgetReady = true;
    }
  });

  // Handler da attaccare al tuo pulsante se puoi modificare solo l'evento:
  function handleUploadClick(e) {
    e?.preventDefault?.();
    openUploadWidget();
  }
</script>

{#if isEligible && !dismissed}
  <div class="box shareblaze-banner" class:compact class:collapsed={!expanded}>
    <!-- Toggle espansione in alto a destra -->
    <button
      class="expand-btn"
      aria-label={expanded
        ? T?.collapseLabel || "Comprimi"
        : T?.expandLabel || "Espandi"}
      aria-expanded={expanded}
      title={expanded
        ? T?.collapseLabel || "Comprimi"
        : T?.expandLabel || "Espandi"}
      on:click={toggleExpand}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <!-- chevron-down -->
        <path d="M7.41 8.41 12 13l4.59-4.59L18 9.83 12 15.83 6 9.83z"></path>
      </svg>
    </button>

    <div class="columns is-variable is-1 is-vcentered is-multiline">
      <div class="column is-narrow mb-3">
        <span class="tag is-danger is-light is-medium">#ShareBlaze</span>
      </div>
      {#if !isComplete}
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
      {/if}
      <div class="column actions-col is-12-mobile has-text-right-tablet mt-5">
        <div
          class="buttons is-right is-flex is-flex-wrap-wrap is-justify-content-flex-start is-justify-content-flex-end-tablet"
        >
          {#if !isComplete}
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
          {:else}
            <p class="mb-5">
              {@html T.upload_greetings
                .replace(
                  "{date}",
                  shareDate.toLocaleDateString("it-IT", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })
                )
                .replace("{chosenReward}", T[chosenReward])}
            </p>
          {/if}
          <button
            class="button is-white is-light"
            on:click={() => window.open(T.urlRules, "_blank")}
            >{T.ctaRules}</button
          >
          <!--<button class="button is-text" on:click={dismiss}>{T.dismiss}</button>-->
        </div>
      </div>
    </div>
  </div>
{/if}

{#if successMsg}
  <div class="success-overlay" class:hidden={hideSuccessOverlay}>
    <div class="notification is-success is-light">
      {successMsg}
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

      {#if !hasOrderVideo}
        <div class="field">
          <label class="label">{T.fieldFile}</label>
          <div class="file is-fullwidth">
            <label class="file-label">
              <input
                class="file-input"
                type="file"
                accept=".mp4,.mov,video/*"
                bind:this={uploadBtnEl}
                on:click|preventDefault={handleUploadClick}
              />
              <span class="file-cta">
                <span class="file-label">{T.upload}</span>
              </span>
            </label>
          </div>
        </div>
      {:else}
        <p class="my-5">{T.upload_confirmation}</p>
      {/if}
      <div class="field">
        <label class="label">{T.rewardTitle}</label>
        <div class="control">
          <div class="select is-fullwidth">
            <select bind:value={reward}>
              <option value="" disabled selected>—</option>
              <option value="gift">{T.r1}</option>
              <option value="chargeback">{T.r2}</option>
              <option value="coupon">{T.r3}</option>
            </select>
          </div>
        </div>
      </div>

      {#if reward === "gift"}
        <div class="field mt-3">
          <label class="label">Seleziona il tuo omaggio</label>
          <div class="control">
            <label class="radio">
              <input
                type="radio"
                bind:group={chosenGift}
                value="blazebands"
                required
              />
              Polsini BlazeBands
            </label>
          </div>
          <div class="control">
            <label class="radio">
              <input type="radio" bind:group={chosenGift} value="gymdry" />
              Salvietta GymDry
            </label>
          </div>
          <div class="control">
            <label class="radio">
              <input type="radio" bind:group={chosenGift} value="t_shirt" />
              T-Shirt Kettleblaze
            </label>
          </div>
          <div class="control">
            <label class="radio">
              <input type="radio" bind:group={chosenGift} value="hexapad" />
              HexaPad
            </label>
          </div>
        </div>
      {/if}

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
</style>
