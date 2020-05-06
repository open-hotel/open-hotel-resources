import draft from "draftlog";
import { Task } from "./task.interface";
import { CONFIG } from "../../config";

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

  private update(data: string, task: Task) {
    return (
      "  ".repeat(this.depth) +
      `\x1b[1m> ${task.title}\x1b[0m \x1b[2m${data}\x1b[0m`
    );
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
    const update = console.draft(this.update("", item));
    let result: any = item.task(ctx, item, this.tasks);

    if (result instanceof Tasklist) {
      result.depth = this.depth + 1;
      result = result.run(result.ctx === undefined ? ctx : result.ctx);
    }

    if (result instanceof Promise) {
      return result
        .then((r) => update(this.done(item)))
        .catch((err) => update(this.error(err, item)));
    }

    return new Promise((resolve, reject) => {
      (result as NodeJS.ReadStream)
        .once("finish", () => {
          update(this.done(item));
          resolve();
        })
        .on("data", (c) => {
          update(this.update(c.toString(), item));
        })
        .once("error", (err) => {
          update(this.error(err, item));
          reject(err);
        });
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
