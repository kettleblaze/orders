// rollup.config.js
import { config } from "dotenv";
import svelte from "rollup-plugin-svelte";
import replace from "@rollup/plugin-replace";
import strip from "@rollup/plugin-strip";
import resolve from "@rollup/plugin-node-resolve";
import scss from "svelte-preprocess";
import commonjs from "rollup-plugin-commonjs";
import css from "rollup-plugin-css-only";
import json from "@rollup/plugin-json";
import { svelteSVG } from "rollup-plugin-svelte-svg";
import terser from "@rollup/plugin-terser";
import jscc from "rollup-plugin-jscc";
let plugins = [];
let cfg = {};
/*
if (process.env.HUGO_ENV !== "development") {
  plugins = plugins.concat(terser());
  config().parsed;
  cfg.PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID_PRODUCTION;
  cfg.GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
} else {
  cfg = config().parsed;
}
*/
const preOrdersApp = {
  input: "./themes/orders/assets/js/apps/preorders/main.js",
  output: {
    name: "preOrdersApp",
    file: "themes/orders/assets/js/compiled/preorders-app.js",
    format: "iife",
    plugins,
  },
  plugins: [
    /* commonjs({
      namedExports: {
        "svelte-i18n": ["register", "_", "getLocaleFromNavigator"],
      },
    }),*/
    json(),
    svelteSVG(),
    replace({
      //preventAssignment: true,
      "process.env.isLocal": JSON.stringify(
        process.env.HUGO_ENV === "development" ? true : false
      ),
    }),
    svelte({
      // preprocess: [],
      // Optionally, preprocess components with svelte.preprocess:
      // https://svelte.dev/docs#svelte_preprocess
      /*preprocess: {
        style: ({ content }) => {
          return transformStyles(content);
        }
      },*/

      // Emit CSS as "files" for other plugins to process. default is true
      emitCss: false,

      // Warnings are normally passed straight to Rollup. You can
      // optionally handle them here, for example to squelch
      // warnings with a particular code
      onwarn: (warning, handler) => {
        // e.g. don't warn on <marquee> elements, cos they're cool
        if (warning.code === "a11y-distracting-elements") return;

        // let Rollup handle all other warnings normally
        handler(warning);
      },

      // You can pass any of the Svelte compiler options
      compilerOptions: {
        // ensure that extra attributes are added to head
        // elements for hydration (used with generate: 'ssr')
        hydratable: false,

        // You can optionally set 'customElement' to 'true' to compile
        // your components to custom elements (aka web elements)
        customElement: false,
      },
    }),
    // see NOTICE below
    resolve({
      browser: true,
      exportConditions: ["svelte"],
      extensions: [".svelte"],
    }),

    //css({ output: "product-page-price-app.css" }),
  ],
};

if (process.env.HUGO_ENV !== "development") {
  const stripConsole = strip({
    include: ["**/*.js", "**/*.svelte"],
    functions: ["console.*"],
  });

  const minify = terser();

  preOrdersApp.plugins.push(stripConsole);
  preOrdersApp.plugins.push(minify);
}

export default [preOrdersApp];
