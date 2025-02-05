import dotenv from "dotenv";
dotenv.config();

(async () => {
  let sessionId = process.argv[2];
  console.log(`Invio email per ${sessionId}`);
  await fetch(`http://localhost:8080/send-confirmation-email/${sessionId}`);
})();
