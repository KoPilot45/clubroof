#!/usr/bin/env node
/**
 * Bedienungshilfen-Prüfung: antippbare Elemente ohne Text und ohne `accessibilityLabel` (Bildschirmleser sagen sonst
 * nur „Schaltfläche“). Aufruf: node scripts/a11y-audit.mjs  (Exit 1, wenn etwas fehlt) – Teil von `pnpm check`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const TEXTY = new Set(['T', 'Text', 'Chip', 'Button', 'ListRow', 'TeamBadge', 'AttendanceChip']);
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx$/.test(name)) files.push(p);
  }
})(join(root, 'apps/mobile/src'));

const problems = [];
for (const file of files) {
  const sf = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const visit = (node) => {
    if (
      ts.isJsxElement(node) &&
      ts.isIdentifier(node.openingElement.tagName) &&
      node.openingElement.tagName.text === 'Pressable'
    ) {
      const attrs = node.openingElement.attributes.properties;
      const labelled = attrs.some(
        (a) => ts.isJsxAttribute(a) && /^accessibility(Label|LabelledBy)$/.test(a.name.text),
      );
      const hasText = (n) => {
        let found = false;
        const scan = (c) => {
          if (found) return;
          if (ts.isJsxText(c) && /\S/.test(c.text)) found = true;
          if (
            (ts.isJsxOpeningElement(c) || ts.isJsxSelfClosingElement(c)) &&
            ts.isIdentifier(c.tagName) &&
            TEXTY.has(c.tagName.text)
          )
            found = true;
          if (ts.isJsxExpression(c) && c.expression && !ts.isJsxElement(c.expression)) {
            // {x} mit Textausdruck zählt als Text
            const txt = c.expression.getText();
            if (/label|title|name|text|children|main|content/i.test(txt)) found = true;
          }
          ts.forEachChild(c, scan);
        };
        node.children.forEach(scan);
        return found;
      };
      if (!labelled && !hasText(node)) {
        const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
        problems.push(`${relative(root, file)}:${line + 1}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}
if (problems.length) {
  console.error(`✗ ${problems.length} antippbare Elemente ohne Text oder accessibilityLabel:`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log('✓ alle antippbaren Elemente haben Text oder Bildschirmleser-Beschriftung');
