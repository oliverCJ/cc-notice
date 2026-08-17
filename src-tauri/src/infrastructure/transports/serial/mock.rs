use crate::infrastructure::transports::transport::DeviceTransport;

#[derive(Default)]
pub struct MockDeviceTransport {
    sent_lines: Vec<String>,
    received_lines: Vec<Option<String>>,
    send_error: Option<String>,
    read_error: Option<String>,
}

impl MockDeviceTransport {
    pub fn with_received_lines(received_lines: Vec<String>) -> Self {
        Self {
            sent_lines: Vec::new(),
            received_lines: received_lines.into_iter().map(Some).collect(),
            send_error: None,
            read_error: None,
        }
    }

    pub fn with_received_attempts(received_lines: Vec<Option<String>>) -> Self {
        Self {
            sent_lines: Vec::new(),
            received_lines,
            send_error: None,
            read_error: None,
        }
    }

    pub fn fail_send_with(&mut self, error: &str) {
        self.send_error = Some(error.to_string());
    }

    pub fn fail_read_with(&mut self, error: &str) {
        self.read_error = Some(error.to_string());
    }

    pub fn sent_lines(&self) -> Vec<String> {
        self.sent_lines.clone()
    }
}

impl DeviceTransport for MockDeviceTransport {
    fn send_line(&mut self, line: &str) -> Result<(), String> {
        if let Some(error) = &self.send_error {
            return Err(error.clone());
        }
        self.sent_lines.push(line.to_string());
        Ok(())
    }

    fn read_line(&mut self) -> Result<Option<String>, String> {
        if let Some(error) = &self.read_error {
            return Err(error.clone());
        }
        if self.received_lines.is_empty() {
            return Ok(None);
        }
        Ok(self.received_lines.remove(0))
    }

    fn sent_lines(&self) -> Vec<String> {
        self.sent_lines()
    }
}
