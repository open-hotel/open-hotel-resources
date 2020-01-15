const downloadGamedata = require('./gamedata')
const downloadClothes = require('./clothes')

async function main () {
  await downloadGamedata();
  await downloadClothes()
}

main()