import { resolve } from "path";
import { readFileSync } from "fs";
import { CONFIG } from "../config";
import { Downloader } from "../util/downloader";
import { LibraryTask } from "../util/swf-to-lib/library.extractor";
import { Item } from "../util/swf-to-lib/jpexs";
import { Task } from "../util/tasklist/task.interface";
import { Tasklist } from "../util/tasklist/Tasklist";

export const FurniTask = ({ concurently = 5 } = {}): Task => ({
  title: "Furnitures",
  task: (ctx, task) => {
    const filename = resolve(process.cwd(), CONFIG.outputDir, "furnidata.json");
    const data = readFileSync(filename, { encoding: "utf8" });
    const furnidata = JSON.parse(data);
    const items = [...new Set(
      Object.values(furnidata).reduce<{ name: string; revision: string }[]>(
        (acc, item) => {
          return acc.concat(
            ...Object.values(item).map((i) => ({
              name: i.classname.split("*")[0],
              revision: i.revision,
            }))
          );
        },
        []
      )
    )];

    return new Tasklist([
      Downloader.createDownloadTask(
        (ctx) => {
          return items.reduce((acc, item: any) => {
            const filename = `${item.name}.swf`;
            const outFilename = resolve(
              process.cwd(),
              CONFIG.tmpDir,
              "furnitures",
              filename
            );

            acc[outFilename] =
              ctx.external_variables.get("flash.dynamic.download.url") +
              ctx.external_variables.get(
                "flash.dynamic.download.name.template",
                {
                  revision: item.revision,
                  typeid: item.name,
                }
              );
            return acc;
          }, {});
        },
        "Download furnitures",
        concurently
      ),
      {
        title: "Build Furnitures",
        task: () => {
          const cwd = process.cwd();

          return new Tasklist(
            items.map((item, index, arr) => {
              return {
                title: `(${index + 1}/${arr.length}) Build ${item.name}`,
                task: (ctx) => {
                  return new LibraryTask({
                    name: item.name,
                    output: resolve(
                      cwd,
                      CONFIG.outputDir,
                      "furnitures",
                      item.name
                    ),
                    items: [Item.BINARY, Item.IMAGE],
                    tmpDir: resolve(
                      cwd,
                      CONFIG.tmpDir,
                      "furnitures",
                      item.name
                    ),
                    swfUrl: resolve(cwd, CONFIG.tmpDir, `${item.name}.swf`),
                    fileAnimationFilter: (file) =>
                      file.endsWith("_animation.bin"),
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
