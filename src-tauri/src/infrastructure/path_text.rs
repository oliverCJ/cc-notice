pub fn user_facing_path_text(path_text: &str) -> String {
    if let Some(rest) = path_text
        .strip_prefix(r"\\?\")
        .or_else(|| path_text.strip_prefix("//?/"))
    {
        return normalize_windows_verbatim_rest(rest);
    }
    path_text.to_string()
}

fn normalize_windows_verbatim_rest(rest: &str) -> String {
    if let Some(unc_rest) = rest
        .strip_prefix(r"UNC\")
        .or_else(|| rest.strip_prefix("UNC/"))
    {
        let separator = if rest.contains('\\') { r"\\" } else { "//" };
        return format!("{separator}{unc_rest}");
    }
    rest.to_string()
}

#[cfg(test)]
mod tests {
    use super::user_facing_path_text;

    #[test]
    fn strips_windows_verbatim_disk_prefix() {
        assert_eq!(
            r"C:\Program Files\CC Notice\assets\sounds\done.mp3",
            user_facing_path_text(r"\\?\C:\Program Files\CC Notice\assets\sounds\done.mp3")
        );
    }

    #[test]
    fn strips_windows_verbatim_unc_prefix() {
        assert_eq!(
            r"\\server\share\done.mp3",
            user_facing_path_text(r"\\?\UNC\server\share\done.mp3")
        );
    }
}
