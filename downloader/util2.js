const download = require("./lib/download");
const { readDir } = require("./lib/fs");
const { extractSWF, ITEM } = require("./lib/swf-extractor");

// download({
//   "AAAAA.xml": "http://images.habbo.com/gordon/PRODUCTION-201912102204-233022976/figuremap.xml",
//   "BBBBB.xml": "http://images.habbo.com/gordon/PRODUCTION-201912102204-233022976/figuredata.xml",
// }, 1).subscribe({
//   complete: () => console.log('Done!')
// });

extractSWF("swf/clothes/hh_human_body.swf", [ITEM.BINARY, ITEM.IMAGE]).subscribe(console.log);
