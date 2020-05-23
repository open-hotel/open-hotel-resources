import path from 'path'

export const CONFIG = {
  protocol: "https",
  domain: "habbo.com.br",
  ignore: path.join(process.cwd(), '.ignore'),
  output_dir: "./out",
  output: {
    gamedata: '.',
    habbo: '.',
    clothes: '.',
    effects: '.',
    furnitures: 'hof_furni'
  },
  tmp_dir: "./tmp",
  get gamedataUrl() {
    return `${this.protocol}://${this.domain}/gamedata`;
  },
  concurrently_downloads: 10,
  concurrently_builds: 1,
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
