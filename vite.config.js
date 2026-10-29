import { defineConfig } from "vite";
import { cpSync, copyFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

export default defineConfig({
  base: "./",
  plugins: [
    {
      name: "copy-class-assets",
      apply: "build",
      closeBundle() {
        cpSync(resolve(__dirname, "asset"), resolve(__dirname, "dist", "asset"), {
          recursive: true,
        });
        mkdirSync(resolve(__dirname, "dist", "js"), { recursive: true });
        for (const file of ["data.js", "supabase-config.js"]) {
          copyFileSync(
            resolve(__dirname, "js", file),
            resolve(__dirname, "dist", "js", file),
          );
        }
      },
    },
  ],
});
