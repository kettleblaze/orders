<script>
  import { onMount } from "svelte";
  import ThanksPage from "./ThanksPage.svelte";

  let nome = "";
  let email = "";
  let rating = "5";
  let recensione = "";
  let ordine = "";
  let messaggio = "";
  let showFeedbackPrompt = false;
  let showSecondFeedbackPrompt = false;
  let isLoading = false;
  let lingua = "it";
  let complete = false;

  const traduzioni = {
    it: {
      leaveReview: "Lascia una recensione",
      feedbackMessage:
        "Il tuo feedback è prezioso per noi e per i futuri clienti.",
      name: "Nome",
      email: "Email (opzionale, non verrà pubblicata)",
      orderNumber: "Numero ordine",
      required: "*",
      rating: "Valutazione",
      reviewPlaceholder: "Scrivi la tua esperienza...",
      submitReview: "Invia recensione",
      thankYou: "Grazie per la tua recensione!",
      errorMessage: "Si è verificato un errore. Riprova più tardi.",
      connectionError:
        "Errore di connessione. Controlla la tua rete e riprova.",
      helpPrompt: "Possiamo aiutarti?",
      helpMessage:
        "Se hai avuto un'esperienza non completamente soddisfacente, siamo qui per risolvere qualsiasi problema. Contattaci e troveremo una soluzione adatta a te!",
      reminderPrompt: "Siamo a tua disposizione!",
      reminderMessage:
        "Se c’è stato qualcosa che non ha soddisfatto le tue aspettative, contattaci e faremo del nostro meglio per risolvere la situazione.",
      gotIt: "Capito!",
    },
    en: {
      leaveReview: "Leave a Review",
      feedbackMessage: "Your feedback is valuable to us and future customers.",
      name: "Name",
      email: "Email (optional, will not be published)",
      orderNumber: "Order Number",
      required: "*",
      rating: "Rating",
      reviewPlaceholder: "Write your experience...",
      submitReview: "Submit Review",
      thankYou: "Thank you for your review!",
      errorMessage: "An error occurred. Please try again later.",
      connectionError: "Connection error. Check your network and try again.",
      helpPrompt: "Can we help you?",
      helpMessage:
        "If you had a less than satisfactory experience, we are here to resolve any issues. Contact us and we will find a solution for you!",
      reminderPrompt: "We are here for you!",
      reminderMessage:
        "If something didn’t meet your expectations, contact us and we will do our best to resolve the situation.",
      gotIt: "Got it!",
    },
  };

  function getLangFromQueryString() {
    const params = new URLSearchParams(window.location.search);
    const langParam = params.get("lang");
    if (langParam && traduzioni[langParam]) {
      lingua = langParam;
    }
  }

  function getParamsFromQueryString() {
    const params = new URLSearchParams(window.location.search);
    const langParam = params.get("lang");
    if (langParam && traduzioni[langParam]) {
      lingua = langParam;
    }

    const orderParam = params.get("order");
    if (orderParam) {
      ordine = orderParam;
    }
  }

  function checkRating() {
    if (parseInt(rating) <= 3) {
      showFeedbackPrompt = true;
    }
  }

  async function submitReview() {
    if (!rating || !recensione.trim() || !ordine.trim()) {
      messaggio = traduzioni[lingua].errorMessage;
      return; 
    }

    if (parseInt(rating) <= 3 && !showSecondFeedbackPrompt) {
      showSecondFeedbackPrompt = true;
      return;
    }

    isLoading = true;
    await fetch(
      "https://kettleblaze-store-server.fly.dev/save-discord-review",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nome,
          email,
          rating,
          review: recensione,
          orderId: ordine,
        }),
      }
    )
      .then((r) => {
        if (r.ok) {
          complete = true;
          isLoading = false;
          nome = "";
          email = "";
          rating = "5";
          recensione = "";
          ordine = "";
        } else {
          complete = false;
          isLoading = false;
          messaggio = traduzioni[lingua].errorMessage;
        }
      })
      .catch((e) => {
        complete = false;
        isLoading = false;
        messaggio = traduzioni[lingua].errorMessage;
      });
  }

  onMount(() => {
    getParamsFromQueryString();
  });
