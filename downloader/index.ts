import { Tasklist } from "./util/tasklist/Tasklist";
import { GameDataTask } from "./tasks/gamedata.task";
import { ClothesTask } from "./tasks/clothes.task";
import { EffectsTask } from "./tasks/effects.task";
import { FurniTask } from "./tasks/furni.task";
import { Downloader } from "./util/downloader";

new Tasklist([
  GameDataTask(),
  ClothesTask(),
  EffectsTask(),
  FurniTask()
]).run();
