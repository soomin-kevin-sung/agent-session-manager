use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{ChildStderr, ChildStdout};
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
        #[cfg(target_os = "windows")]
        let mut command = {
            let mut command = Command::new("cmd");
            command.args(["/C", "echo hello world"]);
            command
        };

        #[cfg(not(target_os = "windows"))]
        let mut command = {
            let mut command = Command::new("sh");
            command.args(["-c", "printf '%s\n' 'hello world'"]);
            command
        };

        let mut child = command
            .stdout(std::process::Stdio::piped())
            .spawn()
            .expect("failed to spawn stdout test command");

        let stdout = child.stdout.take().unwrap();
        let (tx, mut rx) = mpsc::unbounded_channel::<ProcessLine>();

        let handle = tokio::spawn(stream_lines(stdout, tx));

        // Wait for the process to finish
        child.wait().await.ok();

        // Wait for the reader task to finish
        handle.await.ok();

        // Now collect all lines
        let mut lines = vec![];
        while let Ok(line) = rx.try_recv() {
            lines.push(line);
        }

        assert!(!lines.is_empty());
        match &lines[0] {
            ProcessLine::Stdout(text) => assert!(
                text.contains("hello"),
                "Expected 'hello' in output, got: {}",
                text
            ),
            ProcessLine::Stderr(_) => panic!("Expected Stdout line"),
        }
    }
}
