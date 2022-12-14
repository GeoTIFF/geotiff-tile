# geotiff-tile
Generate a Map Tile from a GeoTIFF File.

## install
```bash
npm install geotiff-tile
```

## usage
```js
import { createTile } from "geotiff-tile";

createTile({
  // bounding box of tile in format [xmin, ymin, xmax, ymax]
  bbox: [-122.49755859375, 38.8520508, -120.06958007812499, 40.697299008636755],

  // spatial reference system of the bounding box
  // as a EPSG Code number
  bbox_srs = 4326,

  // geometry to clip by in GeoJSON format
  cutline: geojson,

  // spatial reference system of cutline
  cutline_srs,

  // set to higher number to increase logging
  debug_level = 0,

  // instance of geotiff.js
  geotiff,

  // function that accepts a pixel array of values of type
  // ({ pixel }: { pixel: number[] }) => number[]
  expr,

  // layout using xdim layout syntax
  // https://github.com/danieljdufour/xdim
  layout = "[band][row,column]",

  // resampling method
  method,

  // round pixel values to integers
  round,

  // optional
  // override default nested tile array types
  tile_array_types: ["Array", "Uint8ClampedArray"],

  // optional
  // if tile_array_types is not specified, choose
  // the strategy for deciding which type of arrays
  // auto - safest and default option, only uses typed array if it's sure there won't be any clamping
  // geotiff - use the same array types that geotiff.js uses (good if not stretching min or max)
  // untyped - use only untyped arrays
  // undefined - same as auto
  tile_array_types_strategy: "untyped",

  // projection of the tile
  // as an EPSG code
  tile_srs: 3857,

  // tile height in pixel
  tile_height: 512,

  // width of tile in pixels
  tile_width: 512,

  // whether to use overviews if available
  use_overview
})
```