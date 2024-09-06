import type { GHSecret } from '../types/config';
export default class GitHub {
    private token;
    private client;
    private owner;
    constructor(token: string, owner: string);
    createRepo(name: string): Promise<any>;
    delete(repo: string): Promise<any>;
    /**
     * Encrypts a secret using the sodium library.
     * The key comes from the GitHub API
     * @param secret The secret to encrypt
     * @param repo The repository the secret will be used in
     * @returns {Promise<string>} The encrypted secret
     */
    encryptSecret(secret: string, repo: string): Promise<[string, string]>;
    uploadRepoSecret(secret: GHSecret): Promise<any>;
    makeGhActionFile: () => string;
}
