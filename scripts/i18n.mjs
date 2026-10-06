#!/usr/bin/env node
/**
 * Übersetzungen pflegen. Schlüssel sind die deutschen Texte aus dem Quelltext.
 *
 *   node scripts/i18n.mjs check              fehlende Übersetzungen melden (Exit 1) – Teil von `pnpm check`
 *   node scripts/i18n.mjs todo [datei.json]  fehlende Texte als JSON ausgeben (Standard: .check/i18n-todo.json)
 *   node scripts/i18n.mjs merge datei.json   Übersetzungen {"Text": "Text"|null} einarbeiten;
 *                                            null oder unverändert = keine Übersetzung nötig (Ignorierliste)
 *   node scripts/i18n.mjs unused [--prune]   Wörterbucheinträge ohne Fundstelle im Quelltext (ggf. entfernen)
 *
 * Gesucht wird in apps/mobile/src, apps/api/src und packages/core/src (ohne Tests und Wörterbücher).
 * Platzhalter in Mustern: „Konto {0}“ (aus `Konto ${name}`).
 */
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCES = ['apps/mobile/src', 'apps/api/src', 'packages/core/src'];
const EN_FILE = join(root, 'packages/core/src/locales/en.ts');
const IGNORE_FILE = join(root, 'scripts/i18n-ignore.json');
const EXTRA_FILE = join(root, 'scripts/i18n-extra.json');

const SKIP_FILE = /(\.test\.tsx?|\.d\.ts|\/locales\/|\/i18n\.ts|expo-env)/;
const SKIP_ATTRS = new Set([
  'style',
  'key',
  'testID',
  'name',
  'accessibilityRole',
  'href',
  'uri',
  'type',
  'variant',
  'tone',
  'size',
  'icon',
  'color',
  'edges',
  'keyboardType',
  'autoCapitalize',
  'autoComplete',
  'textContentType',
  'mode',
  'resizeMode',
  'role',
  'id',
  'value',
  'source',
  'pointerEvents',
  'behavior',
  'returnKeyType',
  'numberOfLines',
  'contentFit',
  'animationType',
  'presentation',
  'headerShown',
  'tabBarIcon',
  'fill',
  'stroke',
  'viewBox',
  'd',
  'transform',
  'strokeLinecap',
  'strokeLinejoin',
  'textAnchor',
  'fontFamily',
  'fontWeight',
  'fontStyle',
  'textAlign',
]);
const TEXT_PROPS = new Set([
  'label',
  'title',
  'hint',
  'subtitle',
  'text',
  'description',
  'message',
  'caption',
  'heading',
  'intro',
  'body',
  'question',
  'answer',
  'placeholder',
  'short',
  'long',
  'action',
  'cta',
  'help',
  'summary',
  'headline',
  'empty',
  'tip',
  'note',
  'name',
]);
const LOWER_CODE = /^[a-z][A-Za-z0-9_.:\-/]*$/;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !SKIP_FILE.test(p)) out.push(p);
  }
  return out;
}

