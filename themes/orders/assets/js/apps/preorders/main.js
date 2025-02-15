import { mount } from "svelte";
import ReviewPage from "./components/ReviewPage.svelte";

let reviewPageApp = mount(ReviewPage, {
  target: document.getElementById("review-page-app"),
   
});

export default reviewPageApp;
