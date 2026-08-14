import { spawn } from "node:child_process";

const [port = "3000", distDir = ".next-test"] = process.argv.slice(2);
const child = spawn(
  process.execPath,
  ["./node_modules/next/dist/bin/next", "dev", "-H", "127.0.0.1", "-p", port],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_DIST_DIR: distDir,
      BETTER_AUTH_URL: `http://127.0.0.1:${port}`,
    },
  },
);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("exit", (code) => process.exit(code ?? 0));
