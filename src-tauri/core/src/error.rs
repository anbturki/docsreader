use std::fmt;

use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ErrorCode {
    WorkspaceNotFound,
    DocNotFound,
    InvalidPath,
    InvalidInput,
    Conflict,
    Io,
    Git,
}

#[derive(Debug, Serialize)]
pub struct CoreError {
    pub code: ErrorCode,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub recovery: Option<String>,
}

impl CoreError {
    pub fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            recovery: None,
        }
    }

    pub fn with_recovery(mut self, recovery: impl Into<String>) -> Self {
        self.recovery = Some(recovery.into());
        self
    }
}

impl fmt::Display for CoreError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match &self.recovery {
            Some(r) => write!(f, "{:?}: {} ({})", self.code, self.message, r),
            None => write!(f, "{:?}: {}", self.code, self.message),
        }
    }
}

impl std::error::Error for CoreError {}

impl From<std::io::Error> for CoreError {
    fn from(e: std::io::Error) -> Self {
        Self::new(ErrorCode::Io, e.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_to_the_wire_shape_agents_parse() {
        let err = CoreError::new(ErrorCode::WorkspaceNotFound, "no workspace")
            .with_recovery("call list_workspaces");
        let json = serde_json::to_value(&err).unwrap();
        assert_eq!(
            json,
            serde_json::json!({
                "code": "workspace_not_found",
                "message": "no workspace",
                "recovery": "call list_workspaces",
            })
        );
    }

    #[test]
    fn recovery_is_omitted_when_absent() {
        let json = serde_json::to_value(CoreError::new(ErrorCode::InvalidPath, "bad")).unwrap();
        assert_eq!(json.as_object().unwrap().len(), 2);
        assert_eq!(json["code"], "invalid_path");
    }
}
