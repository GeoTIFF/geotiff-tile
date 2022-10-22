const envisage = require("envisage");
const path = require("path");

module.exports = (env, argv) => {
  const config = {
    entry: "./dist/esm/geotiff-tile.js",
    mode: "production",
    devtool: "source-map",
    output: {
      filename: `geotiff-tile.min.js`,
      library: "geotiff-tile",
      libraryTarget: "umd",
      path: path.resolve(__dirname, "dist/web"),
    },
  };

  // inject environmental variables
  envisage.assign({ prefix: "GEOTIFF_TILE_WEBPACK", target: config });

  return config;
};
