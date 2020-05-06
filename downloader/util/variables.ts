import { promisify } from "util";
import { readFile as read } from "fs";

const readFile = promisify(read);

export class Variables {
  constructor(private readonly data: Record<string, string>) {}

  get(key: string, tpl_vars: Record<string, any> = {}): string {
    if (key in this.data) {
      const result = this.data[key].replace(
        /\$\{([^}]+)\}/g,
        (str: string, k: string) =>
          k in this.data && k !== key ? this.data[k] : str
      );

      return this.template(result, tpl_vars)
    }
  }

  static parse(data: string): Variables {
    const vars = data.split("\n").reduce((acc, line, i) => {
      const [key, value] = line.split("=");
      acc[key] = value;
      return acc;
    }, {});

    return new Variables(vars);
  }

  private template(tpl: string, vars: Record<string, any> = {}) {
    return tpl.replace(/%(\w+)%/gm, (str, key) =>
      key in vars ? vars[key] : str
    );
  }

  static async loadFile(filename: string): Promise<Variables> {
    return readFile(filename, { encoding: "utf8" }).then((data) =>
      this.parse(data)
    );
  }
}
