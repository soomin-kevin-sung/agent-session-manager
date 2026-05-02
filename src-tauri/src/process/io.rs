use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{ChildStdout, ChildStderr};
use tokio::sync::mpsc;

/// Read stdout line-by-line and send each line to tx.
pub async fn stream_lines(stdout: ChildStdout, tx: mpsc::UnboundedSender<String>) {
    let reader = BufReader::new(stdout);
    let mut lines = reader.lines();
    while let Ok(Some(line)) = lines.next_line().await {
        if tx.send(line).is_err() {
            break;
        }
    }
}

/// Read stderr line-by-line, prefix with "stderr:" and send to tx.
pub async fn stream_stderr(stderr: ChildStderr, tx: mpsc::UnboundedSender<String>) {
    let reader = BufReader::new(stderr);
    let mut lines = reader.lines();
    while let Ok(Some(line)) = lines.next_line().await {
        if tx.send(format!("stderr:{}", line)).is_err() {
            break;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::process::Command;

    #[tokio::test]
    async fn test_stream_lines_captures_output() {
        let mut child = Command::new("echo")
            .arg("hello world")
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .expect("failed to spawn echo");

        let stdout = child.stdout.take().unwrap();
        let (tx, mut rx) = mpsc::unbounded_channel::<String>();

        tokio::spawn(stream_lines(stdout, tx));

        let mut lines = vec![];
        while let Some(line) = rx.recv().await {
            lines.push(line);
        }

        assert!(!lines.is_empty());
        assert!(lines[0].contains("hello world"));
    }
}
