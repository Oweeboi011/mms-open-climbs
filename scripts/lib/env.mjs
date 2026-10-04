// Scripts run from the repo root and read the same .env as Vite, so no key
// is ever hard-coded in a tracked file.
try {
  process.loadEnvFile();
} catch {
  // No .env — fall back to variables already set in the shell.
}

export function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}. Set it in .env (see .env.example) or the shell.`);
    process.exit(1);
  }
  return value;
}
