const JPEXS = require("jpexs-flash-decompiler");
const cheerio = require("cheerio");
const { join, basename } = require("path");
const { promisify } = require("util");
const rimraf = promisify(require("rimraf"));
const {
  readdirSync,
  readFileSync,
  renameSync,
  mkdirSync,
  existsSync
} = require("fs");

const config = require("./config");
const { readFile, writeFile, download, parseTemplate } = require("./util");
function parseValue(value) {
  try {
    return JSON.parse(value);
  } catch (e) {
    return value;
  }
}

function filter(obj, { ignore, only } = {}) {
  return Object.entries(obj).reduce((acc, [k, v]) => {
    if (ignore && ignore.includes(k)) return acc;
    if (only && !only.includes(k)) return acc;
    return { ...acc, [k]: parseValue(v) };
  }, {});
}
async function effectMapXMLToJSON() {
  const xml = readFile("effectmap.xml", false);
  const $ = cheerio.load(xml, { xmlMode: true });

  const json = $("effect")
    .toArray()
    .reduce((data, effect) => {
      const group = (data[effect.attribs.type] =
        data[effect.attribs.type] || {});
      group[effect.attribs.id] = effect.attribs.lib;
      return data;
    }, {});

  writeFile("effectmap.json", JSON.stringify(json));

  return json;
}

async function downloadEffects() {
  const effectmap = await effectMapXMLToJSON();
  const extractedLibs = readdirSync(join(config.out)).filter(
    l => !/^Spotlight/.test(l)
  );

  const {
    "flash.dynamic.avatar.download.url": baseURL,
    "flash.dynamic.avatar.download.name.template": urlTemplate
  } = config.gamedata.external_variables;

  const files = Object.values(effectmap)
    .reduce((acc, type) => acc.concat(Object.values(type)), [])
    .filter(lib => !extractedLibs.includes(lib))
    .reduce((acc, libname) => {
      const filename = parseTemplate(urlTemplate, { libname });
      const outFilename = `swf/${filename}`;
      acc[outFilename] = `${config.protocol}:${baseURL}${filename}`;
      return acc;
    }, {});

  await download(files, async (filename, url, loaded, total) => {
    const lib = basename(filename).replace(/\.swf$/, "");
    await extract(filename, lib);
    console.log(`[${loaded} / ${total}] Extracted ${lib}`);
  });
}

function extract(file, lib) {
  return new Promise(async (resolve, reject) => {
    const output = join(config.out, lib);
    const dirname = join(config.out, lib);

    if (existsSync(dirname)) {
      await rimraf(file);
      await processLib(output, lib);
      return resolve();
    }

    JPEXS.export(
      {
        file,
        output,
        items: [JPEXS.ITEM.IMAGE, JPEXS.ITEM.BINARY]
      },
      async e => {
        if (e) return reject(e);
        await processLib(output, lib);
        await rimraf(file);
        resolve();
      }
    );
  });
}

async function processLib(output_dir, lib) {
  const images_dir = join(output_dir, "images");
  const binary_dir = join(output_dir, "binaryData");

  const images = readdirSync(images_dir);
  const animationXML = cheerio.load(
    readFileSync(
      join(
        binary_dir,
        readdirSync(binary_dir).find(f => /_animation\.bin$/.test(f))
      )
    ),
    { xmlMode: true }
  );
  const manifestXML = cheerio.load(
    readFileSync(
      join(
        binary_dir,
        readdirSync(binary_dir).find(f => /_manifest\.bin$/.test(f))
      )
    )
  );

  const animations = animationXML("animation")
    .toArray()
    .reduce((acc, animation) => {
      const frames = animationXML("frame", animation)
        .toArray()
        .map(frame => {
          return animationXML("bodypart", frame)
            .toArray()
            .reduce((acc, part) => {
              acc[part.attribs.id] = Object.entries(part.attribs).reduce(
                (acc, [key, value]) =>
                  key === "id" ? acc : { ...acc, [key]: parseValue(value) },
                {}
              );

              return acc;
            }, {});
        });

      const sprites = animationXML("sprite", animation)
        .toArray()
        .reduce((acc, sprite) => {
          acc[sprite.attribs.id] = {
            ...filter(sprite.attribs, { ignore: ["id"] }),
            directions: animationXML("direction", sprite)
              .toArray()
              .reduce((acc, dir) => {
                return {
                  ...acc,
                  [dir.attribs.id]: filter(dir.attribs, { ignore: ["id"] })
                };
              }, {})
          };
          return acc;
        }, {});

      acc[animation.attribs.name] = {
        ...animation.attribs,
        name: undefined,
        frames,
        sprites
      };
      
      return acc;
    }, {});

  writeFile(join(lib, "animations.json"), JSON.stringify(animations));

  const offsets = manifestXML("library > assets > asset")
    .toArray()
    .reduce((acc, asset) => {
      const param = manifestXML('param[key="offset"]', asset)[0];
      if (!param) return acc;
      return {
        ...acc,
        [asset.attribs.name]: param.attribs.value.split(",").map(parseFloat)
      };
    }, {});

  writeFile(join(lib, "offsets.json"), JSON.stringify(offsets));

  for (const image of images) {
    const filename = image.replace(/^\d+_/, "");
    renameSync(join(images_dir, image), join(images_dir, filename));
  }
}

module.exports = downloadEffects;
