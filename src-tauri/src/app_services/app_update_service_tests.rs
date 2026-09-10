use super::*;

#[test]
fn parses_stable_versions_with_optional_v_prefix() {
    assert_eq!(
        parse_stable_version("v1.2.0"),
        Some(StableVersion::new(1, 2, 0))
    );
    assert_eq!(
        parse_stable_version("1.2.0"),
        Some(StableVersion::new(1, 2, 0))
    );
}

#[test]
fn rejects_non_stable_versions() {
    for value in ["", "1.2", "1.2.0.1", "v1.2.0-beta.1", "1..0", "01.2.3"] {
        assert!(
            parse_stable_version(value).is_none(),
            "{value} should be rejected"
        );
    }
}

#[test]
fn compares_versions_numerically() {
    assert_eq!(
        compare_stable_versions("1.10.0", "1.9.9"),
        Some(Ordering::Greater)
    );
    assert_eq!(
        compare_stable_versions("1.1.1", "1.1.1"),
        Some(Ordering::Equal)
    );
    assert_eq!(
        compare_stable_versions("1.1.0", "1.1.1"),
        Some(Ordering::Less)
    );
    assert_eq!(compare_stable_versions("invalid", "1.1.1"), None);
}

#[test]
fn validates_stable_github_release() {
    let release = github_release(
        "v1.2.0",
        false,
        false,
        "https://github.com/oliverCJ/cc-notice/releases/tag/v1.2.0",
    );
    assert!(validate_release(release).is_ok());
}

#[test]
fn rejects_draft_prerelease_invalid_version_and_url() {
    assert!(validate_release(github_release(
        "v1.2.0",
        true,
        false,
        "https://github.com/oliverCJ/cc-notice/releases/tag/v1.2.0"
    ))
    .is_err());
    assert!(validate_release(github_release(
        "v1.2.0",
        false,
        true,
        "https://github.com/oliverCJ/cc-notice/releases/tag/v1.2.0"
    ))
    .is_err());
    assert!(validate_release(github_release(
        "v1.2.0-beta.1",
        false,
        false,
        "https://github.com/oliverCJ/cc-notice/releases/tag/v1.2.0-beta.1"
    ))
    .is_err());
    assert!(validate_release(github_release(
        "v1.2.0",
        false,
        false,
        "https://example.com/release"
    ))
    .is_err());
}

#[test]
fn maps_github_release_json_to_update_result() {
    let release = parse_github_release(
        r#"{
            "tag_name": "v1.2.0",
            "name": "CC Notice 1.2.0",
            "body": "修复设备连接问题\n新增版本检测。",
            "html_url": "https://github.com/oliverCJ/cc-notice/releases/tag/v1.2.0",
            "published_at": "2026-09-09T00:00:00Z",
            "draft": false,
            "prerelease": false
        }"#,
    )
    .expect("release json should parse");

    let result = build_update_result("1.1.1", release).expect("update result should build");
    assert_eq!(result.latest_version, "1.2.0");
    assert_eq!(result.status, AppUpdateStatus::UpdateAvailable);
    assert_eq!(result.release_body, "修复设备连接问题\n新增版本检测。");
}

#[test]
fn falls_back_to_tag_name_when_release_name_is_missing() {
    let mut release = github_release(
        "v1.1.1",
        false,
        false,
        "https://github.com/oliverCJ/cc-notice/releases/tag/v1.1.1",
    );
    release.name = None;
    let result = build_update_result("1.1.1", release).expect("update result should build");
    assert_eq!(result.release_name, "v1.1.1");
    assert_eq!(result.status, AppUpdateStatus::UpToDate);
}

fn github_release(tag_name: &str, draft: bool, prerelease: bool, html_url: &str) -> GithubRelease {
    GithubRelease {
        tag_name: tag_name.to_string(),
        name: Some("release".to_string()),
        body: Some(String::new()),
        html_url: html_url.to_string(),
        published_at: None,
        draft,
        prerelease,
    }
}
