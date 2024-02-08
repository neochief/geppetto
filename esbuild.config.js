const fs = require('fs').promises;
const esbuild = require('esbuild').build;

esbuild({
    entryPoints: ['src/bin/gep.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: 'dist/bin/gep.js',
    sourcemap: 'linked',
}).catch(() => process.exit(1));