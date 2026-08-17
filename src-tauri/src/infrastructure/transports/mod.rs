pub mod descriptor;
pub mod factory;
pub mod serial;
pub mod transport;

pub use serial::mock;

#[cfg(test)]
#[path = "transports_tests.rs"]
mod tests;
