await Bun.build({
    entrypoints: ['./index.ts'],
    outdir: './out',
    external: [
        'node:crypto',
        'node:child_process',
        'node:fs',
        'node:path',
        'node:os',
        'node:process',
        'node:fs/promises',
    ], // default: []
    target: 'node',
    minify: false,
});
export {};
