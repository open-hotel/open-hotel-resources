export const CONFIG = {
  protocol: "https",
  domain: "habbo.com.br",
  outputDir: "./out",
  tmpDir: "./tmp",
  get gamedataUrl() {
    return `${this.protocol}://${this.domain}/gamedata`;
  },
};
