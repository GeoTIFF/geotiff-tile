# geotiff-tile
> Generate a Map Tile from a GeoTIFF File.

## install
```bash
npm install geotiff-tile
```

## basic usage
```js
import { createTile } from "geotiff-tile";

await createTile({
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

  // how many points to add to each side of the bounding box if reprojecting
  // optional, default is 100
  density = 100,

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

  // resolution of the tile
  // from 0 (lowest) to 1 (highest)
  tile_resolution: 0.5,

  // whether to use overviews if available
  use_overview,

  // optional, default is false
  // enable experimental turbocharging via proj-turbo
  turbo: false
})
```

## advanced usage
### Over-riding geotiff srs
If for some reason geotiff-tile can't parse the correct projection from your geotiff, you can manually
specify the projection via the geotiff_srs parameter.
```js
await createTile({
  geotiff,
  geotiff_srs: 3031,
  // rest is the same
})
```

### Image Pixel Coordinates and Simple SRS
You can also select pixels using a "simple" spatial reference system where the bottom left of your data
is the origin [0, 0] and the top-right corner is [width, height].  This is inspired by [Leaflet's Simple CRS](https://leafletjs.com/examples/crs-simple/crs-simple.html).
```js
await createTile({
  bbox: [128, 656, 144, 672],
  bbox_srs: "simple",

  // rest is the same
})
```