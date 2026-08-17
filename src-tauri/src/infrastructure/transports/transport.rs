pub trait DeviceTransport: Send {
    fn send_line(&mut self, line: &str) -> Result<(), String>;
    fn read_line(&mut self) -> Result<Option<String>, String>;
    fn sent_lines(&self) -> Vec<String> {
        Vec::new()
    }
}
