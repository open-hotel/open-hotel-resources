import { resolve } from "path";
import { readFileSync } from "fs";
import { CONFIG } from "../config";
import { Downloader } from "../util/downloader";
import { LibraryTask } from "../util/swf-to-lib/library.extractor";
import { Item } from "../util/swf-to-lib/jpexs";
import { Task } from "../util/tasklist/task.interface";
import { Tasklist } from "../util/tasklist/Tasklist";

export const ClothesTask = ({
  concurently = 5
} = {}): Task => ({
  title: "Clothes",
  task: (ctx, task) => {
    const filename = resolve(process.cwd(), CONFIG.outputDir, "figuremap.json");
    const data = readFileSync(filename, { encoding: "utf8" });
    const figuremap = JSON.parse(data);

    return new Tasklist([
      Downloader.createDownloadTask((ctx) => {
        return figuremap.libs.reduce((acc: Object, lib: any) => {
          const filename = `${lib.id}.swf`;
          const outFilename = resolve(process.cwd(), CONFIG.tmpDir, 'clothes', filename);

          acc[outFilename] =
            ctx.external_variables.get("flash.dynamic.avatar.download.url") +
            filename;
          return acc;
        }, {});
      }, "Download clothes", concurently),
      {
        title: "Build Clothes",
        task: () => {
          const cwd = process.cwd();

          return new Tasklist(
            figuremap.libs.map((lib, index, arr) => {
              const name = lib.id
              return {
                title: `(${index + 1}/${arr.length}) Build ${name}`,
                task: (ctx) => {
                  return new LibraryTask({
                    name: name,
                    output: resolve(cwd, CONFIG.outputDir, "clothes", name),
                    items: [Item.BINARY, Item.IMAGE],
                    tmpDir: resolve(cwd, CONFIG.tmpDir, "clothes", name),
                    swfUrl: resolve(cwd, CONFIG.tmpDir, `${name}.swf`),
                  }).createBuildTask(ctx);
                },
              };
            })
          );
        },
      },
    ]);
  },
});
