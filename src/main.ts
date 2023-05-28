import { invoke } from "@tauri-apps/api/tauri";

let greetInputEl: HTMLInputElement | null;
let greetMsgEl: HTMLElement | null;

let testMsgEl: HTMLElement | null;

async function greet() {
  if (greetMsgEl && greetInputEl) {
    // Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
    greetMsgEl.textContent = await invoke("greet", {
      name: greetInputEl.value,
    });
  }
}

async function test() {
  if (testMsgEl) {
    console.log('invoking test');
    // testMsgEl.textContent = "Testando"
    //testMsgEl.textContent = await invoke("list_processes", {});
    const list = await invoke("send_process_signal", { pid: "122780" });
    console.log(list)
    // list.forEach((element: any) => {
    //   setTimeout(() => { testMsgEl.textContent = element.process_id }, 500);
    // });

  }
}

window.addEventListener("DOMContentLoaded", () => {
  greetInputEl = document.querySelector("#greet-input");
  greetMsgEl = document.querySelector("#greet-msg");
  document.querySelector("#greet-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    greet();
  });


  testMsgEl = document.querySelector("#test-msg");
  document.querySelector("#test-btn")?.addEventListener("click", (e) => {
    console.log("submitting")
    e.preventDefault();
    test();
  })
});
