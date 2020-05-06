const downloadGamedata = require('./gamedata')
const downloadClothes = require('./clothes')
const downloadEffects = require('./effects')

async function main () {
  await downloadGamedata();
  // await downloadClothes();
  await downloadEffects();
}

main()