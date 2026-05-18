import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

export function readRepoFile(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

export function listMigrationSql(): string[] {
  const dir = join(repoRoot, "supabase/migrations");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(join(dir, f), "utf8"))
    .join("\n");
}

export function listSourceFiles(): string[] {
  const walk = (dir: string): string[] => {
    const entries = readdirSync(dir, { withFileTypes: true });
    return entries.flatMap((e) => {
      const p = join(dir, e.name);
      if (e.isDirectory() && e.name !== "test" && e.name !== "ui") return walk(p);
      if (e.isFile() && /\.(ts|tsx)$/.test(e.name)) return [readFileSync(p, "utf8")];
      return [];
    });
  };
  return walk(join(repoRoot, "src"));
}
