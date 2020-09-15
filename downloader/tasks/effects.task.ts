import { resolve } from "path";
import { readFileSync } from "fs";
import { CONFIG } from "../config";
import { Downloader } from "../util/downloader";
import { LibraryTask } from "../util/swf-to-lib/library.extractor";
import { Task } from "../util/tasklist/task.interface";
import { Tasklist } from "../util/tasklist/Tasklist";
import { ItemType } from "../util/extractor/types";

export const EffectsTask = (): Task => ({
  title: "Effects",
  task: (ctx, task) => {
    const filename = resolve(
      process.cwd(),
      CONFIG.output_dir,
      "effectmap.json"
    );
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
            const outFilename = resolve(
              process.cwd(),
              CONFIG.tmp_dir,
              CONFIG.output.effects,
              name,
              filename
            );

            acc[outFilename] =
              ctx.external_variables.get("flash.dynamic.avatar.download.url") +
              filename;
            return acc;
          }, {});
        },
        "Download Effects",
        CONFIG.concurrently_downloads
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
                    output: resolve(cwd, CONFIG.output_dir, CONFIG.output.effects, name),
                    items: [ItemType.BINARY, ItemType.IMAGE],
                    tmpDir: resolve(cwd, CONFIG.tmp_dir, CONFIG.output.effects, name),
                    swfFile: resolve(
                      cwd,
                      CONFIG.tmp_dir,
                      CONFIG.output.effects,
                      name,
                      `${name}.swf`
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
