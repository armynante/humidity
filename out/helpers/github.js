import { Octokit } from 'octokit';
import sodium from 'libsodium-wrappers';
export default class GitHub {
    token;
    client;
    owner;
    constructor(token, owner) {
        this.token = token;
        this.owner = owner;
        this.client = new Octokit({ auth: this.token });
    }
    async createRepo(name) {
        if (!this.client) {
            throw new Error('Client not initialized');
        }
        return await this.client.request('POST /user/repos', {
            name: name,
            private: true,
            description: 'Created with Humidity CLI',
            headers: {
                'X-GitHub-Api-Version': '2022-11-28',
            },
        });
    }
    async delete(repo) {
        if (!this.client) {
            throw new Error('Client not initialized');
        }
        try {
            return await this.client.request('DELETE /repos/{owner}/{repo}', {
                owner: this.owner,
                repo: repo,
                headers: {
                    'X-GitHub-Api-Version': '2022-11-28',
                },
            });
        }
        catch (error) {
            // @ts-ignore
            if (error.status === 404) {
                console.log('Repo not found');
                return;
            }
            else {
                console.error(error);
            }
            return;
        }
    }
    /**
     * Encrypts a secret using the sodium library.
     * The key comes from the GitHub API
     * @param secret The secret to encrypt
     * @param repo The repository the secret will be used in
     * @returns {Promise<string>} The encrypted secret
     */
    async encryptSecret(secret, repo) {
        if (!this.client) {
            throw new Error('Client not initialized');
        }
        const { data } = await this.client.request('GET /repos/{owner}/{repo}/actions/secrets/public-key', {
            owner: this.owner,
            repo: repo,
            headers: {
                'X-GitHub-Api-Version': '2022-11-28',
            },
        });
        await sodium.ready;
        const binkey = sodium.from_base64(data.key, sodium.base64_variants.ORIGINAL);
        const binsec = sodium.from_string(secret);
        const encBytes = sodium.crypto_box_seal(binsec, binkey);
        const secret_encrypted = sodium.to_base64(encBytes, sodium.base64_variants.ORIGINAL);
        return [secret_encrypted, data.key_id];
    }
    async uploadRepoSecret(secret) {
        if (!this.client) {
            throw new Error('Client not initialized');
        }
        const [secret_encrypted, key_id] = await this.encryptSecret(secret.encrypted_value, secret.repo);
        if (!key_id) {
            throw new Error('Error encrypting secret');
        }
        return await this.client.request('PUT /repos/{owner}/{repo}/actions/secrets/{secret_name}', {
            owner: this.owner,
            repo: secret.repo,
            secret_name: secret.secret_name,
            encrypted_value: secret_encrypted,
            key_id: key_id,
            headers: {
                'X-GitHub-Api-Version': '2022-11-28',
            },
        });
    }
    makeGhActionFile = () => {
        return `
name: Build and Push Docker image
on:
  push:
    branches:
      - main  # Set this to the branch you want to trigger the build.

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
    - name: Check out the code
      uses: actions/checkout@v2

    - name: Install doctl
      uses: digitalocean/action-doctl@v2
      with:
        token: \${{ secrets.DIGITALOCEAN_ACCESS_TOKEN }}
    
    - name: Build container image
      run: docker build -t registry.digitalocean.com/\${{ secrets.DO_REGISTRY_NAME }}/\${{ secrets.DO_REPO_NAME }}:latest .
    
    - name: Log in to DigitalOcean Container Registry with short-lived credentials
      run: doctl registry login --expiry-seconds 1200
    
    - name: Push image to DigitalOcean Container Registry
      run: docker push registry.digitalocean.com/\${{ secrets.DO_REGISTRY_NAME }}/\${{ secrets.DO_REPO_NAME }}:latest

      `;
    };
}
// export const archiveGHProject = async (selectedProject: string) => {
//   await runCommand('gh', [
//     'repo',
//     'archive',
//     `${selectedProject.trim()}`,
//     '--yes',
//   ]);
// };
// export const deleteGHProject = async (selectedProject: string) => {
//   const proc = Bun.spawn(
//     ['gh', 'repo', 'delete', `${selectedProject.trim()}`, '--yes'],
//     {
//       cwd: process.cwd(),
//     },
//   );
//   const output = await new Response(proc.stdout).text();
//   return output;
// };
// export const createGHProject = async (projectName: string) => {
//   const proc = Bun.spawn(['gh', 'repo', 'create', projectName, '--private']);
//   const output = await new Response(proc.stdout).text();
//   return output;
// };
// export const listGHProjects = async () => {
//   const proc = Bun.spawn(['gh', 'repo', 'list'], {
//     cwd: process.cwd(),
//   });
//   const output = await new Response(proc.stdout).text();
//   const projects = [] as Record<string, string>[];
//   output.split('\n').forEach((line: string) => {
//     // split the line after any whitespace
//     const parts = line.split(/\s+/);
//     const repoName = parts[0];
//     if (repoName.length > 0) {
//       projects.push({ name: repoName, value: repoName });
//     }
//   });
//   return [projects, output];
// };
// export const viewGHProject = async (selectedProject: string) => {
//   const proc = Bun.spawn(['gh', 'repo', 'view', `${selectedProject.trim()}`], {
//     cwd: process.cwd(),
//   });
//   const output = await new Response(proc.stdout).text();
//   return output;
// };
