use std::cmp::Ordering;
use std::time::Duration;

use reqwest::Client;
use serde::{Deserialize, Serialize};

const LATEST_RELEASE_API_URL: &str =
    "https://api.github.com/repos/oliverCJ/cc-notice/releases/latest";
const RELEASE_URL_PREFIX: &str = "https://github.com/oliverCJ/cc-notice/releases/";
const CONNECT_TIMEOUT: Duration = Duration::from_secs(5);
const REQUEST_TIMEOUT: Duration = Duration::from_secs(10);

#[derive(Clone, Debug, Eq, PartialEq, Ord, PartialOrd)]
pub struct StableVersion {
    pub major: u64,
    pub minor: u64,
    pub patch: u64,
}

impl StableVersion {
    pub const fn new(major: u64, minor: u64, patch: u64) -> Self {
        Self {
            major,
            minor,
            patch,
        }
    }
}

#[derive(Clone, Debug, Deserialize)]
pub struct GithubRelease {
    pub tag_name: String,
    pub name: Option<String>,
    pub body: Option<String>,
    pub html_url: String,
    pub published_at: Option<String>,
    pub draft: bool,
    pub prerelease: bool,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum AppUpdateStatus {
    UpToDate,
    UpdateAvailable,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppUpdateCheckResult {
    pub current_version: String,
    pub latest_version: String,
    pub status: AppUpdateStatus,
    pub release_name: String,
    pub release_body: String,
    pub published_at: Option<String>,
    pub release_url: String,
}

pub fn parse_stable_version(tag: &str) -> Option<StableVersion> {
    let normalized = tag.strip_prefix('v').unwrap_or(tag);
    let mut parts = normalized.split('.');
    let major = parse_version_part(parts.next()?)?;
    let minor = parse_version_part(parts.next()?)?;
    let patch = parse_version_part(parts.next()?)?;
    if parts.next().is_some() {
        return None;
    }

    Some(StableVersion::new(major, minor, patch))
}

pub fn compare_stable_versions(left: &str, right: &str) -> Option<Ordering> {
    Some(parse_stable_version(left)?.cmp(&parse_stable_version(right)?))
}

pub fn validate_release(release: GithubRelease) -> Result<GithubRelease, String> {
    if release.draft || release.prerelease {
        return Err("github release is not a stable published release".to_string());
    }
    if parse_stable_version(&release.tag_name).is_none() {
        return Err("github release tag is not a stable semantic version".to_string());
    }
    if !release.html_url.starts_with(RELEASE_URL_PREFIX) {
        return Err("github release url is not an allowed release page".to_string());
    }

    Ok(release)
}

pub fn parse_github_release(body: &str) -> Result<GithubRelease, String> {
    serde_json::from_str(body).map_err(|error| format!("failed to parse github release: {error}"))
}

pub fn build_update_result(
    current_version: &str,
    release: GithubRelease,
) -> Result<AppUpdateCheckResult, String> {
    let release = validate_release(release)?;
    let latest_version = parse_stable_version(&release.tag_name)
        .ok_or_else(|| "github release version is invalid".to_string())?;
    let current_version_parsed = parse_stable_version(current_version)
        .ok_or_else(|| "current app version is invalid".to_string())?;
    let status = if latest_version > current_version_parsed {
        AppUpdateStatus::UpdateAvailable
    } else {
        AppUpdateStatus::UpToDate
    };

    Ok(AppUpdateCheckResult {
        current_version: current_version.to_string(),
        latest_version: format_version(&latest_version),
        status,
        release_name: release.name.unwrap_or_else(|| release.tag_name.clone()),
        release_body: release.body.unwrap_or_default(),
        published_at: release.published_at,
        release_url: release.html_url,
    })
}

pub async fn check_for_update(current_version: &str) -> Result<AppUpdateCheckResult, String> {
    let client = Client::builder()
        .connect_timeout(CONNECT_TIMEOUT)
        .timeout(REQUEST_TIMEOUT)
        .user_agent(format!("CC-Notice/{current_version}"))
        .build()
        .map_err(|error| format!("failed to create app update client: {error}"))?;

    let response = client
        .get(LATEST_RELEASE_API_URL)
        .send()
        .await
        .map_err(|error| format!("failed to request latest app release: {error}"))?;
    let status = response.status();
    if !status.is_success() {
        tracing::warn!(status = %status, "github latest release request returned an error");
        return Err(format!(
            "github latest release request failed with status {status}"
        ));
    }

    let body = response
        .text()
        .await
        .map_err(|error| format!("failed to read latest app release: {error}"))?;
    let release = parse_github_release(&body)?;
    build_update_result(current_version, release)
}

fn parse_version_part(value: &str) -> Option<u64> {
    if value.is_empty() || (value.len() > 1 && value.starts_with('0')) {
        return None;
    }
    value.parse().ok()
}

fn format_version(version: &StableVersion) -> String {
    format!("{}.{}.{}", version.major, version.minor, version.patch)
}

#[cfg(test)]
#[path = "app_update_service_tests.rs"]
mod tests;
