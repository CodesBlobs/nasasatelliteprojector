// Webpack loader: replaces octal escape sequences that are illegal in
// strict-mode template literals (\1–\7, \00–\09).
//
// The parser must correctly skip:
//   - backticks inside regular strings ("..." and '...')
//   - escaped backticks (\`) inside template literals (they don't close the template)
//   - backslash sequences inside strings/templates so the next char isn't mis-parsed
function fixOctals(source) {
  let out = ''
  let i = 0
  // 'none' | 'double' | 'single' | 'template'
  let mode = 'none'

  while (i < source.length) {
    const ch = source[i]

    // Handle backslash escape sequences — skip both chars to avoid misreading
    // the escaped char as a quote/backtick delimiter
    if (ch === '\\' && mode !== 'none') {
      const next = source[i + 1]

      // Inside a template literal: fix illegal octals before consuming
      if (mode === 'template') {
        // \1–\7 (illegal single-digit octal)
        if (next >= '1' && next <= '7') {
          let oct = next; let j = i + 2
          while (j < i + 4 && source[j] >= '0' && source[j] <= '7') oct += source[j++]
          out += `\\x${parseInt(oct, 8).toString(16).padStart(2, '0')}`
          i = j; continue
        }
        // \0 followed by another digit (\00–\09)
        if (next === '0' && source[i + 2] >= '0' && source[i + 2] <= '9') {
          let oct = '0' + source[i + 2]; let j = i + 3
          if (j < source.length && source[j] >= '0' && source[j] <= '7') oct += source[j++]
          out += `\\x${parseInt(oct, 8).toString(16).padStart(2, '0')}`
          i = j; continue
        }
      }

      // Skip the escape sequence (backslash + next char) without re-evaluating
      out += ch + (next ?? ''); i += 2; continue
    }

    // Toggle string modes
    if (ch === '"' && mode === 'none') { mode = 'double'; out += ch; i++; continue }
    if (ch === '"' && mode === 'double') { mode = 'none'; out += ch; i++; continue }
    if (ch === "'" && mode === 'none') { mode = 'single'; out += ch; i++; continue }
    if (ch === "'" && mode === 'single') { mode = 'none'; out += ch; i++; continue }
    if (ch === '`' && mode === 'none') { mode = 'template'; out += ch; i++; continue }
    if (ch === '`' && mode === 'template') { mode = 'none'; out += ch; i++; continue }

    out += ch; i++
  }

  return out
}

module.exports = function octalEscapeLoader(source) {
  return fixOctals(source)
}

module.exports.fixOctals = fixOctals
