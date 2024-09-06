import { exit } from 'node:process';
import { main } from './cmd/main.js';
main().catch((error) => {
    console.error('An error occurred:', error);
    exit(1);
});
