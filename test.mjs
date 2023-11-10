import { writeFileSync } from "node:fs";
import test from "flug";
import { fromFile } from "geotiff";
import writeImage from "write-image";
import { default as createTile } from "./dist/esm/geotiff-tile.mjs";

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
    bbox: [0, 0, 512, image_height + 200],
    bbox_srs: "simple",
    debug_level: 10,
    method: "near",
    tile_height: 512,
    tile_layout: "[band][row][column]",
    tile_width: 512,
    timed: true
  });
  console.log({ height, width, tile, extra });

  const { readResult } = extra;

  writeResult(readResult, "simple-raw");

  // console.log("set of raw values:", new Set(rawdata.flat(1).map(arr => Array.from(arr)).flat(1)));

  writeResult({ data: tile }, "simple-tile");
});
