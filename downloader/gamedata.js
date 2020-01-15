const { download, loadVariables, writeFile } = require("./util");
const config = require("./config");
const JPEXS = require('jpexs-flash-decompiler')
const path = require('path')
const fs = require('fs')
const xml = require('xml2js')

function extractSWF() {
  const out = path.join(config.out, '.jpexs_output/Habbo.swf')
  return;
  if (fs.existsSync(out)) return;
  return new Promise((resolve, reject) => {
    JPEXS.export({
      file: path.join(config.out, 'Habbo.swf'),
      out: out,
      items: [JPEXS.ITEM.BINARY]
    }, async e => {
      if (e) return reject(e)
      resolve()
    })
  })
}

async function parsePartsetsFile () {
  const partSetsFile = path.join(config.out, '.jpexs_output/Habbo.swf/119__-1-7.bin')
  const { partSets } = await xml.parseStringPromise(fs.readFileSync(partSetsFile))
  const parsed = {
    partSets: partSets.partSet[0].part.reduce((acc, part) => ({
      ...acc,
      [part.$['set-type']]: {
        flipped_type: part.$['flipped-set-type'],
        swim: part.$.swim && Number(part.$.swim)
      }
    }), {}),
    activePartSets: partSets.activePartSet.reduce((acc, active) => ({
      ...acc,
      [active.$.id]: active.activePart.map(p => p.$['set-type'])
    }), {})
  }

  writeFile(`partsets.json`, JSON.stringify(parsed))
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
    "Habbo.swf": `${config.protocol}:${external_variables["flash.dynamic.avatar.download.url"]}/Habbo.swf`
  });

  await extractSWF()
  await parsePartsetsFile()

  config.gamedata = {
    external_variables
  };
}

module.exports = gamedata;
