use std::sync::atomic::{AtomicU64, Ordering};

pub const MANUAL_CONNECT_TIMEOUT_MS: u64 = 12_000;
pub const AUTO_CONNECT_TIMEOUT_MS: u64 = 8_000;
pub const DEVICE_ACTION_TIMEOUT_MS: u64 = 3_000;
pub const HEARTBEAT_TIMEOUT_MS: u64 = 2_000;
pub const CANCELLED_RECONNECT_COOLDOWN_MS: u64 = 30_000;

static NEXT_OPERATION_ID: AtomicU64 = AtomicU64::new(1);

pub fn next_operation_id() -> u64 {
    NEXT_OPERATION_ID.fetch_add(1, Ordering::Relaxed)
}
