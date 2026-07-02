/**
 * Lightweight static analysis — extracts symbols and imports from source code
 * without native AST dependencies (hackathon-friendly, multi-language via regex).
 */

const JS_TS_EXT = /\.(js|jsx|ts|tsx|mjs|cjs)$/i;
const PY_EXT = /\.py$/i;

/**
 * @param {string} filePath
 * @returns {string[]}
 */
function extractImports(filePath, content, language) {
  const imports = [];
  const isJs = JS_TS_EXT.test(filePath) || ['javascript', 'typescript'].includes(language);
  const isPy = PY_EXT.test(filePath) || language === 'python';

  if (isJs) {
    const patterns = [
      /import\s+(?:[\w*{}\s,]+\s+from\s+)?['"]([^'"]+)['"]/g,
      /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
      /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    ];
    for (const re of patterns) {
      let m;
      while ((m = re.exec(content)) !== null) {
        if (m[1] && !m[1].startsWith('.')) imports.push(m[1]);
        else if (m[1]) imports.push(m[1]);
      }
    }
  }

  if (isPy) {
    const fromRe = /from\s+([\w.]+)\s+import/g;
    const importRe = /^import\s+([\w.]+)/gm;
    let m;
    while ((m = fromRe.exec(content)) !== null) imports.push(m[1]);
    while ((m = importRe.exec(content)) !== null) imports.push(m[1]);
  }

  return [...new Set(imports)];
}

/**
 * @param {string} filePath
 * @returns {Array<{name: string, kind: string, startLine: number, endLine: number, signature: string}>}
 */
function extractSymbols(filePath, content, language) {
  const symbols = [];
  const lines = content.split('\n');
  const isJs = JS_TS_EXT.test(filePath) || ['javascript', 'typescript'].includes(language);
  const isPy = PY_EXT.test(filePath) || language === 'python';

  if (isJs) {
    const patterns = [
      { re: /export\s+(?:async\s+)?function\s+(\w+)/g, kind: 'Function' },
      { re: /(?:async\s+)?function\s+(\w+)\s*\(/g, kind: 'Function' },
      { re: /export\s+(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(/g, kind: 'Function' },
      { re: /export\s+class\s+(\w+)/g, kind: 'Class' },
      { re: /class\s+(\w+)/g, kind: 'Class' },
      { re: /export\s+(?:const|let|var)\s+(\w+)/g, kind: 'Variable' },
    ];

    for (const { re, kind } of patterns) {
      let m;
      while ((m = re.exec(content)) !== null) {
        const name = m[1];
        if (['default', 'if', 'for', 'while'].includes(name)) continue;
        const startLine = content.slice(0, m.index).split('\n').length;
        symbols.push({
          name,
          kind,
          startLine,
          endLine: Math.min(startLine + 30, lines.length),
          signature: lines[startLine - 1]?.trim().slice(0, 120) || `${kind} ${name}`,
        });
      }
    }
  }

  if (isPy) {
    const defRe = /^(\s*)def\s+(\w+)\s*\(/gm;
    const classRe = /^(\s*)class\s+(\w+)/gm;
    let m;
    while ((m = defRe.exec(content)) !== null) {
      const startLine = content.slice(0, m.index).split('\n').length;
      symbols.push({
        name: m[2],
        kind: 'Function',
        startLine,
        endLine: Math.min(startLine + 40, lines.length),
        signature: lines[startLine - 1]?.trim().slice(0, 120) || `def ${m[2]}`,
      });
    }
    while ((m = classRe.exec(content)) !== null) {
      const startLine = content.slice(0, m.index).split('\n').length;
      symbols.push({
        name: m[2],
        kind: 'Class',
        startLine,
        endLine: Math.min(startLine + 60, lines.length),
        signature: lines[startLine - 1]?.trim().slice(0, 120) || `class ${m[2]}`,
      });
    }
  }

  const seen = new Set();
  return symbols.filter((s) => {
    const key = `${s.kind}:${s.name}:${s.startLine}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Normalize a relative file path (collapse . and .. segments).
 */
function normalizePath(path) {
  const parts = path.split('/');
  const stack = [];
  for (const part of parts) {
    if (part === '.' || part === '') continue;
    if (part === '..') stack.pop();
    else stack.push(part);
  }
  return stack.join('/');
}

/**
 * Resolve a relative import to a candidate file path within the repo.
 * @param {string} fromPath - File doing the import
 * @param {string} importPath - Raw import string
 * @param {Set<string>} allPaths - All file paths in repo
 * @returns {string|null}
 */
function resolveImportPath(fromPath, importPath, allPaths) {
  if (!importPath) return null;

  // Skip node_modules / stdlib packages — only resolve relative imports
  if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
    // Try matching by filename for local aliases
    const baseName = importPath.split('/').pop();
    const candidates = [...allPaths].filter((p) => {
      const name = p.split('/').pop().replace(/\.(jsx?|tsx?|py)$/, '');
      return name === baseName || p.endsWith(`/${importPath}`) || p.endsWith(`/${importPath}.js`)
        || p.endsWith(`/${importPath}.ts`) || p.endsWith(`/${importPath}.tsx`);
    });
    return candidates[0] || null;
  }

  const fromDir = fromPath.includes('/') ? fromPath.slice(0, fromPath.lastIndexOf('/')) : '';
  let resolved = importPath.startsWith('/')
    ? importPath.slice(1)
    : normalizePath(`${fromDir}/${importPath}`);

  const extensions = ['', '.js', '.jsx', '.ts', '.tsx', '.py', '/index.js', '/index.ts', '/index.tsx'];
  for (const ext of extensions) {
    const candidate = resolved + ext;
    if (allPaths.has(candidate)) return candidate;
  }

  return null;
}

/**
 * @param {string} content
 * @param {number} startLine
 * @param {number} endLine
 */
function extractCodeSnippet(content, startLine, endLine) {
  const lines = content.split('\n');
  return lines.slice(Math.max(0, startLine - 1), endLine).join('\n');
}

export { extractImports, extractSymbols, resolveImportPath, extractCodeSnippet };
