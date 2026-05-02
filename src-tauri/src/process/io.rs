use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{ChildStdout, ChildStderr};
use tokio::sync::mpsc;

/// Typed line output from child process I/O streams.
#[derive(Debug)]
pub enum ProcessLine {
    Stdout(String),
    Stderr(String),
}

/// Read stdout line-by-line and send each line as ProcessLine::Stdout.
pub async fn stream_lines(stdout: ChildStdout, tx: mpsc::UnboundedSender<ProcessLine>) {
    let reader = BufReader::new(stdout);
    let mut lines = reader.lines();
    while let Ok(Some(line)) = lines.next_line().await {
        if tx.send(ProcessLine::Stdout(line)).is_err() {
            break;
        }
    }
}

/// Read stderr line-by-line and send each line as ProcessLine::Stderr.
pub async fn stream_stderr(stderr: ChildStderr, tx: mpsc::UnboundedSender<ProcessLine>) {
    let reader = BufReader::new(stderr);
    let mut lines = reader.lines();
    while let Ok(Some(line)) = lines.next_line().await {
        if tx.send(ProcessLine::Stderr(line)).is_err() {
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
        let (tx, mut rx) = mpsc::unbounded_channel::<ProcessLine>();

        tokio::spawn(stream_lines(stdout, tx));

        let mut lines = vec![];
        while let Some(pl) = rx.recv().await {
            match pl {
                ProcessLine::Stdout(line) => lines.push(line),
                ProcessLine::Stderr(_) => {}
            }
        }

        assert!(!lines.is_empty());
        assert!(lines[0].contains("hello world"));
    }
}
