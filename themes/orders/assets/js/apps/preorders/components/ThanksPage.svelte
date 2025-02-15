<script>
  import { onMount } from "svelte";

  let lingua = "it";

  const traduzioni = {
    it: {
      thankYou: "Grazie per la tua recensione!",
      message:
        "Il tuo feedback ci aiuta a migliorare e a offrire un servizio migliore. Grazie per il tuo tempo!",
      backToHome: "Torna alla home",
    },
    en: {
      thankYou: "Thank you for your review!",
      message:
        "Your feedback helps us improve and provide better service. Thank you for your time!",
      backToHome: "Back to Home",
    },
  };

  function getLangFromQueryString() {
    const params = new URLSearchParams(window.location.search);
    const langParam = params.get("lang");
    if (langParam && traduzioni[langParam]) {
      lingua = langParam;
    }
  }

  function scrollToCenter() {
    setTimeout(() => {
      window.scrollTo({
        top: document.body.scrollHeight / 2 - window.innerHeight / 2,
        behavior: "smooth",
      });
    }, 100);
  }

  onMount(() => {
    getLangFromQueryString();
    scrollToCenter();
  });
</script>

<div class="thank-you-container">
  <h1 class="thank-you-title">{traduzioni[lingua].thankYou}</h1>
  <p class="thank-you-message">{traduzioni[lingua].message}</p>
  <a href="https://kettleblaze.store" class="button">{traduzioni[lingua].backToHome}</a>
</div>
