import { spawn } from 'node:child_process';
export function runCommand(command, args, path) {
    return new Promise((resolve, reject) => {
        const process = spawn(command, args, { stdio: 'inherit', cwd: path });
        process.on('close', (code) => {
            if (code === 0) {
                resolve();
            }
            else {
                reject(new Error(`Process exited with code ${code}`));
            }
        });
        process.on('error', (error) => {
            reject(error);
        });
    });
}
