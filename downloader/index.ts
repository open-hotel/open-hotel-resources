// import { Tasklist } from "./util/tasklist/Tasklist";
// import { GameDataTask } from "./tasks/gamedata.task";
// import { ClothesTask } from "./tasks/clothes.task";
// import { EffectsTask } from "./tasks/effects.task";
// import { FurniTask } from "./tasks/furni.task";
// import { Downloader } from "./util/downloader";

// new Tasklist([
//   GameDataTask(),
//   ClothesTask(),
//   EffectsTask(),
//   FurniTask()
// ]).run();

import { extractSWF } from "./util/extractor";
import path from "path";

console.time("Extract Images");
extractSWF({
  inputFile: path.join(process.cwd(), "Habbo.swf"),
  outputDir: path.join(process.cwd(), "out"),
  fileName: (item, extName) => item.name + "_TESTANDO." + extName,
}).finally(() => {
  console.timeEnd("Extract Images");
});
