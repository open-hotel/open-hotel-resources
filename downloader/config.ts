export const CONFIG = {
  protocol: "https",
  domain: "habbo.com.br",
  output_dir: "./out",
  tmp_dir: "./tmp",
  get gamedataUrl() {
    return `${this.protocol}://${this.domain}/gamedata`;
  },
  concurrently_downloads: 10,
  concurrently_builds: 10,
  exit_on_error: true,
  ignore_not_found_downloads: true,
};
