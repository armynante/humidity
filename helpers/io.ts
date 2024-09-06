import { spawn } from 'node:child_process';

export function runCommand(
  command: string,
  args: string[],
  path?: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args, { stdio: 'inherit', cwd: path });

    process.on('close', (code: number) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Process exited with code ${code}`));
      }
    });

    process.on('error', (error: Error) => {
      reject(error);
    });
  });
}
