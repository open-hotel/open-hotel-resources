export class ProgressBar {
  public FILLED = "=";
  public EMPTY = "-";
  public width = process.stdout.columns;

  constructor(public readonly template: string = ":bar") {}

  render(loaded: number, total: number, tokens: Record<string, any> = {}) {
    const template = this.template.replace(/\:(\w+)/g, (str, token) => {
      return token in tokens ? tokens[token] : str;
    });

    const barWidth = this.width - template.length
    const bar = new Array(barWidth).fill(this.EMPTY)
    const barFilled = Math.floor(barWidth * (loaded / total))

    bar.splice(0, barFilled, ...new Array(barFilled).fill(this.FILLED))

    process.stdout.clearLine(1)
    process.stdout.write(template.replace(':bar', bar.join('')))
  }
}
