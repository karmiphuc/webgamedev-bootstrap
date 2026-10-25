#!/usr/bin/env node
// Kept for compatibility. Use bootstrap.mjs:
//   node create.mjs <dir> --name "X"   ==  node bootstrap.mjs <dir> --name "X"
//   node create.mjs --diff <dir>       ==  node bootstrap.mjs <dir> --check
process.argv = process.argv.map((a) => (a === "--diff" ? "--check" : a));
await import("./bootstrap.mjs");