/** Wirkt der Text wie eine Benutzermeldung (und nicht wie Code, Pfad oder Kennung)? */
function looksLikeText(s, viaProp) {
  const bare = s.replace(/\{\d+\}/g, '');
  if (!/[A-Za-zÄÖÜäöüß]/.test(bare)) return false;
  if (/^(https?:|\/|\.|#|@|data:|mailto:|tel:|file:)/.test(s)) return false;
  if (/^[\w.+-]+@[\w.-]+$/.test(s)) return false;
  if (/\.(png|jpe?g|svg|webp|ts|tsx|json|pdf|csv|ics)$/i.test(s) && !/\s/.test(s)) return false;
  if (/^[\w.\-/:]+$/.test(s) && /[/:]/.test(s) && !/\s/.test(s)) return false;
  if (/^[A-Z0-9_ ./:-]+$/.test(bare) && bare.length <= 8) return false;
  if (/_/.test(s) && !/\s/.test(s)) return false;
  if (/^[a-z]+[A-Z][A-Za-z0-9]*$/.test(s)) return false;
  if (LOWER_CODE.test(s) && !viaProp) return false;
  if (LOWER_CODE.test(s) && viaProp && /[.:\-/_0-9]/.test(s)) return false;
  return true;
}

function jsxText(raw) {
  // wie React: Zeilen trimmen, leere entfernen, mit Leerzeichen verbinden
  const lines = raw.split(/\r?\n/);
  const out = [];
  lines.forEach((line, i) => {
    let l = line.replace(/\t/g, ' ');
    if (i > 0) l = l.replace(/^ +/, '');
    if (i < lines.length - 1) l = l.replace(/ +$/, '');
    if (l) out.push(l);
  });
  return out
    .join(' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

/** Mögliche Texte eines Ausdrucks, wenn er nur aus Zeichenketten und Bedingungen besteht; sonst null. */
function literalAlternatives(e) {
  if (ts.isParenthesizedExpression(e)) return literalAlternatives(e.expression);
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return [e.text];
  if (ts.isConditionalExpression(e)) {
    const a = literalAlternatives(e.whenTrue);
    const b = literalAlternatives(e.whenFalse);
    return a && b ? [...a, ...b] : null;
  }
  return null;
}

function propName(node) {
  const p = node.parent;
  if (p && ts.isPropertyAssignment(p) && p.initializer === node) {
    return ts.isIdentifier(p.name) || ts.isStringLiteral(p.name) ? p.name.text : null;
  }
  if (p && ts.isJsxExpression(p) && p.parent && ts.isJsxAttribute(p.parent))
    return p.parent.name.text;
  return null;
}

export function extractKeys() {
  const found = new Map(); // key -> Set(file)
  const add = (key, file, viaProp) => {
    // Zusammengesetzte Texte („A · B · C“) werden zur Laufzeit am „ · “ geteilt: Schlüssel je Teil
    for (const piece of key.split(/\s*·\s*/)) {
      const t = piece.trim();
      if (!t || !looksLikeText(t, viaProp)) continue;
      if (!found.has(t)) found.set(t, new Set());
      found.get(t).add(file);
    }
  };
  for (const src of SOURCES) {
    for (const file of walk(join(root, src))) {
      const rel = relative(root, file);
      const sf = ts.createSourceFile(
        file,
        readFileSync(file, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
        file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      );
      const visit = (node) => {
        if (
          ts.isImportDeclaration(node) ||
          ts.isExportDeclaration(node) ||
          ts.isTypeNode(node) ||
          ts.isInterfaceDeclaration(node) ||
          ts.isTypeAliasDeclaration(node)
        )
          return;
        if (ts.isJsxElement(node) || ts.isJsxFragment(node)) {
          // Text mit eingestreuten Ausdrücken („{n} Spieler, davon {m} verfügbar“) als ein Muster;
          // bedingte Wortwahl wird zu eigenen Varianten aufgefächert
          const kids = node.children;
          const isLiteralish = (e) => literalAlternatives(e) !== null;
          const plain = kids.every(
            (c) =>
              ts.isJsxText(c) ||
              (ts.isJsxExpression(c) &&
                c.expression &&
                (isLiteralish(c.expression) ||
                  (!ts.isConditionalExpression(c.expression) &&
                    !ts.isJsxElement(c.expression) &&
                    !ts.isJsxSelfClosingElement(c.expression) &&
                    !ts.isJsxFragment(c.expression) &&
                    !(
                      ts.isBinaryExpression(c.expression) &&
                      /^(&&|\|\||\?\?)$/.test(c.expression.operatorToken.getText())
                    ) &&
                    !(
                      ts.isCallExpression(c.expression) &&
                      /\.map$/.test(c.expression.expression.getText())
                    )))),
          );
          if (
            plain &&
            kids.some((c) => ts.isJsxExpression(c)) &&
            kids.some((c) => ts.isJsxText(c) && /[A-Za-zÄÖÜäöüß]/.test(c.getText()))
          ) {
            let variants = [''];
            let idx = 0;
            for (const c of kids) {
              if (ts.isJsxText(c)) variants = variants.map((v) => v + c.text);
              else {
                const alts = literalAlternatives(c.expression);
                if (alts && variants.length * alts.length <= 16)
                  variants = variants.flatMap((v) => alts.map((a) => v + a));
                else {
                  variants = variants.map((v) => `${v}{${idx}}`);
                  idx++;
                }
              }
            }
            for (const v of variants)
              add(
                jsxText(v.replace(/\{(\d)\}/g, '\u0001$1\u0002')).replace(
                  /\u0001(\d)\u0002/g,
                  '{$1}',
                ),
                rel,
                false,
              );
            kids.forEach((c) => ts.isJsxExpression(c) && c.expression && visit(c.expression));
            return;
          }
        }
        if (ts.isJsxText(node)) add(jsxText(node.text), rel, false);
        else if (ts.isJsxAttribute(node) && SKIP_ATTRS.has(node.name.text)) return;
        else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
          const p = node.parent;
          const skip =
            (p &&
              (ts.isImportDeclaration(p) ||
                ts.isExternalModuleReference(p) ||
                ts.isLiteralTypeNode(p) ||
                ts.isCaseClause(p) ||
                ts.isElementAccessExpression(p) ||
                ts.isEnumMember(p))) ||
            (p && ts.isPropertyAssignment(p) && p.name === node) ||
            (p &&
              ts.isBinaryExpression(p) &&
              /^(===|!==|==|!=)$/.test(p.operatorToken.getText())) ||
            (p &&
              ts.isCallExpression(p) &&
              /^(require|import|Symbol)$/.test(p.expression.getText())) ||
            (p &&
              ts.isCallExpression(p) &&
              /(\.(includes|startsWith|endsWith|split|replace|replaceAll|match|test|localeCompare|get|has|set|add|delete|push|invalidateQueries|setQueryData|getItem|setItem|removeItem|select|query)|^(sql|eq|inArray|useLocalSearchParams|useRouter|z\.[a-z]+|api|request|send|isoDate|formatDay))$/.test(
                p.expression.getText(),
              ) &&
              p.arguments[0] === node &&
              !/\.(push)$/.test(p.expression.getText()));
          if (!skip) add(node.text, rel, propName(node) !== null && TEXT_PROPS.has(propName(node)));
        } else if (ts.isTemplateExpression(node)) {
          // Bedingte Wortwahl („${n === 1 ? 'Tor' : 'Tore'}“) wird zu eigenen Mustern aufgefächert
          let variants = [node.head.text];
          let idx = 0;
          for (const span of node.templateSpans) {
            const alts = literalAlternatives(span.expression);
            if (alts && variants.length * alts.length <= 16) {
              variants = variants.flatMap((v) => alts.map((a) => v + a + span.literal.text));
            } else {
              variants = variants.map((v) => `${v}{${idx}}${span.literal.text}`);
              idx++;
            }
          }
          const key = variants[0];
          const p = node.parent;
          const skipT =
            (p &&
              ts.isCallExpression(p) &&
              /(\.(get|set|has|delete|invalidateQueries|setQueryData|getItem|setItem)|^(sql|api|request|send|fetch|useLocalSearchParams|router\.(push|replace|navigate)|Linking\.openURL))$/.test(
                p.expression.getText(),
              )) ||
            (p &&
              ts.isJsxExpression(p) &&
              p.parent &&
              ts.isJsxAttribute(p.parent) &&
              /^(href|source|uri)$/.test(p.parent.name.text)) ||
            (p &&
              ts.isPropertyAssignment(p) &&
              /^(queryKey|url|href|path|key|id)$/.test(p.name.getText()));
          if (!skipT)
            for (const v of variants)
              add(v, rel, propName(node) !== null && TEXT_PROPS.has(propName(node)));
          node.templateSpans.forEach((span) => visit(span.expression));
          return;
        }
        ts.forEachChild(node, visit);
      };
      visit(sf);
    }
  }
  const extra = readJson(EXTRA_FILE, []);
  for (const k of extra) if (!found.has(k)) found.set(k, new Set(['scripts/i18n-extra.json']));
  return found;
}

const readJson = (file, fallback) => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
};

async function readEn() {
  const src = readFileSync(EN_FILE, 'utf8');
  const body = src.slice(src.indexOf('= {') + 2, src.lastIndexOf('};') + 1);
  return new Function(`return (${body})`)();
}

function writeEn(dict) {
  const keys = Object.keys(dict).sort((a, b) => a.localeCompare(b, 'de'));
  const lines = keys.map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(dict[k])},`);
  writeFileSync(
    EN_FILE,
    `/** Englisches Wörterbuch (Schlüssel = deutscher Text). Gepflegt über \`node scripts/i18n.mjs\`. */\nexport const en: Record<string, string> = {\n${lines.join('\n')}\n};\n`,
  );
}

async function todo() {
  const keys = extractKeys();
  const en = await readEn();
  const ignore = new Set(readJson(IGNORE_FILE, []));
  const missing = [...keys.keys()].filter((k) => !(k in en) && !ignore.has(k));
  return { keys, missing, en, ignore };
}

const [cmd, arg] = process.argv.slice(2);
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (cmd === 'check') {
    const { keys, missing, en } = await todo();
    if (missing.length) {
      console.error(`✗ ${missing.length} Texte ohne englische Übersetzung, z. B.:`);
      for (const k of missing.slice(0, 8)) console.error(`  - ${k}`);
      console.error('  Alle: node scripts/i18n.mjs todo');
      process.exit(1);
    }
    console.log(`✓ ${keys.size} Texte, ${Object.keys(en).length} übersetzt`);
  } else if (cmd === 'todo') {
    const { missing, keys } = await todo();
    const out = arg ?? join(root, '.check/i18n-todo.json');
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(Object.fromEntries(missing.map((k) => [k, ''])), null, 1));
    console.log(`${missing.length} fehlend von ${keys.size} → ${out}`);
  } else if (cmd === 'merge') {
    const incoming = JSON.parse(readFileSync(arg, 'utf8'));
    const en = await readEn();
    const ignore = new Set(readJson(IGNORE_FILE, []));
    let added = 0;
    for (const [k, v] of Object.entries(incoming)) {
      if (v === null || v === k || v === '') ignore.add(k);
      else {
        en[k] = v;
        added++;
      }
    }
    writeEn(en);
    writeFileSync(IGNORE_FILE, JSON.stringify([...ignore].sort(), null, 1) + '\n');
    console.log(`${added} übersetzt, ${ignore.size} ignoriert`);
  } else if (cmd === 'unused') {
    const keys = extractKeys();
    const en = await readEn();
    const unused = Object.keys(en).filter((k) => !keys.has(k));
    if (process.argv.includes('--prune')) {
      for (const k of unused) delete en[k];
      writeEn(en);
    } else console.log(unused.join('\n'));
    console.log(
      `${unused.length} ohne Fundstelle${process.argv.includes('--prune') ? ' (entfernt)' : ''}`,
    );
  } else {
    console.error('Aufruf: node scripts/i18n.mjs check|todo|merge|unused');
    process.exit(2);
  }
}
