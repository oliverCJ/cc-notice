use std::collections::{BTreeMap, VecDeque};

use crate::core::device_transport_monitor::{
    DeviceTransportMonitorEvent, DeviceTransportMonitorSnapshot, DeviceTransportMonitorStatus,
};

pub const DEFAULT_MAX_MONITOR_SESSIONS: usize = 4;
pub const DEFAULT_MONITOR_EVENT_CAPACITY: usize = 500;

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum DeviceTransportMonitorServiceError {
    TooManySessions,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum DeviceTransportMonitorSessionStart {
    StartedNew,
    AlreadyActive,
    Resumed,
}

struct DeviceTransportMonitorSession {
    active: bool,
    events: VecDeque<DeviceTransportMonitorEvent>,
}

pub struct DeviceTransportMonitorService {
    max_sessions: usize,
    event_capacity: usize,
    sessions: BTreeMap<String, DeviceTransportMonitorSession>,
}

impl DeviceTransportMonitorService {
    pub fn new(max_sessions: usize, event_capacity: usize) -> Self {
        Self {
            max_sessions,
            event_capacity,
            sessions: BTreeMap::new(),
        }
    }

    pub fn start_session(
        &mut self,
        device_id: &str,
    ) -> Result<DeviceTransportMonitorSessionStart, DeviceTransportMonitorServiceError> {
        if let Some(session) = self.sessions.get_mut(device_id) {
            if session.active {
                return Ok(DeviceTransportMonitorSessionStart::AlreadyActive);
            }
            session.active = true;
            return Ok(DeviceTransportMonitorSessionStart::Resumed);
        }

        if self.sessions.len() >= self.max_sessions {
            return Err(DeviceTransportMonitorServiceError::TooManySessions);
        }

        self.sessions.insert(
            device_id.to_string(),
            DeviceTransportMonitorSession {
                active: true,
                events: VecDeque::new(),
            },
        );
        Ok(DeviceTransportMonitorSessionStart::StartedNew)
    }

    pub fn stop_session(&mut self, device_id: &str) {
        if let Some(session) = self.sessions.get_mut(device_id) {
            session.active = false;
        }
    }

    pub fn close_session(&mut self, device_id: &str) {
        self.sessions.remove(device_id);
    }

    pub fn is_session_active(&self, device_id: &str) -> bool {
        self.sessions
            .get(device_id)
            .map(|session| session.active)
            .unwrap_or(false)
    }

    pub fn clear_events(&mut self, device_id: &str) {
        if let Some(session) = self.sessions.get_mut(device_id) {
            session.events.clear();
        }
    }

    pub fn record(&mut self, event: DeviceTransportMonitorEvent) -> bool {
        let Some(session) = self.sessions.get_mut(&event.device_id) else {
            return false;
        };
        if !session.active {
            return false;
        }
        session.events.push_back(event);
        while session.events.len() > self.event_capacity {
            session.events.pop_front();
        }
        if matches!(
            session.events.back().map(|event| &event.status),
            Some(DeviceTransportMonitorStatus::Stopped)
        ) {
            session.active = false;
        }
        true
    }

    pub fn snapshot(&self, device_id: &str) -> DeviceTransportMonitorSnapshot {
        let Some(session) = self.sessions.get(device_id) else {
            return DeviceTransportMonitorSnapshot {
                device_id: device_id.to_string(),
                active: false,
                events: Vec::new(),
            };
        };
        DeviceTransportMonitorSnapshot {
            device_id: device_id.to_string(),
            active: session.active,
            events: session.events.iter().cloned().collect(),
        }
    }
}

impl Default for DeviceTransportMonitorService {
    fn default() -> Self {
        Self::new(DEFAULT_MAX_MONITOR_SESSIONS, DEFAULT_MONITOR_EVENT_CAPACITY)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::device_transport_monitor::{
        DeviceTransportMonitorCategory, DeviceTransportMonitorDirection,
        DeviceTransportMonitorStatus,
    };

    fn event(device_id: &str) -> DeviceTransportMonitorEvent {
        DeviceTransportMonitorEvent::new(
            device_id.to_string(),
            Some("rp2040-pico".to_string()),
            DeviceTransportMonitorDirection::Outbound,
            DeviceTransportMonitorCategory::Command,
            DeviceTransportMonitorStatus::Pending,
        )
    }

    #[test]
    fn record_is_noop_without_active_session() {
        let mut service = DeviceTransportMonitorService::new(2, 4);

        assert!(!service.record(event("desk-pico")));
        assert_eq!(0, service.snapshot("desk-pico").events.len());
    }

    #[test]
    fn session_keeps_ring_buffer_per_device() {
        let mut service = DeviceTransportMonitorService::new(2, 2);
        service
            .start_session("desk-pico")
            .expect("session should start");

        assert!(service.record(event("desk-pico")));
        assert!(service.record(event("desk-pico")));
        assert!(service.record(event("desk-pico")));

        let snapshot = service.snapshot("desk-pico");
        assert!(snapshot.active);
        assert_eq!(2, snapshot.events.len());
    }

    #[test]
    fn max_sessions_blocks_new_device_but_allows_existing_device() {
        let mut service = DeviceTransportMonitorService::new(1, 4);

        service
            .start_session("desk-pico")
            .expect("first session should start");
        service
            .start_session("desk-pico")
            .expect("existing session should be reused");
        let error = service
            .start_session("lab-pico")
            .expect_err("second device should be rejected");

        assert_eq!(DeviceTransportMonitorServiceError::TooManySessions, error);
    }

    #[test]
    fn stopping_session_freezes_snapshot_as_inactive() {
        let mut service = DeviceTransportMonitorService::new(2, 4);
        service
            .start_session("desk-pico")
            .expect("session should start");
        assert!(service.record(event("desk-pico")));

        service.stop_session("desk-pico");

        let snapshot = service.snapshot("desk-pico");
        assert!(!snapshot.active);
        assert_eq!(1, snapshot.events.len());
        assert!(!service.record(event("desk-pico")));
    }

    #[test]
    fn close_session_releases_snapshot() {
        let mut service = DeviceTransportMonitorService::new(1, 4);
        service
            .start_session("desk-pico")
            .expect("session should start");
        assert!(service.record(event("desk-pico")));

        service.close_session("desk-pico");

        let snapshot = service.snapshot("desk-pico");
        assert!(!snapshot.active);
        assert!(snapshot.events.is_empty());
    }

    #[test]
    fn is_session_active_only_matches_active_session() {
        let mut service = DeviceTransportMonitorService::new(1, 4);

        assert!(!service.is_session_active("desk-pico"));
        service
            .start_session("desk-pico")
            .expect("session should start");
        assert!(service.is_session_active("desk-pico"));
        service.stop_session("desk-pico");
        assert!(!service.is_session_active("desk-pico"));
    }

    #[test]
    fn inactive_open_session_still_counts_towards_window_limit() {
        let mut service = DeviceTransportMonitorService::new(1, 4);
        service
            .start_session("desk-pico")
            .expect("first session should start");
        service.stop_session("desk-pico");

        let error = service
            .start_session("lab-pico")
            .expect_err("open inactive session should still occupy a window slot");

        assert_eq!(DeviceTransportMonitorServiceError::TooManySessions, error);
    }

    #[test]
    fn reopening_inactive_session_resumes_recording() {
        let mut service = DeviceTransportMonitorService::new(1, 4);
        service
            .start_session("desk-pico")
            .expect("session should start");
        service.stop_session("desk-pico");
        assert!(!service.record(event("desk-pico")));

        let start = service
            .start_session("desk-pico")
            .expect("same device session should resume");

        assert_eq!(DeviceTransportMonitorSessionStart::Resumed, start);
        assert!(service.record(event("desk-pico")));
        assert!(service.snapshot("desk-pico").active);
    }
}
