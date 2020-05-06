const JPEXS = require("jpexs-flash-decompiler");
const { join, basename, dirname } = require("path");
const { Observable } = require("rxjs");
const { mergeMap, map, tap } = require("rxjs/operators");
const { readDir } = require("./fs");
const { rename, mkdirSync } = require("fs");
const { out } = require("../config");

function normalizeFilename(filepath) {
  filepath = join(out, filepath);
  return new Observable(obs => {
    const filedir = dirname(filepath);
    const filename = basename(filepath);
    const newFilename = filename.replace(/^\d+_/, "");
    const newFilepath = join(filedir, newFilename);

    if (newFilepath === filepath) {
      obs.next(newFilepath)
      obs.complete()
      return;
    }
    rename(filepath, newFilepath, e => {
      if (e) return obs.error(e);
      obs.next(newFilepath);
      obs.complete();
    });
  });
}

/**
 * Extract a SWF file
 * @param {String} file
 * @param {Array<JPEXS.ITEM>} items
 */
function extractSWF(file, items) {
  return new Observable(obs => {
    const output = join(".jpexs", file);
    JPEXS.export(
      {
        file: join(out, file),
        output: join(out, output),
        items
      },
      async error => {
        if (error) obs.error(error);
        await readDir(output)
          .pipe(
            mergeMap(() => readDir(output)),
            mergeMap((dir) => readDir(dir)),
            mergeMap(normalizeFilename, 5),
            tap(filename => console.log(`Normalized: ${filename}`))
          )
          .toPromise();
        obs.next(output);
        obs.complete();
      }
    );
  });
}

module.exports = {
  extractSWF,
  ITEM: JPEXS.ITEM
};
