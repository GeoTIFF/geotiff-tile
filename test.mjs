import { writeFileSync } from "node:fs";
import test from "flug";
import { fromFile, fromUrl } from "geotiff";
import writeImage from "write-image";
import { default as createTile } from "./dist/esm/geotiff-tile.mjs";
import srvd from "srvd";

const writeResult = (result, filepath) => {
  let { data } = result;
  if (data.length === 1) data = [data[0], data[0], data[0]];
  const { data: buf } = writeImage({ data, height: result.height, format: "PNG", width: result.width });
  writeFileSync(`./test-output/${filepath}.png`, buf);
};

test("simple", async ({ eq }) => {
  const url = "./data/wildfires.tiff";
  const geotiff = await fromFile(url);
  const image = await geotiff.getImage();
  const image_height = image.getHeight(); // 784
  const image_width = image.getWidth(); // 1052

  const { height, width, tile, extra } = await createTile({
    geotiff,
    geotiff_srs: "simple",
    bbox: [0, 0, 512, image_height + 200],
    bbox_srs: "simple",
    debug_level: 10,
    method: "near",
    tile_height: 512,
    tile_layout: "[band][row][column]",
    tile_srs: "simple",
    tile_width: 512,
    timed: true
  });
  console.log({ height, width, tile, extra });

  const { readResult } = extra;

  writeResult(readResult, "simple-raw");

  // console.log("set of raw values:", new Set(rawdata.flat(1).map(arr => Array.from(arr)).flat(1)));

  writeResult({ data: tile }, "simple-tile");
});

test("simple again", async ({ eq }) => {
  const port = 8081;
  const { server } = srvd.serve({ port });

  const geotiff = await fromUrl(`http://localhost:${port}/data/vestfold.tif`);

  const params = {
    bbox: [128, 656, 144, 672],
    bbox_srs: "simple",
    debug_level: 3,
    geotiff,
    geotiff_srs: "simple",
    method: "near-vectorize",
    round: false,
    tile_array_types: ["Array", "Array", "Array"],
    tile_height: 256,
    tile_srs: "simple",
    tile_layout: "[band][row][column]",
    timed: true,
    tile_width: 256,
    use_overview: true
  };

  const { height, width, tile, extra } = await createTile(params);

  server.close();

  const { readResult } = extra;

  writeResult(readResult, "simple-again-raw");

  // console.log("set of raw values:", new Set(rawdata.flat(1).map(arr => Array.from(arr)).flat(1)));

  writeResult({ data: tile }, "simple-again-tile");
});

test("antarctica with NaN", async ({ eq }) => {
  const port = 8081;
  const { server } = srvd.serve({ port });

  const geotiff = await fromUrl(`http://localhost:${port}/data/bremen_sea_ice_conc_2022_9_9.tif`);

  const image = await geotiff.getImage();

  // [ -3950000, -3943750, 3950000, 4350000 ]
  const bbox = image.getBoundingBox();

  const params = {
    bbox,
    bbox_srs: 3031,
    debug_level: 3,
    geotiff,
    method: "near-vectorize",
    round: true,
    tile_array_types: ["Array", "Array", "Array"],
    tile_height: 256,
    tile_srs: "EPSG:3031",
    tile_layout: "[band][row][column]",
    timed: true,
    tile_width: 256,
    use_overview: true
  };

  const { height, width, tile, extra } = await createTile(params);

  server.close();

  const { readResult } = extra;

  writeResult(readResult, "bremen_sea_ice_conc_2022_9_9");
});

test("gadas-max", async ({ eq }) => {
  const port = 8081;
  const { server } = srvd.serve({ port });

  const geotiff = await fromUrl(`http://localhost:${port}/data/gadas.tif`);

  const params = {
    url: "./data/gadas.tif",
    bbox: [7_698_736.858, 163_239.838, 10_066_450.246, 1_325_082.668],
    bbox_srs: 3857,
    debug_level: 0,
    geotiff,
    method: "max",
    round: false,
    tile_array_types: ["Uint8Array"],
    tile_height: 512,
    tile_layout: "[row,column,band]",
    tile_srs: 3857,
    tile_width: 512,
    timed: true,
    use_overview: true,
    turbo: true
  };

  const { height, width, tile, extra } = await createTile(params);

  server.close();

  writeResult({ data: tile, height, width }, "gadas-max");
});
