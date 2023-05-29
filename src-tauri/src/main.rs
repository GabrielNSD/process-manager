// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use libc::{
    c_int, cpu_set_t, pid_t, sched_setaffinity, setpriority, CPU_SET, CPU_SETSIZE, PRIO_PROCESS,
};
use serde::Serialize;
use std::fs;
use std::process::{Command, Stdio};
use std::string::String;

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

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn list_processes() -> String {
    let child = Command::new("echo")
        .arg("THIS IS THE ECHO")
        .stdout(Stdio::piped())
        .spawn()
        .expect("failed to execute child");
    let output = child
        .wait_with_output()
        .expect("Failed to open echo stdout");
    let stdout_string = String::from_utf8_lossy(&output.stdout).to_string();

    format!("Hello from function, {}", stdout_string)
}

fn get_process_usage(process_id: i32) -> Option<ProcessUsage> {
    let cpu_usage_path = format!("/proc/{}/stat", process_id);
    let status_file_path = format!("/proc/{}/status", process_id);

    let cpu_usage = fs::read_to_string(cpu_usage_path)
        .ok()?
        .split_whitespace()
        .nth(13)?
        .parse::<u64>()
        .ok()?;

    let cpu_usage_percentage = cpu_usage as f32 / 100.0;

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
        cpu_usage: cpu_usage_percentage,
        memory_usage,
        user: user_name,
        threads_used,
    })
}

#[tauri::command]
fn read_running_processes() -> Vec<Process> {
    let mut processes = Vec::new();

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
                                    if let Some(usages) =
                                        get_process_usage(process_id.parse::<i32>().unwrap())
                                    {
                                        let process = Process {
                                            process_id: process_id.to_string(),
                                            process_name: comm.trim().to_string(),
                                            cpu_usage: usages.cpu_usage,
                                            memory_usage: usages.memory_usage,
                                            user: usages.user,
                                            threads_used: usages.threads_used,
                                        };
                                        processes.push(process);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    processes
}

#[tauri::command]
fn send_process_signal(signal: &str, pid: &str) -> String {
    println!("PID IN RUST {}", pid);

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
        let mut cpu_set: cpu_set_t = unsafe { std::mem::zeroed() };

        // CPU affinity mask
        unsafe {
            CPU_SET(cpu_id as usize, &mut cpu_set);
        };

        let result = unsafe { sched_setaffinity(pid as i32, CPU_SETSIZE as usize, &cpu_set) };
        result == 0
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            greet,
            list_processes,
            read_running_processes,
            send_process_signal,
            set_process_priority,
            bind_process
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
