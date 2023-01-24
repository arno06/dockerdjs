#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::process::Command;

#[tauri::command]
fn exec_command (command:String, arguments:String) -> String {
    let mut params: Vec<&str> = arguments.split(" ").collect();
    let mut cmd = vec!["/C", &command];
    cmd.append(&mut params);
    let output = if cfg!(target_os = "windows") {
        Command::new("cmd")
                .args(cmd)
                .output()
                .expect("failed to execute process")
    } else {
        Command::new(command)
                .arg(&arguments)
                .output()
                .expect("failed to execute process")
    };
    String::from_utf8(output.stdout).unwrap()
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![exec_command])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
