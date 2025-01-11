import { mount } from "svelte";
import PreOrderApp from "./components/PreOrder.svelte";

let preOrderApp = mount(PreOrderApp, {
  target: document.getElementById("preorder-app"),
});

export default preOrderApp;