</script>

{#if !complete}
  <section class="section">
    <div class="container">
      <h1 class="title has-text-centered">{traduzioni[lingua].leaveReview}</h1>
      <p class="subtitle has-text-centered mt-3 mb-5">
        {traduzioni[lingua].feedbackMessage}
      </p>
      <div class="box">
        <div class="field">
          <label class="label">{traduzioni[lingua].name}</label>
          <div class="control">
            <input
              class="input"
              type="text"
              bind:value={nome}
              placeholder={traduzioni[lingua].name}
            />
          </div>
        </div>
        <div class="field">
          <label class="label">{traduzioni[lingua].email}</label>
          <div class="control">
            <input
              class="input"
              type="email"
              bind:value={email}
              placeholder={traduzioni[lingua].email}
            />
          </div>
        </div>
        <div class="field">
          <label class="label"
            >{traduzioni[lingua].orderNumber}
            <span class="has-text-danger">{traduzioni[lingua].required}</span
            ></label
          >
          <div class="control">
            <input
              class="input"
              type="text"
              bind:value={ordine}
              placeholder={traduzioni[lingua].orderNumber}
            />
          </div>
        </div>
        <div class="field">
          <label class="label"
            >{traduzioni[lingua].rating}
            <span class="has-text-danger">{traduzioni[lingua].required}</span
            ></label
          >
          <div class="control">
            <div class="select">
              <select bind:value={rating} on:change={checkRating}>
                <option value="5" selected>⭐⭐⭐⭐⭐</option>
                <option value="4">⭐⭐⭐⭐</option>
                <option value="3">⭐⭐⭐</option>
                <option value="2">⭐⭐</option>
                <option value="1">⭐</option>
              </select>
            </div>
          </div>
        </div>
        <div class="field">
          <label class="label"
            >{traduzioni[lingua].reviewPlaceholder}
            <span class="has-text-danger">{traduzioni[lingua].required}</span
            ></label
          >
          <div class="control">
            <textarea
              class="textarea"
              bind:value={recensione}
              placeholder={traduzioni[lingua].reviewPlaceholder}
              rows="5"
            ></textarea>
          </div>
        </div>
        <div class="field">
          <div class="control">
            <button
              class="button is-primary"
              on:click={submitReview}
              disabled={isLoading}
            >
              {#if isLoading}
                <span class="loader"></span>
              {:else}
                {traduzioni[lingua].submitReview}
              {/if}
            </button>
          </div>
        </div>
        {#if messaggio}
          <p class="has-text-centered has-text-weight-bold">{messaggio}</p>
        {/if}
      </div>
    </div>
  </section>

  <div
    class="modal-overlay {showFeedbackPrompt ? 'show' : ''}"
    on:click={() => (showFeedbackPrompt = false)}
  >
    <div class="feedback-modal">
      <h2>{traduzioni[lingua].helpPrompt}</h2>
      <p>{traduzioni[lingua].helpMessage}</p>
      <button
        class="button is-primary"
        on:click={() => (showFeedbackPrompt = false)}
        >{traduzioni[lingua].gotIt}</button
      >
    </div>
  </div>

  <div
    class="modal-overlay {showSecondFeedbackPrompt ? 'show' : ''}"
    on:click={() => () => (showSecondFeedbackPrompt = false)}
  >
    <div class="feedback-modal">
      <h2>{traduzioni[lingua].reminderPrompt}</h2>
      <p>{traduzioni[lingua].reminderMessage}</p>
      <button
        class="button is-primary"
        on:click={() => (showSecondFeedbackPrompt = false)}
        >{traduzioni[lingua].gotIt}</button
      >
    </div>
  </div>
{:else}<ThanksPage></ThanksPage>{/if}
