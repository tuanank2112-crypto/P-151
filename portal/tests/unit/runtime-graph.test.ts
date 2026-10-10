import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
const root = path.resolve(import.meta.dirname, "../../src");
function files(dir: string): string[] { return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? files(path.join(dir, entry.name)) : /\.(ts|tsx)$/.test(entry.name) ? [path.join(dir, entry.name)] : []); }
function runtimeGraph(entries: string[]) {
  const visited = new Set<string>(); const forbidden: string[] = [];
  function visit(file: string) {
    if (visited.has(file)) return; visited.add(file);
    const relative = path.relative(root, file).replaceAll("\\", "/");
    if (/^(db\/|server\/(workflow|legacy-queries|password)|lib\/agent)/.test(relative)) forbidden.push(relative);
    const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    source.forEachChild((node) => {
      if (!(ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) || !node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) return;
      if (ts.isImportDeclaration(node) && (node.importClause?.isTypeOnly || (node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) && !node.importClause.name && node.importClause.namedBindings.elements.every((n) => n.isTypeOnly)))) return;
      if (ts.isExportDeclaration(node) && node.isTypeOnly) return;
      const target = node.moduleSpecifier.text;
      const base = target.startsWith("@/") ? path.join(root, target.slice(2)) : target.startsWith(".") ? path.resolve(path.dirname(file), target) : null;
      if (!base) return;
      const resolved = [base + ".ts", base + ".tsx", path.join(base, "index.ts")].find(fs.existsSync);
      if (resolved) visit(resolved);
    });
  }
  entries.forEach(visit); return { forbidden, visited };
}
describe("production import graph", () => {
  it("all pages/actions/photo routes are independent of portal DB and workflow", () => {
    const graph = runtimeGraph(files(path.join(root, "app")));
    expect(graph.forbidden).toEqual([]);
    expect(graph.visited.size).toBeGreaterThan(20);
    for (const file of graph.visited) expect(fs.readFileSync(file, "utf8")).not.toMatch(/Number\(\s*(?:id|ticketId|ticket_id|evidenceId)\s*\)/);
  });
  it("guard catches a legacy DB entry rather than silently permitting it", () => {
    expect(runtimeGraph([path.join(root, "server/legacy-queries.ts")]).forbidden).toContain("db/index.ts");
  });
});
