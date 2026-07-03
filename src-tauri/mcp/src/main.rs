mod server;

use rmcp::ServiceExt;
use server::DocsServer;
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // stdout carries JSON-RPC only; logs go to stderr per the MCP stdio
    // transport spec (clients may capture or ignore them). Level via RUST_LOG.
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .with_writer(std::io::stderr)
        .with_ansi(false)
        .init();
    tracing::info!(
        version = env!("CARGO_PKG_VERSION"),
        "docsreader-mcp starting"
    );
    let running = DocsServer.serve(rmcp::transport::stdio()).await?;
    running.waiting().await?;
    Ok(())
}
