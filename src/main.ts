import { invoke } from "@tauri-apps/api/tauri";

let greetInputEl: HTMLInputElement | null;
let greetMsgEl: HTMLElement | null;

let pidInputEl: HTMLInputElement | null;
let killBtnEl: HTMLElement | null;
let stopBtnEl: HTMLElement | null;
let contBtnEl: HTMLElement | null;

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
    console.log("invoking test");
    const list = await invoke("send_process_signal", { pid: "122780" });
    console.log(list);
  }
}

async function getRunningProcesses() {
  const list = await invoke("read_running_processes", {});

  console.log(list);

  setTimeout(getRunningProcesses, 1000);
}

async function sendSignal(signal: string) {
  if (pidInputEl && killBtnEl && stopBtnEl && contBtnEl) {
    console.log("sending signal", pidInputEl.value, signal);
    const list = await invoke("send_process_signal", {
      pid: pidInputEl.value,
      signal: signal,
    });
    console.log(list);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  greetInputEl = document.querySelector("#greet-input");
  greetMsgEl = document.querySelector("#greet-msg");
  document.querySelector("#greet-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    greet();
  });

  getRunningProcesses();

  testMsgEl = document.querySelector("#test-msg");
  document.querySelector("#test-btn")?.addEventListener("click", (e) => {
    console.log("submitting");
    e.preventDefault();
    test();
  });

  pidInputEl = document.querySelector("#pid-input");
  killBtnEl = document.querySelector("#kill-btn");
  stopBtnEl = document.querySelector("#stop-btn");
  contBtnEl = document.querySelector("#cont-btn");
  document.querySelector("#kill-btn")?.addEventListener("click", (e) => {
    e.preventDefault();
    sendSignal("KILL");
  });

  document.querySelector("#stop-btn")?.addEventListener("click", (e) => {
    e.preventDefault();
    sendSignal("STOP");
  });

  document.querySelector("#cont-btn")?.addEventListener("click", (e) => {
    e.preventDefault();
    sendSignal("CONT");
  });
});
