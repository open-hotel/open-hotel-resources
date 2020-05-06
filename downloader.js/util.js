const http = require("http");
const https = require("https");
const { parse } = require("url");
const readline = require("readline");
const { dirname, join } = require("path");
const { Readable } = require("stream");
const {
  createWriteStream,
  createReadStream,
  mkdirSync,
  readFileSync,
  existsSync,
  writeFileSync
} = require("fs");
const { out } = require("./config");

/**
 * Make a HTTP Request
 * @param {string} url
 */
async function fetch(url) {
  if (!url) return;
  url = parse(url);
  const client = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    client.get(
      {
        host: url.host,
        path: url.path,
        headers: {
          "User-Agent": "Habbo"
        }
      },
      res => {
        const { location = null } = res.headers;
        if (res.statusCode % 300 < 99) {
          resolve(fetch(location));
        } else if (res.statusCode % 200 < 99) {
          resolve(res);
        } else {
          return reject(
            new Error(`Request Failed with status code ${res.statusCode}.`)
          );
        }
      }
    );
  });
}

/**
 * Write a stream in file
 * @param {String} filename
 * @param {Readable} stream
 */
function write(filename, stream) {
  const dir = dirname(filename);

  return new Promise((resolve, reject) => {
    mkdirSync(dir, { recursive: true });
    const fileStream = createWriteStream(filename);
    stream.pipe(fileStream);
    stream.on("error", reject);
    fileStream.on("error", reject);
    stream.on("end", resolve);
  });
}

/**
 * Download Assets
 * @param {Record<String, String>} items
 */
async function download(
  items = {},
  progress = async (filename, url, loaded, total) =>
    console.log(`Downloading [${loaded} of ${total}] ${filename}...`)
) {
  const entries = Object.entries(items);
  const total = entries.length;
  let downloaded = 0;
  for (let [filename, url] of Object.entries(items)) {
    filename = join(out, filename);
    if (!existsSync(filename)) {
      const stream = await fetch(url);
      if (stream) {
        await write(filename, stream);
      }
    }
    await progress(filename, url, ++downloaded, total);
  }
}

/**
 * Get a file from ouput folder
 * @param {string} filename
 */
function readFile(filename, stream = true) {
  filename = join(out, filename);
  return stream ? createReadStream(filename) : readFileSync(filename);
}
/**
 * Write a file from ouput folder
 * @param {string} filename
 */
function writeFile(filename, data) {
  filename = join(out, filename);
  mkdirSync(dirname(filename), { recursive: true });
  return data ? writeFileSync(filename, data) : createWriteStream(filename);
}

/**
 * Load a variables file
 * @param {string} filename
 * @param {(key, value) => boolean} filter
 */
function loadVariables(filename, filter = (key, value) => true) {
  return new Promise((resolve, reject) => {
    const vars = {};
    const interface = readline.createInterface({
      terminal: false,
      input: readFile(filename)
    });

    interface.on("line", line => {
      line = line.trim();
      if (!line) return;
      const [key, value] = line.split("=");
      if (!filter(key, value)) return;
      vars[key] = value;
    });

    interface.on("close", () => {
      for (let [key, value] of Object.entries(vars)) {
        value = value.replace(/\$\{([^}]+)\}/gim, (_, key) => {
          return key in vars ? vars[key] : _;
        });

        try {
          vars[key] = JSON.parse(value);
        } catch (e) {
          vars[key] = value;
        }
      }
      resolve(vars);
    });
  });
}

/**
 * Parse a template string
 * @param {string} template
 * @param {Record<String, any>} vars
 */
function parseTemplate(template, vars = {}) {
  return template.replace(/%([^%]+)%/gim, (match, name) => {
    return name in vars ? vars[name] : match;
  });
}

module.exports = {
  fetch,
  download,
  loadVariables,
  readFile,
  writeFile,
  parseTemplate
};
