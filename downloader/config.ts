export const CONFIG = {
  protocol: "https",
  domain: "habbo.com.br",
  output_dir: "./out",
  tmp_dir: "./tmp",
  get gamedataUrl() {
    return `${this.protocol}://${this.domain}/gamedata`;
  },
  concurrently_downloads: 100,
  concurrently_builds: 10,
  exit_on_error: false,
  ignore_not_found_downloads: true,
};
