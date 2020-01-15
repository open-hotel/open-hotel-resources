const fs = require("fs");
const { spawnSync } = require("child_process");
const ignore = require("ignore").default;

const ig = ignore().add(fs.readFileSync(`${__dirname}/.ignore`).toString());

const INPUT_DIR = `${__dirname}/raw`
const OUTPUT_DIR = `${__dirname}/dist`

const folders = fs
  .readdirSync(INPUT_DIR, { withFileTypes: true })
  .reduce((items, item) => {
    if (item.isDirectory() && !ig.ignores(item.name)) {
      items.push(item.name);
    }

    return items;
  }, []).map(exportLib).map(exportOffsets);

function exportLib(name, i, items) {
  console.clear()
  console.log(`[${(((i + 1) / items.length) * 100).toPrecision(3)}%] Exporting ${name}...`)
  spawnSync(
    "TexturePacker",
    [
      `${INPUT_DIR}/${name}`,
      '--format', 'pixijs4',
      '--sheet', `${OUTPUT_DIR}/${name}/${name}.png`,
      '--data', `${OUTPUT_DIR}/${name}/${name}.json`,
    ],
    {
      cwd: __dirname
    }
  );

  return name
}

function exportOffsets (name, i, items) {
  console.clear()
  console.log(`[${(((i + 1) / items.length) * 100).toPrecision(3)}%] Apply offsets of ${name}...`);

  const sheetFile = `${OUTPUT_DIR}/${name}/${name}.json`
  const offsetFile = `${INPUT_DIR}/${name}/offset.json`

  if (!fs.existsSync(sheetFile) || !fs.existsSync(offsetFile)) return;

  const sheetData = fs.readFileSync(sheetFile, { encoding: 'utf8' })
  if (sheetData === 'undefined') return;
  const offsetData = fs.readFileSync(offsetFile, { encoding: 'utf8' })

  
  const sheet = JSON.parse(sheetData)
  const offsets = JSON.parse(offsetData)

  sheet.meta.offset = sheet.meta.offset || {}

  for (const [frameName, value] of Object.entries(offsets)) {
    const textureName = `${name}_${frameName}.png`
    sheet.meta.offset[textureName] = {
      x: Number(value.x),
      y: Number(value.y),
    }
  }

  fs.writeFileSync(sheetFile, JSON.stringify(sheet))
}
