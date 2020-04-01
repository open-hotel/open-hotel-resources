const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const ignore = require("ignore").default;

const ig = ignore().add(fs.readFileSync(`${__dirname}/.ignore`).toString());

const INPUT_DIR = `${__dirname}/resources`;
const OUTPUT_DIR = `${__dirname}/dist`;

function progress (i, items, label) {
    console.clear()
    console.log(
      `[${(((i + 1) / items.length) * 100).toPrecision(
        3
      )}%] ${label}`
    );
}

const folders = fs
  .readdirSync(INPUT_DIR, { withFileTypes: true })
  .reduce((items, item) => {
    if (item.isDirectory() && !ig.ignores(item.name)) {
      items.push(item.name);
    }

    return items;
  }, [])
  .map(exportLib)
  .map(exportOffsets)
  .map(exportAnimations);

function exportLib(name, i, items) {
  progress(i, items, `Exporting ${name}...`)

  const args = [
    `${INPUT_DIR}/${name}/images`,
    "--format",
    "pixijs4",
    "--texture-format",
    "png8",
    "--opt",
    '--max-width', '3000',
    '--max-height', '3000',
    "RGBA4444",
    "--sheet",
    `${OUTPUT_DIR}/${name}/${name}.png`,
    "--data",
    `${OUTPUT_DIR}/${name}/${name}.json`
  ];

  console.log('TexturePacker', args.join(' '))
  spawnSync("TexturePacker", args, {
    cwd: __dirname,
    stdio: ["pipe", "pipe", "pipe"]
  });

  return name;
}

function exportOffsets(name, i, items) {
  progress(i, items, `Apply offsets of ${name}...`)

  const sheetFile = `${OUTPUT_DIR}/${name}/${name}.json`;
  const offsetFile = `${INPUT_DIR}/${name}/offsets.json`;

  if (!fs.existsSync(sheetFile) || !fs.existsSync(offsetFile)) return name;

  const sheetData = fs.readFileSync(sheetFile, { encoding: "utf8" });
  if (sheetData === "undefined") return name;
  const offsetData = fs.readFileSync(offsetFile, { encoding: "utf8" });

  const sheet = JSON.parse(sheetData);

  sheet.meta.offset = JSON.parse(offsetData);

  fs.writeFileSync(sheetFile, JSON.stringify(sheet));

  return name;
}

function exportAnimations (name, i, items) {
  const animationsFile = path.join(INPUT_DIR, name, 'animations.json');
  const animationsFileOut = path.join(OUTPUT_DIR, name, 'animations.json')

  if (!fs.existsSync(animationsFile)) return name;

  progress(i, items, `Copy animations of ${name}...`)

  fs.mkdirSync(path.dirname(animationsFileOut), { recursive: true })
  fs.copyFileSync(animationsFile, animationsFileOut)

  return name
}
