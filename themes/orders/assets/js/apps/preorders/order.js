import { mount } from "svelte";
import PreOrderApp2 from "./components/PreOrder2.svelte";

let preOrderApp2 = mount(PreOrderApp2, {
  target: document.getElementById("preorder-app"),
});

export default preOrderApp2;
