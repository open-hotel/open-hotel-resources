import { resolve } from "path";
import { readFileSync } from "fs";
import { CONFIG } from "../config";
import { Downloader } from "../util/downloader";
import { LibraryTask } from "../util/swf-to-lib/library.extractor";
import { Task } from "../util/tasklist/task.interface";
import { Tasklist } from "../util/tasklist/Tasklist";
import { ItemType } from "../util/extractor/types";
import { ignore } from "../util/ignore";

const filter = ignore.createFilter()

export const ClothesTask = (): Task => ({
  title: "Clothes",
  task: (ctx, task) => {
    const filename = resolve(
      process.cwd(),
      CONFIG.output_dir,
      "figuremap.json"
    );
    const data = readFileSync(filename, { encoding: "utf8" });
    const figuremap = JSON.parse(data);

    return new Tasklist([
      Downloader.createDownloadTask(
        (ctx) => {
          return figuremap.libs.reduce((acc: Object, lib: any) => {
            if (!filter(lib.id)) return acc;
            const filename = `${lib.id}.swf`;
            const outFilename = resolve(
              process.cwd(),
              CONFIG.tmp_dir,
              CONFIG.output.clothes,
              lib.id,
              filename
            );

            acc[outFilename] =
              ctx.external_variables.get("flash.dynamic.avatar.download.url") +
              filename;
            return acc;
          }, {});
        },
        "Download clothes",
        CONFIG.concurrently_downloads
      ),
      {
        title: "Build Clothes",
        task: () => {
          const cwd = process.cwd();

          return new Tasklist(
            figuremap.libs.map(l => l.id).filter(filter).map((lib, index, arr) => {
              return {
                title: `(${index + 1}/${arr.length}) Build ${lib}`,
                task: (ctx) => {
                  return new LibraryTask({
                    name: lib,
                    output: resolve(cwd, CONFIG.output_dir, CONFIG.output.clothes, lib),
                    items: [ItemType.BINARY, ItemType.IMAGE],
                    tmpDir: resolve(cwd, CONFIG.tmp_dir, CONFIG.output.clothes, lib),
                    swfFile: resolve(
                      cwd,
                      CONFIG.tmp_dir,
                      CONFIG.output.clothes,
                      lib,
                      `${lib}.swf`
                    ),
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
