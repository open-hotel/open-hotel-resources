const { from } = require("rxjs");
const { mergeMap, mapTo, last, tap } = require("rxjs/operators");
const { writeFile } = require("./fs");
const fetch = require("./fetch");

const fetchFile = ([file, url]) => fetch({ url, file });
const saveFile = ({ stream, file }) => writeFile(file, stream).pipe(
  last(),
  mapTo(file)
);

const progress = (loaded, total, file) => console.log(`[${loaded}/${total}] Downloaded ${file}...`)

function download(items = {}, concurently = 1) {
  const urls = Object.entries(items);
  const total = urls.length;
  let loaded = 0;
  return from(urls).pipe(
    mergeMap(fetchFile, concurently),
    mergeMap(saveFile),
    tap((file) => progress(++loaded, total, file))
  );
}

module.exports = download;
