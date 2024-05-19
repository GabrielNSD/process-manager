import { invoke } from "@tauri-apps/api/tauri";
import { OsType, type } from "@tauri-apps/api/os";
import { Grid, GridOptions, ColDef } from "ag-grid-community";

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

let osType: OsType = "Linux";

async function sendSignal(signal: string) {
  if (pidInputEl && killBtnEl && stopBtnEl && contBtnEl) {
    await invoke("send_process_signal", {
      pid: pidInputEl.value,
      signal: signal,
    });
  }
}

async function setPriority() {
  if (pidInputEl && priorityInputEl && priorityBtnEl) {
    await invoke("set_process_priority", {
      pid: parseInt(pidInputEl.value),
      priority: parseInt(priorityInputEl.value),
    });
  }
}

async function setCPU() {
  if (cpuInputEl && cpuBtnEl && pidInputEl) {
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

const columnDefs: ColDef[] = [
  {
    headerName: "ID",
    field: "process_id",
  },
  {
    headerName: "Nome do processo",
    field: "process_name",
    valueFormatter: (params) =>
      osType === "Darwin" ? params.value.split("/").pop() : params.value,
  },
  {
    headerName: "Uso de CPU (%)",
    field: "cpu_usage",
    valueFormatter: (params) =>
      (params.value * (osType === "Darwin" ? 1 : 100)).toFixed(2),
  },
  {
    headerName: `Uso de memória`,
    field: "memory_usage",
  },
  {
    headerName: "Usuário",
    field: "user",
  },
  {
    headerName: "Threads usadas",
    field: "threads_used",
  },
];

let rowData: Process[] = [];

const gridOptions: GridOptions = {
  columnDefs: columnDefs,
  rowData: rowData,
  rowSelection: "single",
  animateRows: true,
  getRowId: (params) => params.data.process_id,
  defaultColDef: { sortable: true },
};

async function updateRowData() {
  if (filterInputEl && gridObject) {
    const list: Process[] = (
      (await invoke("read_running_processes", {})) as Process[]
    ).filter((el) => {
      if (filterInputEl?.value) {
        return JSON.stringify(el)
          .toLowerCase()
          .includes(filterInputEl.value.toLowerCase());
      } else {
        return true;
      }
    });
    gridOptions.api?.setRowData(list);
  }

  setTimeout(updateRowData, 3000);
}

async function getOsType() {
  osType = await type();
}

window.addEventListener("DOMContentLoaded", () => {
  getOsType();
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
