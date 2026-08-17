use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BoardCapabilities {
    pub digital_output_channels: bool,
    pub text_display: bool,
}
