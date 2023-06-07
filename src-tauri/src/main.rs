// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use libc::{
    c_int, cpu_set_t, pid_t, sched_setaffinity, setpriority, CPU_SET, CPU_SETSIZE, PRIO_PROCESS,
};
use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::process::{Command, Stdio};
use std::string::String;

use once_cell::sync::Lazy;

#[derive(Debug, Serialize)]
struct Process {
    process_id: String,
    process_name: String,
    cpu_usage: f32,
    memory_usage: u64,
    user: String,
    threads_used: u32,
}

struct ProcessUsage {
    cpu_usage: f32,
    memory_usage: u64,
    user: String,
    threads_used: u32,
}

struct CPUUsage {
    cpu_usage: f32,
    instant_cpu_usage: f32,
}

struct TemporalData {
    system_elapsed_time: f32,
    processes: HashMap<i32, f32>,
}

static mut CLK_TCK: u64 = 100;
static mut CPU_USAGE: Lazy<TemporalData> = Lazy::new(|| TemporalData {
    system_elapsed_time: 0.0,
    processes: HashMap::new(),
});

fn get_clock_ticks() {
    let clock_ticks = unsafe { libc::sysconf(libc::_SC_CLK_TCK) };
    unsafe {
        CLK_TCK = clock_ticks as u64;
    }
}

fn calculate_instant_usage(pid: i32, cpu_time: u64, system_uptime: f32) -> CPUUsage {
    let clock_ticks = unsafe { CLK_TCK };
    let cpu_usage = cpu_time as f32;

    let previous_system_elapsed_time;
    let mut previous_process_cpu_usage = 0.0;

    unsafe {
        previous_system_elapsed_time = CPU_USAGE.system_elapsed_time;

        match CPU_USAGE.processes.get(&pid) {
            Some(previous_usage) => {
                previous_process_cpu_usage = *previous_usage;
            }
            None => {}
        }
    }

    let system_elapsed_time = system_uptime - previous_system_elapsed_time;
    let process_cpu_usage = (cpu_usage - previous_process_cpu_usage) / clock_ticks as f32;

    let instant_cpu_usage = process_cpu_usage / system_elapsed_time;

    CPUUsage {
        cpu_usage,
        instant_cpu_usage,
    }
}

fn get_process_usage(process_id: i32) -> Option<ProcessUsage> {
    let stat_file_path = format!("/proc/{}/stat", process_id);
    let status_file_path = format!("/proc/{}/status", process_id);

    let stat_info = fs::read_to_string(stat_file_path).ok()?;

    let cpu_utime = stat_info.split_whitespace().nth(13)?.parse::<u64>().ok()?;
    let cpu_stime = stat_info.split_whitespace().nth(14)?.parse::<u64>().ok()?;

    let cpu_time = cpu_utime + cpu_stime;

    let status_content = fs::read_to_string(status_file_path).ok()?;

    let memory_usage = status_content
        .lines()
        .find(|line| line.starts_with("VmRSS:"))?
        .split_whitespace()
        .nth(1)?
        .parse::<u64>()
        .ok()?;

    let uid_line = status_content
        .lines()
        .find(|line| line.starts_with("Uid:"))?;

    let uid = uid_line.split_whitespace().nth(1)?.parse::<u32>().ok()?;

    let mut user_name = String::new();

    let user = nix::unistd::User::from_uid(nix::unistd::Uid::from_raw(uid)).ok()?;

    if let Some(user) = user {
        user_name = user.name.to_string();
    }

    let threads_line = status_content
        .lines()
        .find(|line| line.starts_with("Threads:"))?;

    let threads_used = threads_line
        .split_whitespace()
        .nth(1)?
        .parse::<u32>()
        .ok()?;

    Some(ProcessUsage {
        cpu_usage: cpu_time as f32,
        memory_usage,
        user: user_name,
        threads_used,
    })
}

#[tauri::command]
fn read_running_processes() -> Vec<Process> {
    let mut processes = Vec::new();
    let mut current_processes_status: HashMap<i32, f32> = HashMap::new();

    let system_uptime_path: String = format!("/proc/uptime");

    if let Ok(system_uptime_string) = fs::read_to_string(system_uptime_path) {
        if let Ok(system_uptime) = system_uptime_string
            .split_whitespace()
            .nth(0)
            .unwrap_or("1")
            .parse::<f32>()
        {
            if let Ok(entries) = fs::read_dir("/proc") {
                for entry in entries {
                    if let Ok(entry) = entry {
                        if let Ok(metadata) = entry.metadata() {
                            if metadata.is_dir() {
                                if let Some(process_id) = entry.file_name().to_str() {
                                    if process_id.chars().all(char::is_numeric) {
                                        if let Ok(comm) =
                                            fs::read_to_string(format!("/proc/{}/comm", process_id))
                                        {
                                            if let Some(usages) = get_process_usage(
                                                process_id.parse::<i32>().unwrap(),
                                            ) {
                                                let instant_cpu_usage = calculate_instant_usage(
                                                    process_id.parse::<i32>().unwrap(),
                                                    usages.cpu_usage as u64,
                                                    system_uptime,
                                                );
                                                let process = Process {
                                                    process_id: process_id.to_string(),
                                                    process_name: comm.trim().to_string(),
                                                    cpu_usage: instant_cpu_usage.instant_cpu_usage,
                                                    memory_usage: usages.memory_usage,
                                                    user: usages.user,
                                                    threads_used: usages.threads_used,
                                                };
                                                processes.push(process);

                                                // create a new hash map to store the cpu usage in the heap
                                                current_processes_status.insert(
                                                    process_id.parse::<i32>().unwrap(),
                                                    instant_cpu_usage.cpu_usage,
                                                );
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            unsafe {
                CPU_USAGE.system_elapsed_time = system_uptime;
            }
        }
    }

    unsafe {
        CPU_USAGE.processes = current_processes_status;
    }

    processes
}

#[tauri::command]
fn send_process_signal(signal: &str, pid: &str) -> String {
    let child = Command::new("kill")
        .arg(format!("-{}", signal))
        .arg(pid)
        .stdout(Stdio::piped())
        .spawn()
        .expect("failed to execute child");
    let output = child
        .wait_with_output()
        .expect("Failed to open echo stdout");
    let stdout_string = String::from_utf8_lossy(&output.stdout).to_string();

    format!("kill result, {}", stdout_string)
}

#[tauri::command]
fn set_process_priority(pid: i32, priority: i32) {
    if set_priority(pid, priority) {
        println!("Priority set successfully");
    } else {
        println!("Failed to set priority");
    }

    fn set_priority(pid: pid_t, priority: c_int) -> bool {
        let result = unsafe { setpriority(PRIO_PROCESS, pid as u32, priority) };
        result == 0
    }
}

#[tauri::command]
fn bind_process(pid: i32, cpu: u32) {
    if bind_process_to_cpu(pid, cpu as i32) {
        println!("Process bound successfully");
    } else {
        println!("Failed to bind process");
    }

    fn bind_process_to_cpu(pid: pid_t, cpu_id: c_int) -> bool {
        let mut mask: cpu_set_t = unsafe { std::mem::zeroed() };

        // set CPU affinity mask
        unsafe {
            CPU_SET(cpu_id as usize, &mut mask);
        };

        let result = unsafe { sched_setaffinity(pid as i32, CPU_SETSIZE as usize, &mask) };
        result == 0
    }
}

fn main() {
    get_clock_ticks();
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            read_running_processes,
            send_process_signal,
            set_process_priority,
            bind_process,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
