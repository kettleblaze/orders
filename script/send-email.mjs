import dotenv from "dotenv";
dotenv.config();
import Order from "../functions/getOrder/models/order.mjs";
import mongoose from "mongoose";
import nodemailer from "nodemailer";
import fs from "node:fs";
import path from "node:path";

import * as CloudTranslate from "@google-cloud/translate";
const { Translate } = CloudTranslate.v2;

const confirmationEmailStrings = {
  title1: "Order Confirmed",
  intro1: "Gentile {CUSTOMER_NAME}, il tuo ordine è confermato!",
  text1:
    "D'ora in poi potrai seguirne i progressi dalla pagina che raggiungerai cliccando sul pulsante qui di seguito.",
  text2: "IL TUO ORDINE",
  status_text: "Stato",
};

const updateOrderEmailStrings = {
  title1: "Ordine Aggiornato",
  intro1: "Gentile {CUSTOMER_NAME}, il tuo ordine è stato aggiornato:",
  status_text: "Stato",
  text1: "IL TUO ORDINE",
};

async function connect() {
  const connection = await mongoose.connect(
    `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@us-kettleblaze-store.kkgp7uh.mongodb.net/kettleblaze_store?retryWrites=true&w=majority`
  );
  return async () => {
    return mongoose.connection.close();
  };
}

(async () => {
  const emailType = process.argv[2] ? process.argv[2] : "confirmation";

  let sessionId =
    "cs_live_b1p0xjZycuV10hEzReMANsRRdjnUSTXTp2sKPzkhzYfmIddGFMhpb0BsOI";
  let lang = "en";
  let tplName =
    emailType === "confirmation"
      ? "confirmation-email.html"
      : "update-order-email.html";

  let emailStrings =
    emailType === "confirmation"
      ? confirmationEmailStrings
      : updateOrderEmailStrings;

  const translate = new Translate({
    key: "AIzaSyCFuex1NpkEg-bF853f93g_SHhuaUCfCaQ",
  });

  const disconnect = await connect();
  const o = await Order.findOne({ stripeSessionId: sessionId });
  await disconnect();

  let [h1] = await translate.translate(emailStrings.title1, lang);
  let [i1] = await translate.translate(
    emailStrings.intro1.replace("{CUSTOMER_NAME}", o.customer.name),
    lang
  );

  let [t1] = await translate.translate(emailStrings.text1, lang);

  let [statusText] = await translate.translate(emailStrings.status_text, lang);

  let tpl = loadTpl(tplName);
  let compiled = tpl.replace("{INTRO1}", i1);
  compiled = compiled.replace("{TITLE1}", h1);
  compiled = compiled.replace("{TEXT1}", t1);

  if (emailType === "confirmation") {
    let [t2] = await translate.translate(emailStrings.text2, lang);
    compiled = compiled.replace("{TEXT2}", t2);
  }
  if (emailType === "update") {
    let [eventText] = await translate.translate(
      o.events[o.events.length - 1].data.text,
      lang
    );
    compiled = compiled.replace("{EVENT_TEXT}", eventText);
  }
  compiled = compiled.replace("{STATUS_TEXT}", statusText);
  compiled = compiled.replace(
    "{TARGET_URL}",
    `https://orders.kettleblaze.it/order?id=${o.id}`
  );
  compiled = compiled.replace("{KETTLEBLAZE_ID}", o.kettleblazeId);
  compiled = compiled.replace("{STATUS}", o.status);


  let title = `Conferma ordine ${o.kettleblazeId}`;
  if (emailType === "update") {
    title = `Aggiornamento: ordine ${o.kettleblazeId} su Kettleblaze.store`
  }
  let [translatedTitle] = await translate.translate(title, lang);
  await sendEmailTemplate(o, translatedTitle, compiled);
})();

async function sendEmailTemplate(order, title, template) {
  const transport = nodemailer.createTransport({
    host: "smtp.zoho.com",
    port: "465",
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const msg = {
    from: '"Kettleblaze" <kettleblaze@kettleblaze.store>',
    // to: order.customer.email,
    to: "kettleblaze@kettleblaze.store",
    bcc: ["kettleblaze@kettleblaze.store"],
    subject: title,
    html: template,
  };

  return transport.sendMail(msg);
}

function loadTpl(name) {
  let p = path.resolve("script", name);
  const file = fs.readFileSync(p);
  return file.toString("utf-8");
}
