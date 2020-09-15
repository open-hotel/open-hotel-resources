import draft from "draftlog";
import { Task } from "./task.interface";
import { CONFIG } from "../../config";
import { clearInterval, setInterval } from "timers";
import { ReadStream } from "fs";
import { Readable } from "stream";

let asyncId = 0;

draft.into(console);

interface TasklistOptions {
  concurrently: number;
}

export class Tasklist {
  public stdout: NodeJS.WriteStream = process.stdout;
  public options: TasklistOptions;
  private tasksMirror: Array<Task> = [];
  private runningTasks = 0;
  private depth = 0;
  private LOADER_FRAMES = [
    "\x1b[1;33m⠋\x1b[0m",
    "\x1b[1;33m⠙\x1b[0m",
    "\x1b[1;33m⠹\x1b[0m",
    "\x1b[1;33m⠸\x1b[0m",
    "\x1b[1;33m⠼\x1b[0m",
    "\x1b[1;33m⠴\x1b[0m",
    "\x1b[1;33m⠦\x1b[0m",
    "\x1b[1;33m⠧\x1b[0m",
    "\x1b[1;33m⠇\x1b[0m",
    "\x1b[1;33m⠏\x1b[0m",
  ];
  private SPINNER_INTERVAL = 80;

  private update(spinner: string, data: string, task: Task) {
    return (
      "  ".repeat(this.depth) +
      `${spinner} \x1b[1m${task.title}\x1b[0m \x1b[2m${data}\x1b[0m`
    );
  }

  private createSprinner(task: Task, time = this.SPINNER_INTERVAL) {
    let i = 0;
    let lastData = "";
    const interval = setInterval(() => {
      i++;
      if (i >= this.LOADER_FRAMES.length) i = 0;
      update(this.update(`${this.LOADER_FRAMES[i]}`, lastData, task));
    }, time);

    const id = asyncId++;

    // @ts-ignore
    const update = console.draft(this.update(this.LOADER_FRAMES[i], "", task));

    const stop = () => clearInterval(interval);
    return {
      stop,
      update: (data: string) => {
        lastData = data;
        update(this.update(this.LOADER_FRAMES[i], data, task));
      },
      success: (data?: string) => {
        stop();
        update(this.done(task));
      },
      error: (error?: Error) => {
        stop();
        update(this.error(error, task));
      },
    };
  }

  private error(error: Error, task: Task) {
    const padding = "  ".repeat(this.depth);
    const message = error.message.replace("\n", "\n" + padding + "  ");

    if (CONFIG.exit_on_error) {
      console.error("-=".repeat(process.stdout.columns / 2));
      console.error(`Error in task "${task.title}"`);
      console.error(error);
      process.exit();
    }

    return (
      padding +
      `\x1b[1;31m✖ ${task.title}:\x1b[0m\n  ${padding}\x1b[2K\x1b[31m${message}\x1b[0m`
    );
  }

  private done(task: Task) {
    return "  ".repeat(this.depth) + `\x1b[1;32m✔ ${task.title}\x1b[0m\x1b[1A`;
  }

  constructor(
    public tasks: Array<Task> = [],
    options: Partial<TasklistOptions> = {},
    public ctx?: any
  ) {
    this.tasksMirror = tasks.slice();
    this.options = Object.assign({ concurrently: 1 }, options);
  }

  private async runTask(item: Task, ctx: any) {
    // @ts-ignore
    const spinner = this.createSprinner(item);
    let result: any = item.task(ctx, item, this.tasks);

    if (result instanceof Tasklist) {
      result.depth = this.depth + 1;
      result = result.run(result.ctx === undefined ? ctx : result.ctx);
    }

    if (result instanceof Promise) {
      return result
        .then((r) => spinner.success())
        .catch((err) => spinner.error(err));
    }

    return new Promise((resolve, reject) => {
      if (result instanceof Readable) {
        result
          .once("finish", () => {
            spinner.success();
            resolve();
          })
          .on("data", (c) => spinner.update(c.toString()))
          .once("error", (err) => {
            spinner.error(err);
            reject(err);
          });
      } else {
        spinner.success();
        resolve();
      }
    });
  }

  private async requestNext(ctx: any) {
    if (this.runningTasks >= this.options.concurrently) return;

    const count = Math.max(this.options.concurrently - this.runningTasks, 0);
    const tasks = this.tasksMirror.splice(0, count).map(
      (item) =>
        new Promise((resolve) => {
          this.runTask(item, ctx)
            .catch((e) => null)
            .finally(() => {
              this.runningTasks--;
              resolve(this.requestNext(ctx));
            });
        })
    );
    this.runningTasks += tasks.length;

    return Promise.all(tasks);
  }

  run(ctx = {}) {
    return this.requestNext(ctx);
  }
}
