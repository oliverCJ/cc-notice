use std::env;
use std::fs;
use std::fs::File;
use std::io::{Read, Write};
use std::net::TcpStream;

use cc_notice::core::hook_relay::{
    build_http_post_request, build_submit_request_body, ensure_success_status,
    parse_http_status_code, read_settings_port, resolve_endpoint, settings_path_in_home,
    LocalHttpEndpoint, RelayCliOptions, DEFAULT_HTTP_TIMEOUT,
};
use cc_notice::infrastructure::{app_paths, logging};

fn main() {
    let _ = init_logging();

    let result = run();
    if let Err(error) = &result {
        tracing::error!("cc-notice-relay failed: {error}");
    }
    let _ = write_noop_output(&mut std::io::stdout());
    std::process::exit(exit_code_for_run_result(result));
}

fn write_noop_output(writer: &mut impl Write) -> std::io::Result<()> {
    writer.write_all(b"{}\n")
}

fn run() -> Result<(), String> {
    let args: Vec<String> = env::args().collect();
    let options = RelayCliOptions::parse(&args)?;
    let stdin_payload = read_stdin_payload()?;
    let raw_payload = options.payload.as_deref().unwrap_or(&stdin_payload);
    let settings_port = read_user_settings_port();
    let auth_token = read_user_auth_token();
    let endpoint = resolve_endpoint(&options, settings_port);
    let endpoint = LocalHttpEndpoint::parse(&endpoint)?;
    let body = build_submit_request_body(&options, raw_payload)?
        .ok_or_else(|| "relay request body was not built".to_string())?;

    post_event(&endpoint, &body, auth_token.as_deref())
}

fn read_stdin_payload() -> Result<String, String> {
    let mut payload = String::new();
    std::io::stdin()
        .read_to_string(&mut payload)
        .map_err(|error| error.to_string())?;
    if payload.trim().is_empty() {
        Ok("{}".to_string())
    } else {
        Ok(payload)
    }
}

fn read_user_settings_port() -> Option<u16> {
    let home = app_paths::user_home_dir().ok()?;
    let settings_path = settings_path_in_home(&home);
    let content = fs::read_to_string(settings_path).ok()?;
    read_settings_port(&content).ok()
}

fn read_user_auth_token() -> Option<String> {
    let app_home = app_paths::app_home_dir().ok()?;
    cc_notice::infrastructure::auth_token::read_token(&app_home).ok()
}

fn post_event(
    endpoint: &LocalHttpEndpoint,
    body: &str,
    auth_token: Option<&str>,
) -> Result<(), String> {
    let mut stream =
        TcpStream::connect((endpoint.host.as_str(), endpoint.port)).map_err(|error| {
            let friendly_message = match error.kind() {
                std::io::ErrorKind::ConnectionRefused => {
                    format!("连接被拒绝：本地服务未启动（端口 {}）", endpoint.port)
                }
                std::io::ErrorKind::TimedOut => {
                    format!("连接超时：网络超时（{}:{}）", endpoint.host, endpoint.port)
                }
                std::io::ErrorKind::AddrNotAvailable => "地址不可用：端口配置错误".to_string(),
                _ => {
                    format!("连接失败：{}", error)
                }
            };
            tracing::warn!("cc-notice-relay connection failed: {}", friendly_message);
            friendly_message
        })?;
    stream
        .set_read_timeout(Some(DEFAULT_HTTP_TIMEOUT))
        .map_err(|error| error.to_string())?;
    stream
        .set_write_timeout(Some(DEFAULT_HTTP_TIMEOUT))
        .map_err(|error| error.to_string())?;
    let request = build_http_post_request(endpoint, body, auth_token);
    stream
        .write_all(request.as_bytes())
        .map_err(|error| error.to_string())?;
    let mut response = String::new();
    stream
        .read_to_string(&mut response)
        .map_err(|error| error.to_string())?;
    let status = parse_http_status_code(&response)?;
    ensure_success_status(status)
}

fn init_logging() -> Result<(), String> {
    let file =
        logging::default_relay_user_log_file().and_then(|path| logging::open_log_file(&path))?;
    let writer = relay_log_writer(file);
    tracing_subscriber::fmt()
        .with_writer(move || writer.clone())
        .with_timer(logging::LocalRfc3339Timer::system())
        .with_ansi(false)
        .try_init()
        .map_err(|error| format!("failed to initialize tracing subscriber: {error}"))
}

fn relay_log_writer(file: File) -> logging::FileOnlyWriter {
    logging::FileOnlyWriter::new(file)
}

fn exit_code_for_run_result(result: Result<(), String>) -> i32 {
    if let Err(error) = result {
        tracing::debug!("relay error hidden from hook caller: {error}");
    }
    0
}

#[cfg(test)]
mod tests {
    use super::{exit_code_for_run_result, relay_log_writer, write_noop_output};
    use std::io::Write;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn relay_failure_is_hidden_from_ai_hook_exit_code() {
        assert_eq!(
            0,
            exit_code_for_run_result(Err("connection refused".to_string()))
        );
    }

    #[test]
    fn relay_success_uses_success_exit_code() {
        assert_eq!(0, exit_code_for_run_result(Ok(())));
    }

    #[test]
    fn relay_writes_single_noop_json_output() {
        let mut output = Vec::new();

        write_noop_output(&mut output).expect("relay output should be writable");

        assert_eq!(b"{}\n", output.as_slice());
    }

    #[test]
    fn relay_log_writer_writes_file_without_requiring_console() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after unix epoch")
            .as_nanos();
        let file_path = std::env::temp_dir()
            .join(format!("cc-notice-relay-writer-{unique}"))
            .join("cc-notice-relay.log");
        let file = cc_notice::infrastructure::logging::open_log_file(&file_path)
            .expect("relay log file should open");
        let mut writer = relay_log_writer(file);

        writer
            .write_all(b"hidden relay failure")
            .expect("relay log should write");
        writer.flush().expect("relay log should flush");

        let content = std::fs::read_to_string(file_path).expect("relay log should be readable");
        assert!(content.contains("hidden relay failure"));
    }
}
