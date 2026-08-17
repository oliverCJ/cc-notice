use crate::core::device::DeviceTransportKind;
use crate::infrastructure::transports::descriptor::DevicePortDescriptor;
use crate::infrastructure::transports::mock::MockDeviceTransport;
use crate::infrastructure::transports::transport::DeviceTransport;

#[test]
fn mock_transport_records_sent_lines_and_reads_ack_lines() {
    let mut transport = MockDeviceTransport::with_received_lines(vec!["{\"ok\":true}".to_string()]);

    transport
        .send_line("{\"v\":2}\n")
        .expect("mock send should succeed");
    let ack = transport.read_line().expect("mock read should succeed");

    assert_eq!(vec!["{\"v\":2}\n"], transport.sent_lines());
    assert_eq!(Some("{\"ok\":true}".to_string()), ack);
}

#[test]
fn transport_descriptor_uses_stable_transport_kind() {
    let descriptor = DevicePortDescriptor {
        id: "serial:/dev/tty.usbmodem-test".to_string(),
        display_name: "Pico Test Port".to_string(),
        transport_kind: DeviceTransportKind::Serial,
        address: "/dev/tty.usbmodem-test".to_string(),
        stable_device_uid: None,
        stable_device_uid_candidates: Vec::new(),
    };

    assert_eq!(DeviceTransportKind::Serial, descriptor.transport_kind);
    assert_eq!("/dev/tty.usbmodem-test", descriptor.address);
}
