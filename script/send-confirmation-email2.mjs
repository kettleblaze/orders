import dotenv from "dotenv";
dotenv.config();

(async () => {
  let orderId = process.argv[2];
  console.log(`Invio email per ${orderId}`);
  await fetch(`http://localhost:8080/send-confirmation-email-2/${orderId}`);
})();
