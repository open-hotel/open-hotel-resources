import { resolve } from "path";
import { readFileSync } from "fs";
import { CONFIG } from "../config";
import { Downloader } from "../util/downloader";
import { LibraryTask } from "../util/swf-to-lib/library.extractor";
import { Task } from "../util/tasklist/task.interface";
import { Tasklist } from "../util/tasklist/Tasklist";
import { ItemType } from "../util/extractor/types";

export const FurniTask = (): Task => ({
  title: "Furnitures",
  task: (ctx, task) => {
    const cwd = process.cwd();
    const filename = resolve(cwd, CONFIG.output_dir, "furnidata.json");
    const data = readFileSync(filename, { encoding: "utf8" });
    const furnidata = JSON.parse(data);
    const items = Object.values(furnidata).reduce<
      { name: string; revision: string }[]
    >((acc, item) => {
      Object.values(item).forEach((i) => {
        const name = i.classname.split("*")[0];
        if (acc.every((a) => a.name !== name)) {
          acc.push({
            name,
            revision: i.revision,
          });
        }
      });

      return acc;
    }, []);

    return new Tasklist([
      Downloader.createDownloadTask(
        (ctx) => {
          return items.reduce((acc, item: any) => {
            const filename = `${item.name}.swf`;
            const outFilename = resolve(
              cwd,
              CONFIG.tmp_dir,
              CONFIG.output.furnitures,
              item.name,
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
        CONFIG.concurrently_downloads
      ),
      {
        title: "Build Furnitures",
        task: () => {
          return new Tasklist(
            items.map((item, index, arr) => {
              return {
                title: `(${index + 1}/${arr.length}) Build ${item.name}`,
                task: (ctx) => {
                  return new LibraryTask({
                    name: item.name,
                    output: resolve(
                      cwd,
                      CONFIG.output_dir,
                      CONFIG.output.furnitures,
                      item.name
                    ),
                    items: [ItemType.BINARY, ItemType.IMAGE],
                    tmpDir: resolve(
                      cwd,
                      CONFIG.tmp_dir,
                      CONFIG.output.furnitures,
                      item.name
                    ),
                    swfFile: resolve(
                      cwd,
                      CONFIG.tmp_dir,
                      CONFIG.output.furnitures,
                      item.name,
                      `${item.name}.swf`
                    ),
                    fileAnimationFilter: (file) =>
                      file.endsWith("_animation.bin"),
                  }).createBuildTask(ctx);
                },
              };
            }),
            { concurrently: CONFIG.concurrently_builds }
          );
        },
      },
    ]);
  },
});
