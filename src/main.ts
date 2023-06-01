import { invoke } from "@tauri-apps/api/tauri";
import { Grid, GridOptions } from "ag-grid-community";

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
let filterInputEl: HTMLInputElement | null;

let gridObject: Grid | null = null;

async function greet() {
  if (greetMsgEl && greetInputEl) {
    // Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
    greetMsgEl.textContent = await invoke("greet", {
      name: greetInputEl.value,
    });
  }
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

const columnDefs = [
  { field: "process_id" },
  { field: "process_name" },
  { field: "cpu_usage" },
  { field: "memory_usage" },
  { field: "user" },
  { field: "threads_used" },
];

let rowData: Process[] = [];

const gridOptions: GridOptions = {
  columnDefs: columnDefs,
  rowData: rowData,
  rowSelection: "single",
  animateRows: true,
  getRowId: (params) => params.data.id,
  defaultColDef: { sortable: true },
};

async function updateRowData() {
  if (filterInputEl) {
    const list: Process[] = await invoke("read_running_processes", {});
    const formattedList = list.map((el) => ({ ...el, id: el.process_id }));
    gridOptions.api?.setRowData(formattedList);

    setTimeout(updateRowData, 1000);
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

  updateRowData();

  pidInputEl = document.querySelector("#pid-input");
  killBtnEl = document.querySelector("#kill-btn");
  stopBtnEl = document.querySelector("#stop-btn");
  contBtnEl = document.querySelector("#cont-btn");
  priorityInputEl = document.querySelector("#priority-input");
  priorityBtnEl = document.querySelector("#priority-btn");
  cpuInputEl = document.querySelector("#cpu-input");
  cpuBtnEl = document.querySelector("#cpu-btn");

  const gridDiv = document.querySelector("#myGrid");
  gridObject = new Grid(gridDiv as HTMLElement, gridOptions);

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
