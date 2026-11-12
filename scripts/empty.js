// Stand-in for the Node modules (fs/promises, path) that the Node build of kokoro-js imports as defaults; the
// browser path of kokoro-js checks for readFile and finds none. See scripts/build.mjs.
export default {};
