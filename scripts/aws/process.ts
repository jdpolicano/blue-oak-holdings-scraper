import { spawn } from "node:child_process";

export interface RunProcessOptions {
  cwd?: string;
  input?: string;
  progress?: string;
}

export async function runProcess(
  command: string,
  args: string[],
  options: RunProcessOptions = {},
): Promise<void> {
  await runProcessCapture(command, args, {
    ...options,
    mirrorStdoutToStderr: true,
  });
}

export async function runProcessCapture(
  command: string,
  args: string[],
  options: RunProcessOptions & { mirrorStdoutToStderr?: boolean } = {},
): Promise<string> {
  if (options.progress) {
    logProgress(options.progress);
  }

  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => {
      stdout.push(chunk);
      if (options.mirrorStdoutToStderr) {
        process.stderr.write(chunk);
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr.push(chunk);
      process.stderr.write(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(Buffer.concat(stdout).toString("utf-8").trim());
        return;
      }

      const commandText = [command, ...args].join(" ");
      const stderrText = Buffer.concat(stderr).toString("utf-8").trim();
      reject(
        new Error(
          `${commandText} failed with exit code ${code}${
            stderrText ? `: ${stderrText}` : ""
          }`,
        ),
      );
    });

    if (options.input) {
      child.stdin.end(options.input);
    } else {
      child.stdin.end();
    }
  });
}

export function logProgress(message: string): void {
  process.stderr.write(`${message}\n`);
}

export async function getGitSourceMetadata(): Promise<Record<string, unknown>> {
  const [commit, shortCommit, branch, status] = await Promise.all([
    captureGit(["rev-parse", "HEAD"]),
    captureGit(["rev-parse", "--short", "HEAD"]),
    captureGit(["rev-parse", "--abbrev-ref", "HEAD"]),
    captureGit(["status", "--short"]),
  ]);

  return {
    commit,
    shortCommit,
    branch,
    dirty: status.length > 0,
  };
}

async function captureGit(args: string[]): Promise<string> {
  try {
    return await runProcessCapture("git", args);
  } catch {
    return "";
  }
}
