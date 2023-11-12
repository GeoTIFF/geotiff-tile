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
