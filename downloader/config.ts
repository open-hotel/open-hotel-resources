export const CONFIG = {
  protocol: "https",
  domain: "habbo.com.br",
  output_dir: "./out",
  tmp_dir: "./tmp",
  get gamedataUrl() {
    return `${this.protocol}://${this.domain}/gamedata`;
  },
  concurrently_downloads: 50,
  concurrently_builds: 10,
  exit_on_error: true,
  ignore_not_found_downloads: true,
  texture_packer: {
    executable: "/usr/bin/TexturePacker",
    args: [
      "--format",
      "pixijs4",
      "--texture-format",
      "png8",
      "--max-width",
      "3000",
      "--max-height",
      "3000",
    ],
  },
};
