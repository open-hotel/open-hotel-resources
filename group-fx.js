const fs = require('fs')
const xml2Js = require('xml2js')
const xmlFiles = fs.readdirSync('resources/.jpexs_output/hh_human_fx/binaryData')
const assets = fs.readdirSync('raw/hh_human_fx').filter(f => /\.png/.test(f));
const manifest = xmlFiles.splice(xmlFiles.findIndex(f => /hh_human_fx_manifest\.bin$/.test(f)), 1)[0];

async function load () {
  for (const file of assets) {
    const exp = /^hh_human_fx_[sh]_[a-z]+(_[a-z]+)?_([^_]+)/;
    let fxName = exp.exec(file);
    if (!fxName) {
      console.log(exp, file)
      continue;
    };
    fxName = fxName[2];
    fs.mkdirSync(`raw/hh_human_fx/${fxName}`, { recursive: true });
    fs.renameSync(`raw/hh_human_fx/${file}`, `raw/hh_human_fx/${fxName}/${file}`)
  }
}

load()