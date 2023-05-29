import { invoke } from "@tauri-apps/api/tauri";

let greetInputEl: HTMLInputElement | null;
let greetMsgEl: HTMLElement | null;

let pidInputEl: HTMLInputElement | null;
let killBtnEl: HTMLElement | null;
let stopBtnEl: HTMLElement | null;
let contBtnEl: HTMLElement | null;
let priorityInputEl: HTMLInputElement | null;
let priorityBtnEl: HTMLElement | null;
let cpuInputEl: HTMLInputElement | null;
let cpuBtnEl: HTMLElement | null;
let processListEl: HTMLElement | null;
let filterInputEl: HTMLInputElement | null;

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
  // const list = await invoke("read_running_processes", {});
  // console.log(list);
  // setTimeout(getRunningProcesses, 1000);
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

async function setPriority() {
  if (pidInputEl && priorityInputEl && priorityBtnEl) {
    console.log("setting priority", pidInputEl.value);
    await invoke("set_process_priority", {
      pid: parseInt(pidInputEl.value),
      priority: parseInt(priorityInputEl.value),
    });
  }
}

async function setCPU() {
  if (cpuInputEl && cpuBtnEl && pidInputEl) {
    console.log("setting cpu", pidInputEl.value);
    await invoke("bind_process", {
      pid: parseInt(pidInputEl.value),
      cpu: parseInt(cpuInputEl.value),
    });
  }
}

type Process = {
  process_id: string;
  process_name: string;
  cpu_usage: number;
  memory_usage: number;
  user: string;
  threads_used: number;
};

async function renderList() {
  if (processListEl && filterInputEl) {
    const list: Process[] = await invoke("read_running_processes", {});
    processListEl.innerHTML = "";

    list
      .filter((el) =>
        filterInputEl?.value
          ? JSON.stringify(el)
              .toLowerCase()
              .includes(filterInputEl.value.toLowerCase())
          : true
      )
      .forEach((process) => {
        const row = document.createElement("tr");
        const pid = document.createElement("td");
        const name = document.createElement("td");
        const cpu = document.createElement("td");
        const memory = document.createElement("td");
        const user = document.createElement("td");
        const threads = document.createElement("td");
        const executionTime = document.createElement("td");

        pid.textContent = process.process_id;
        name.textContent = process.process_name;
        executionTime.textContent = "0";
        cpu.textContent = process.cpu_usage.toFixed(4);
        memory.textContent = process.memory_usage.toString();
        user.textContent = process.user;
        threads.textContent = process.threads_used.toString();

        row.appendChild(name);
        row.appendChild(cpu);
        row.appendChild(executionTime);
        row.appendChild(threads);
        row.appendChild(memory);

        row.appendChild(pid);
        row.appendChild(user);

        processListEl?.appendChild(row);
      });

    setTimeout(renderList, 1000);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  greetInputEl = document.querySelector("#greet-input");
  greetMsgEl = document.querySelector("#greet-msg");
  document.querySelector("#greet-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    greet();
  });

  filterInputEl = document.querySelector("#filter-input");
  processListEl = document.querySelector("#process-list");

  renderList();

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
  priorityInputEl = document.querySelector("#priority-input");
  priorityBtnEl = document.querySelector("#priority-btn");
  cpuInputEl = document.querySelector("#cpu-input");
  cpuBtnEl = document.querySelector("#cpu-btn");

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

  document.querySelector("#priority-btn")?.addEventListener("click", (e) => {
    e.preventDefault();
    setPriority();
  });

  document.querySelector("#cpu-btn")?.addEventListener("click", (e) => {
    e.preventDefault();
    setCPU();
  });
});
