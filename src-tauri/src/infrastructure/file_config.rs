use std::fs;
use std::path::Path;

pub fn read_to_string(path: &Path) -> Result<String, String> {
    fs::read_to_string(path).map_err(|error| error.to_string())
}

pub fn write_string(path: &Path, content: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    fs::write(path, content).map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn write_string_creates_parent_directories() {
        let path = std::env::temp_dir()
            .join(format!("cc-notice-file-config-{}", std::process::id()))
            .join("nested")
            .join("settings.json");

        write_string(&path, "{\"ok\":true}").expect("write should create parent directories");

        let content = read_to_string(&path).expect("content should be readable");
        assert_eq!("{\"ok\":true}", content);
    }
}
