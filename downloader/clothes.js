const JPEXS = require("jpexs-flash-decompiler");
const XML = require("xml2js");
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

const toJSON = value => {
  try {
    return JSON.parse(value);
  } catch (e) {
    return value;
  }
};

/**
 * Convert figuredata.xml to JSON
 * @param {string} filename
 */
async function FigureDataXMLToJSON() {
  const figuredataStream = readFile("figuredata.xml", false);

  const { figuredata } = await XML.parseStringPromise(figuredataStream, {
    attrValueProcessors: [toJSON]
  });

  const figuredataJSON = {
    palette: figuredata.colors.reduce((acc, { palette }) => (
      {
        ...acc,
        ...palette.reduce((acc, palette) => ({
          ...acc,
          [palette.$.id]: palette.color.reduce((acc, color) => ({
            ...acc,
            [color.$.id]:{
              ...color.$,
              color: color._,
              id: undefined
            }
          }), {})
        }), {})
      }
    ), {}),
    settype: figuredata.sets[0].settype.reduce((acc, type) => {
      acc[type.$.type] = {
        ...type.$,
        type: undefined,
        set: type.set.reduce((acc, set) => {
          acc[set.$.id] = {
            ...set.$,
            id: undefined,
            parts: set.part.map((part) => part.$),
            hiddenlayers: set.hiddenlayers && set.hiddenlayers[0].layer.map((part) => part.$.parttype),
          };
          return acc;
        }, {}),
      };
      return acc;
    }, {})
  };

  writeFile("figuredata.json", JSON.stringify(figuredataJSON));

  return figuredataJSON;
}

async function FigureMapXMLToJSON() {
  const figuredataStream = readFile("figuremap.xml", false);
  const {
    map: { lib }
  } = await XML.parseStringPromise(figuredataStream, {
    attrValueProcessors: [toJSON]
  });
  const figuremapJSON = lib.reduce(
    (acc, lib, index) => {
      acc.libs[index] = lib.$;
      acc.parts = {
        ...acc.parts,
        ...lib.part.reduce((acc, part) => {
          acc[part.$.type] = acc[part.$.type] || {};
          acc[part.$.type][part.$.id] = index;

          return acc;
        }, acc.parts)
      };

      return acc;
    },
    {
      libs: [],
      parts: {}
    }
  );

  writeFile("figuremap.json", JSON.stringify(figuremapJSON));

  return figuremapJSON;
}

async function downloadClothes() {
  const figuredata = await FigureDataXMLToJSON();
  const figuremap = await FigureMapXMLToJSON();

  const {
    "flash.dynamic.avatar.download.url": baseURL,
    "flash.dynamic.avatar.download.name.template": urlTemplate
  } = config.gamedata.external_variables;

  const files = figuremap.libs.reduce((acc, lib) => {
    const filename = parseTemplate(urlTemplate, { libname: lib.id });
    const outFilename = `swf/clothes/${filename}`;
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
    const output = join(config.out, ".jpexs_output", lib);
    const dirname = join(config.out, "clothes", lib);

    if (existsSync(dirname)) {
      await rimraf(file);
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
  const dirname = join(config.out, "clothes", lib);
  const images_dir = join(output_dir, "images");
  const binary_dir = join(output_dir, "binaryData");

  const images = readdirSync(images_dir);
  const libXML = readFileSync(
    join(
      binary_dir,
      readdirSync(binary_dir)
        .filter(f => {
          return f.replace(/^\d+_/, "") === `${lib}_manifest.bin`;
        })
        .shift()
    )
  );
  const libJSON = await XML.parseStringPromise(libXML);

  const offsets = libJSON.manifest.library[0].assets.reduce(
    (acc, { asset }) => {
      return {
        ...acc,
        ...asset.reduce((acc, asset) => {
          const param = asset.param || [];
          const offsetParam = param.find(({ $ }) => $.name === "offset");
          
          if (!offsetParam) return acc;
          
          const [x, y] = offsetParam.$.value.split(",").map(parseFloat);
          acc[asset.$.name] = {
            x,
            y
          };
          return acc;
        }, {})
      };
    },
    {}
  );

  writeFile(join("clothes", lib, "offsets.json"), JSON.stringify(offsets));

  for (const image of images) {
    const filename = join(dirname, image.replace(/^\d+_/, ""));
    mkdirSync(dirname, { recursive: true });
    renameSync(join(images_dir, image), filename);
  }

  rimraf(output_dir);
}

module.exports = downloadClothes;
