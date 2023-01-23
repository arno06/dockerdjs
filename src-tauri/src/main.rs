#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::process::Command;

#[tauri::command]
fn exec_command (command:String, arguments:String) -> String {
    let output = Command::new(command)
                    .arg(arguments)
                    .output()
                    .expect("failed to execute process");
    String::from_utf8(output.stdout).unwrap()
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![exec_command])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
