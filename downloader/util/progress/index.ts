import { Transform } from "stream";
import { performance } from "perf_hooks";
import moment from "moment";

export class ListenErrorStream extends Transform {
  constructor() {
    super({ objectMode: true });

    this.on("pipe", (stream) => {
      stream.on("error", (e) => this.destroy(e));
    });
  }
}

export interface FetchStreamFrame<T = Buffer> {
  loaded: number;
  total: number;
  chunk: T;
}

export class ProgressStream extends ListenErrorStream {
  private startTime: number = 0;
  private loadedBytes = 0;
  private totalBytes = 0;

  get speed() {
    return this.loadedBytes / this.eta;
  }

  get eta() {
    return (performance.now() - this.startTime) / 1000;
  }

  get time() {
    return Math.max((this.totalBytes - this.loadedBytes) / this.speed, 0);
  }

  constructor(
    private readonly template = ":percent :bar :speed",
    public tokens: Record<string, any> = {},
    private width: number = 80
  ) {
    super();
    this.loadedBytes = tokens.loaded || 0;
    this.totalBytes = tokens.total || 0;

    if (!width) {
      this.width = process.stdout.columns;
      process.stdout.on("resize", () => {
        this.width = process.stdout.columns;
      });
    }
  }

  format(time: number) {
    const duration = moment.utc(
      moment.duration(time, "seconds").asMilliseconds()
    );
    if (duration.hours() > 0) return duration.format("H[h]mm[m]");
    else if (duration.minutes() > 0) return duration.format("mm[m]ss[s]");
    return duration.format("s[s]");
  }

  _transform(frame: FetchStreamFrame, encoding: string, cb: Function) {
    if (!this.startTime) this.startTime = performance.now();

    this.totalBytes = frame.total;
    this.loadedBytes = frame.loaded || 0;

    let ratio = 1;
    let percent = "-";
    let bar = "";

    if (isFinite(frame.total)) {
      ratio = Math.min(frame.loaded / frame.total, 1);
      percent = (ratio * 100).toPrecision(3) + "%";
    }
    const tokens = {
      ...frame,
      ...this.tokens,
      total: Math.round(this.totalBytes),
      loaded: Math.round(this.loadedBytes),
      percent,
      speed: Math.round(this.speed) + " bps",
      eta: this.format(this.eta),
      time: this.format(this.time),
    };
    let template = this.template.replace(/\:(\w+)/g, (str, token) =>
      token in tokens ? tokens[token] : str
    );
    const barWidth = this.width - template.length - 4;
    const loadedWidth = barWidth * ratio;

    if (barWidth > 0) {
      bar = "=".repeat(loadedWidth);
      if (ratio < 1) bar += "-".repeat(barWidth - loadedWidth);
    }

    template = template.replace(":bar", bar);
    cb(null, template);
  }
}
