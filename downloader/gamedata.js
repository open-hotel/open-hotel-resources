const { download, loadVariables, writeFile } = require("./util");
const config = require("./config");
const JPEXS = require("jpexs-flash-decompiler");
const path = require("path");
const fs = require("fs");
const xml = require("xml2js");

const toJSON = v => {
  try {
    return JSON.parse(v);
  } catch (e) {
    return v;
  }
};

function extractSWF() {
  const file = path.join(config.out, "Habbo.swf");
  const output = path.join(config.out, "Habbo");

  if (fs.existsSync(output)) return;

  return new Promise((resolve, reject) => {
    JPEXS.export(
      {
        file,
        output,
        items: [JPEXS.ITEM.BINARY, JPEXS.ITEM.IMAGE]
      },
      async e => {
        console.log("Extracted", output);
        if (e) return reject(e);
        resolve();
      }
    );
  });
}

async function parsePartsetsFile() {
  const binDir = path.join(config.out, "Habbo/binaryData");
  const file = fs.readdirSync(binDir).find(f => /^119__/.test(f))
  const partSetsFile = path.join(binDir, file);
  const { partSets } = await xml.parseStringPromise(
    fs.readFileSync(partSetsFile),
    {
      attrValueProcessors: [toJSON]
    }
  );
  const parsed = {
    partSets: partSets.partSet[0].part.reduce(
      (acc, part) => ({
        ...acc,
        [part.$["set-type"]]: {
          flipped_type: part.$["flipped-set-type"],
          swim: part.$.swim && Number(part.$.swim)
        }
      }),
      {}
    ),
    activePartSets: partSets.activePartSet.reduce(
      (acc, active) => ({
        ...acc,
        [active.$.id]: active.activePart.map(p => p.$["set-type"])
      }),
      {}
    )
  };

  writeFile(`partsets.json`, JSON.stringify(parsed));
}

async function parseGeometryFile() {
  const binDir = path.join(config.out, "Habbo/binaryData");
  const file = fs.readdirSync(binDir).find(f => /^202__/.test(f))
  const geometryFile = path.join(binDir, file);
  const { geometry } = await xml.parseStringPromise(
    fs.readFileSync(geometryFile),
    {
      attrValueProcessors: [toJSON],
      valueProcessors: [toJSON]
    }
  );
  const parsed = {
    ...geometry.$,
    camera: {
      x: geometry.camera[0].x[0],
      y: geometry.camera[0].y[0],
      z: geometry.camera[0].z[0]
    },
    canvas: geometry.canvas.reduce(
      (obj, item) => ({
        ...obj,
        [item.$.scale]: item.geometry.reduce(
          (obj, item) => ({
            ...obj,
            [item.$.id]: {
              ...item.$,
              id: undefined
            }
          }),
          {}
        )
      }),
      {}
    ),
    avatarsets: geometry.avatarset.reduce(
      (obj, item) => ({
        ...obj,
        [item.$.id]: {
          ...item.$,
          id: undefined,
          avatarsets: item.avatarset.reduce(
            (obj, item) => ({
              ...obj,
              [item.$.id]: {
                ...item.$,
                id: undefined,
                bodyparts: item.bodypart.map(item => item.$.id)
              }
            }),
            {}
          )
        }
      }),
      {}
    ),
    types: geometry.type.reduce(
      (obj, item) => ({
        ...obj,
        [item.$.id]: {
          ...item.$,
          id: undefined,
          bodyparts: item.bodypart.reduce(
            (obj, item) => ({
              ...obj,
              [item.$.id]: {
                ...item.$,
                id: undefined,
                items:
                  item.item &&
                  item.item.reduce(
                    (obj, item) => ({
                      ...obj,
                      [item.$.id]: {
                        ...item.$,
                        id: undefined
                      }
                    }),
                    {}
                  )
              }
            }),
            {}
          )
        }
      }),
      {}
    )
  };

  writeFile("geometry.json", JSON.stringify(parsed, null, 2));
}

async function parseHumanActionsFile() {
  const actionsFile = path.join(config.out, "../HabboAvatarActions.xml");
  const { actions } = await xml.parseStringPromise(
    fs.readFileSync(actionsFile),
    {
      attrValueProcessors: [toJSON]
    }
  );
  const parsed = actions.action.reduce(
    (acc, action) => ({
      ...acc,
      [action.$.id]: {
        ...action.$,
        id: undefined,
        params:
          action.param &&
          action.param.reduce(
            (obj, param) => ({
              ...obj,
              [param.$.id]: param.$.value
            }),
            {}
          ),
        types:
          action.type &&
          action.type.reduce(
            (obj, type) => ({
              ...obj,
              [type.$.id]: {
                ...type.$,
                id: undefined
              }
            }),
            {}
          )
      }
    }),
    {}
  );

  writeFile("human-avatar-actions.json", JSON.stringify(parsed, null, 2));
}

async function gamedata() {
  await download({
    "external_variables.txt": `${config.protocol}://${config.domain}/gamedata/external_variables`
  });

  const external_variables = await loadVariables(
    "external_variables.txt",
    key =>
      [
        "flash.client.url",
        "external.figurepartlist.txt",
        "furnidata.load.url",
        "flash.dynamic.avatar.download.configuration",
        "flash.dynamic.avatar.download.url",
        "flash.dynamic.avatar.download.name.template"
      ].includes(key)
  );

  await download({
    "figuremap.xml": `${config.protocol}:${external_variables["flash.dynamic.avatar.download.configuration"]}`,
    "figuredata.xml": external_variables["external.figurepartlist.txt"],
    "furnidata.xml": external_variables["furnidata.load.url"],
    "effectmap.xml": 'https:'+external_variables["flash.client.url"] + '/effectmap.xml',
    "Habbo.swf": `${config.protocol}:${external_variables["flash.dynamic.avatar.download.url"]}/Habbo.swf`
  });

  await extractSWF();
  await parsePartsetsFile();
  await parseGeometryFile();
  await parseHumanActionsFile();

  config.gamedata = {
    external_variables
  };
}

module.exports = gamedata;
