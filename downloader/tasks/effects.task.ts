import { resolve } from "path";
import { readFileSync } from "fs";
import { CONFIG } from "../config";
import { Downloader } from "../util/downloader";
import { LibraryTask } from "../util/swf-to-lib/library.extractor";
import { Item } from "../util/swf-to-lib/jpexs";
import { Task } from "../util/tasklist/task.interface";
import { Tasklist } from "../util/tasklist/Tasklist";

export const EffectsTask = ({ concurently = 5 } = {}): Task => ({
  title: "Effects",
  task: (ctx, task) => {
    const filename = resolve(process.cwd(), CONFIG.outputDir, "effectmap.json");
    const data = readFileSync(filename, { encoding: "utf8" });
    const effectmap = JSON.parse(data);
    const items = [
      ...new Set<string>(
        Object.values(Object.assign({}, ...Object.values(effectmap)))
      ),
    ];

    return new Tasklist([
      Downloader.createDownloadTask(
        (ctx) => {
          return items.reduce((acc, name: any) => {
            const filename = `${name}.swf`;
            const outFilename = resolve(process.cwd(), CONFIG.tmpDir, 'effects', filename);

            acc[outFilename] =
              ctx.external_variables.get("flash.dynamic.avatar.download.url") +
              filename;
            return acc;
          }, {});
        },
        "Download Effects",
        concurently
      ),
      {
        title: "Build Effects",
        task: () => {
          const cwd = process.cwd();

          return new Tasklist(
            items.map((name, index, arr) => {
              
              return {
                title: `(${index + 1}/${arr.length}) Build ${name}`,
                task: (ctx) => {
                  return new LibraryTask({
                    name: name,
                    output: resolve(cwd, CONFIG.outputDir, "effects", name),
                    items: [Item.BINARY, Item.IMAGE],
                    tmpDir: resolve(cwd, CONFIG.tmpDir, "effects", name),
                    swfUrl: resolve(cwd, CONFIG.tmpDir, `${name}.swf`),
                    fileAnimationFilter: file => file.endsWith('_animation.bin')
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
