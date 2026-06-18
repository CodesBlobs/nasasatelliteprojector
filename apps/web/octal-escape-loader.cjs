// Webpack loader: replaces octal escape sequences in template literals.
// Cesium's ThirdParty/google-earth-dbroot-parser.js contains \NNN octal
// escapes inside backtick strings which are a syntax error in strict mode.
module.exports = function octalEscapeLoader(source) {
  return source.replace(
    /`((?:[^`\\]|\\[\s\S])*)`/g,
    (match) =>
      match.replace(/\\([0-7]{1,3})/g, (_, oct) => {
        const code = parseInt(oct, 8)
        return code < 0x10000
          ? `\\u${code.toString(16).padStart(4, '0')}`
          : `\\u{${code.toString(16)}}`
      }),
  )
}
