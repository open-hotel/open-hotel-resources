const { join, dirname } = require("path");
const { Observable, from } = require("rxjs");
const { map } = require("rxjs/operators");
const { Readable } = require("stream");

const {
  createReadStream,
  readFileSync,
  mkdirSync,
  writeFileSync,
  createWriteStream,
  readdirSync
} = require("fs");
const { out } = require("../config");

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

  return new Observable(obs => {
    mkdirSync(dirname(filename), { recursive: true });
    if (data instanceof Readable) {
      const fileStream = createWriteStream(filename);

      data.on("data", data => obs.next(data));
      data.on("end", () => obs.complete());
      data.on("error", error => obs.error(error));

      data.pipe(fileStream);
    } else {
      obs.next(data);
      writeFileSync(filename, data);
      obs.complete();
    }
  });
}

function readDir (path) {
  const files = readdirSync(join(out, path))
  return from(files).pipe(map(item => join(path, item)));
}

module.exports = {
  readFile,
  writeFile,
  readDir
};
