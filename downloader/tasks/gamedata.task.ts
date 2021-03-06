import { dirname, resolve } from "path";
import { readFileSync, writeFileSync, mkdirSync, existsSync, fstat } from "fs";
import Cheerio from "cheerio";
import { Downloader } from "../util/downloader";
import { CONFIG } from "../config";
import { Variables } from "../util/variables";
import { Task } from "../util/tasklist/task.interface";
import { Tasklist } from "../util/tasklist/Tasklist";
import { tryParse } from "../util";

export const GameDataTask = (): Task => {
  const dir = process.cwd();
  const externalVariablesPath = resolve(
    dir,
    CONFIG.tmp_dir,
    CONFIG.output.gamedata,
    "external_variables.txt"
  );
  const figuremapPath = resolve(dir, CONFIG.tmp_dir, CONFIG.output.gamedata, "figuremap.xml");
  const figuredataPath = resolve(dir, CONFIG.tmp_dir, CONFIG.output.gamedata, "figuredata.xml");
  const effectmapPath = resolve(dir, CONFIG.tmp_dir, CONFIG.output.gamedata, "effectmap.xml");
  const figuremapJSONPath = resolve(dir, CONFIG.output_dir, CONFIG.output.gamedata, "figuremap.json");
  const avatarActionsPath = resolve(
    dir,
    CONFIG.tmp_dir,
    CONFIG.output.gamedata,
    "HabboAvatarActions.xml"
  );
  const avatarActionsJSONPath = resolve(
    dir,
    CONFIG.output_dir,
    CONFIG.output.gamedata,
    "HabboAvatarActions.json"
  );
  const furnidataPath = resolve(dir, CONFIG.tmp_dir, CONFIG.output.gamedata, "furnidata.xml");
  const figuredataJSONPath = resolve(dir, CONFIG.output_dir, CONFIG.output.gamedata, "figuredata.json");
  const effectmapJSONPath = resolve(dir, CONFIG.output_dir, CONFIG.output.gamedata, "effectmap.json");
  const furnidataJSONPath = resolve(dir, CONFIG.output_dir, CONFIG.output.gamedata, "furnidata.json");

  return {
    title: "Gamedata",
    task: (ctx) =>
      new Tasklist([
        Downloader.createDownloadTask(() => ({
          [externalVariablesPath]: `${CONFIG.gamedataUrl}/external_variables`,
        })),
        {
          title: "Load external_variables.txt",
          task: async (ctx) => {
            ctx.external_variables = await Variables.loadFile(
              externalVariablesPath
            );
          },
        },
        Downloader.createDownloadTask(
          (ctx) => {
            return {
              [figuremapPath]: ctx.external_variables.get(
                "flash.dynamic.avatar.download.configuration"
              ),
              [figuredataPath]: ctx.external_variables.get(
                "external.figurepartlist.txt"
              ),
              [furnidataPath]: ctx.external_variables.get("furnidata.load.url"),
              [effectmapPath]: `${ctx.external_variables.get(
                "flash.client.url"
              )}effectmap.xml`,
              [avatarActionsPath]: `${ctx.external_variables.get(
                "flash.client.url"
              )}HabboAvatarActions.xml`,
            };
          },
          "Download files",
          CONFIG.concurrently_downloads
        ),
        {
          title: "Convert figuremap.xml to figuremap.json",
          task: async (ctx) => {
            const data = readFileSync(figuremapPath, { encoding: "utf8" });
            const figuremapXML = Cheerio.load(data, { xmlMode: true });
            const libs = figuremapXML("lib").toArray();
            const figuremapJSON = libs.reduce(
              (acc, el, index) => {
                const lib = Cheerio(el);
                const parts = lib.children("part").toArray();

                acc.libs[index] = lib.attr();
                acc.parts = {
                  ...acc.parts,
                  ...parts.reduce((acc, el) => {
                    const part = Cheerio(el);
                    const { type, id } = part.attr();

                    acc[type] = acc[type] || {};
                    acc[type][id] = index;

                    return acc;
                  }, acc.parts),
                };

                return acc;
              },
              {
                libs: [],
                parts: {},
              }
            );

            mkdirSync(dirname(figuremapJSONPath), { recursive: true });
            writeFileSync(figuremapJSONPath, JSON.stringify(figuremapJSON));
          },
        },
        {
          title: "Convert figuredata.xml to figuredata.json",
          task: async (ctx) => {
            const data = readFileSync(figuredataPath, { encoding: "utf8" });
            const figuredataXML = Cheerio.load(data, { xmlMode: true });

            const palettes = figuredataXML("colors > palette").toArray();
            const settypes = figuredataXML("sets > settype").toArray();

            const figuredataJSON = {
              palette: palettes.reduce((acc, el) => {
                const palette = Cheerio(el);
                const colors = palette.children("color").toArray();
                const id = palette.attr("id");

                acc[id] = colors.reduce((acc, el) => {
                  const color = Cheerio(el);
                  const id = color.attr("id");

                  color.removeAttr("id");
                  color.attr("color", color.text());

                  acc[id] = tryParse(color.attr());

                  return acc;
                }, {});

                return acc;
              }, {}),
              settype: settypes.reduce((acc, el) => {
                const settype = Cheerio(el);
                const type = settype.attr("type");
                const sets = settype.children("set").toArray();

                settype.removeAttr("type");

                acc[type] = settype.attr();
                acc[type].set = sets.reduce((acc, el) => {
                  const set = Cheerio(el);
                  const id = set.attr("id");
                  const parts = set.children("part").toArray();
                  const hiddenLayers = set
                    .find("hiddenlayers layer")
                    .toArray()
                    .map((el) => Cheerio(el).attr("parttype"));

                  set.removeAttr("id");

                  acc[id] = set.attr();
                  acc[id].parts = parts.map((el) => tryParse(Cheerio(el).attr()));

                  if (hiddenLayers.length) {
                    acc[id].hiddenLayers = hiddenLayers;
                  }

                  return acc;
                }, {});
                return acc;
              }, {}),
            };

            writeFileSync(figuredataJSONPath, JSON.stringify(figuredataJSON));
          },
        },
        {
          title: "Convert effectmap.xml to JSON",
          task: async () => {
            const data = readFileSync(effectmapPath, { encoding: "utf8" });
            const effectmapXML = Cheerio.load(data, { xmlMode: true });
            const effetcs = effectmapXML("effect").toArray();

            const effectmap = effetcs.reduce((acc, el) => {
              const effect = Cheerio(el);
              const type = effect.attr("type");
              const lib = effect.attr("lib");
              const id = effect.attr("id");

              if (!(type in acc)) acc[type] = {};

              acc[type][id] = lib;

              return acc;
            }, {});

            return writeFileSync(effectmapJSONPath, JSON.stringify(effectmap));
          },
        },
        {
          title: "Convert furnidata.xml to JSON",
          task: async (ctx) => {
            if (existsSync(furnidataJSONPath)) {
              return;
            }
            const data = readFileSync(furnidataPath, { encoding: "utf8" });
            const furnidataXML = Cheerio.load(data, { xmlMode: true });
            const roomitemtypes = furnidataXML(
              "furnidata > roomitemtypes > furnitype"
            ).toArray();
            const wallitemtypes = furnidataXML(
              "furnidata > wallitemtypes > furnitype"
            ).toArray();

            const furniItemReducer = (acc, el) => {
              const furnitype = Cheerio(el);
              const id = furnitype.attr("id");

              furnitype.removeAttr("id");

              acc[id] = {
                ...furnitype.attr(),
                revision: furnitype.children("revision").text(),
                defaultdir: Number(furnitype.children("defaultdir").text()),
                xdim: Number(furnitype.children("xdim").text()),
                ydim: Number(furnitype.children("ydim").text()),
                partcolors: furnitype
                  .find("partcolors > color")
                  .toArray()
                  .map((el) => Cheerio(el).text()),
                name: furnitype.children("name").text(),
                description: furnitype.children("description").text(),
                adurl: furnitype.children("adurl").text(),
                offerid: Number(furnitype.children("offerid").text()),
                buyout: Number(furnitype.children("buyout").text()),
                rentofferid: Number(furnitype.children("rentofferid").text()),
                rentbuyout: Number(furnitype.children("rentbuyout").text()),
                bc: Number(furnitype.children("bc").text()),
                excludeddynamic: Number(
                  furnitype.children("excludeddynamic").text()
                ),
                customparams: Number(furnitype.children("customparams").text()),
                specialtype: Number(furnitype.children("specialtype").text()),
                canstandon: Number(furnitype.children("canstandon").text()),
                cansiton: Number(furnitype.children("cansiton").text()),
                furniline: Number(furnitype.children("furniline").text()),
              };

              return acc;
            };

            const furnidata = {
              roomitemtypes: roomitemtypes.reduce(furniItemReducer, {}),
              wallitemtypes: wallitemtypes.reduce(furniItemReducer, {}),
            };

            return writeFileSync(furnidataJSONPath, JSON.stringify(furnidata));
          },
        },
        {
          title: "Convert HabboAvatarActions.xml to JSON",
          task: async (ctx) => {
            if (existsSync(avatarActionsJSONPath)) {
              return;
            }

            const data = readFileSync(avatarActionsPath, { encoding: "utf8" });
            const actionsXML = Cheerio.load(data, { xmlMode: true });

            const actions = actionsXML("action").toArray();

            const actionsJSON = actions.reduce((acc, el) => {
              const action = Cheerio(el);
              const id = action.attr("id");
              action.removeAttr("id");

              const types = action.find("type").toArray();
              const params = action.find("param").toArray();

              acc[id] = {
                ...action.attr(),
                types:
                  types.length === 0
                    ? undefined
                    : types.reduce((acc, el) => {
                        const type = Cheerio(el);
                        const id = type.attr("id");
                        type.removeAttr("id");

                        acc[id] = type.attr();

                        return acc;
                      }, {}),
                params:
                  params.length === 0
                    ? undefined
                    : params.reduce((acc, el) => {
                        const param = Cheerio(el);
                        acc[param.attr("id")] = param.attr("value");
                        return acc;
                      }, {}),
              };
              return acc;
            }, {});

            return writeFileSync(
              avatarActionsJSONPath,
              JSON.stringify(actionsJSON)
            );
          },
        },
      ]),
  };
};
