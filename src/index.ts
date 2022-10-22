import type { GeoTIFF } from "geotiff";
import geowarp from "geowarp";
import readBoundingBox from "geotiff-read-bbox";
import get_geotiff_epsg_code from "geotiff-epsg-code";
// import { rawToRgb } from "pixel-utils";
import proj4fullyloaded from "proj4-fully-loaded";
import reproject_bbox from "reproject-bbox";
// import snap_bbox from "snap-bbox";

export default async function createTile({
  // bands,
  bbox,
  bbox_srs = 4326,
  cutline,
  cutline_srs = 4326,
  debug_level = 0,
  geotiff,
  expr: _expr,
  // fit = false,
  layout: tile_layout = "[band][row,column]",
  method,
  round,
  height: tile_height = 256,
  srs: tile_srs = 3857, // epsg code of the output tile
  width: tile_width = 256,
  use_overview
}: {
  bands?: number[],
  bbox: [number, number, number, number] | Readonly<[number, number, number, number]> | Readonly<[string, string, string, string]>,
  bbox_srs: number | string,
  cutline?: any,
  cutline_srs?: number,
  debug_level?: number,
  geotiff: GeoTIFF,
  expr?: ({ pixel }: { pixel: number[] }) => number[],
  // fit?: boolean | undefined;
  layout?: string;
  method: string | (({ values }: { values: number[] }) => number),
  round?: boolean,
  height: number,
  srs?: number;
  use_overview?: boolean,
  width: number,
}) {
  const start_time = debug_level >= 1 ? performance.now() : 0;

  if (!bbox) throw new Error("[geotiff-tile] you must provide bbox");

  const bbox_nums = [Number(bbox[0]), Number(bbox[1]), Number(bbox[2]), Number(bbox[3])] as const;

  // parse data from GeoTIFF
  const geotiff_srs = await get_geotiff_epsg_code(geotiff);
  if (debug_level >= 1) console.log("geotiff_srs:", geotiff_srs);

  if (!geotiff_srs) {
    throw new Error(
      "[geotiff-tile] unfortunately we weren't able to parse an EPSG code from the GeoTIFF metadata. " +
      "Unfortunately, this library does not currently support reading tiles from GeoTIFF files with custom projections. " +
      "We hope to add this support in the future, per time and funding."
    );
  }

  // const image = await geotiff.getImage();

  const bbox_in_tile_srs = (() => {
    if (tile_srs === bbox_srs) {
      return bbox;
    } else {
      return reproject_bbox({ bbox: bbox_nums, from: bbox_srs, to: tile_srs })
    }
  })();
  if (debug_level >= 1) console.log("bbox_in_tile_srs:", bbox_in_tile_srs);

  // // snap the bounding box, so we get extra padding
  // const snapped = snap_bbox({
  //   bbox: bbox_in_tile_srs,
  //   origin: image.getOrigin(),
  //   scale: image.getResolution(),
  //   padding: [10, 10],
  //   container: image.getBoundingBox()
  // });
  // console.log("snapped:", snapped);
  // const read_bbox = snapped.bbox_in_coordinate_system;

  // read data from geotiff
  const readResult = await readBoundingBox({
    // bbox: read_bbox,
    bbox: bbox_in_tile_srs,
    debugLevel: debug_level,
    srs: tile_srs,
    geotiff,
    use_overview,
    target_height: tile_height,
    target_width: tile_width
  });
  console.log({readResult});

  const [theoretical_min, theoretical_max] = (() => {
    switch (readResult.data[0].name) {
      case "Uint8Array":
        return [0, 255];
      case "Int8Array":
        return [-128, 127];
      case "Uint16Array":
        return [0, 65535];
      case "Int16Array":
        return [-32768, 32767];
      case "Uint32Array":
        return [0, 4294967295];
      case "Int32Array":
        return [-2147483648, 2147483647];
      case "Float32Array":
        return [-3.4e38, 3.4e38];
      case "Float64Array":
        return [-1 * Number.MAX_VALUE, Number.MAX_VALUE];
      case "BigInt64Array":
        return [Math.pow(-2, 63), Math.pow(2, 63) - 1];
      case "BigUint64Array":
        return [0, Math.pow(2, 64) - 1];
      default:
        return [undefined, undefined];
    }
  })();

  if (cutline && !cutline_srs) {
    // default cutline srs is 4326
    cutline_srs = 4326;
  }

  const { forward, inverse } = proj4fullyloaded("EPSG:" + geotiff_srs, "EPSG:" + tile_srs);


  // if (fit && !_expr) {
  //   _expr = rawToRgb({
  //       format: "array",
  //       // flip: this.currentStats.mins.length === 1 ? true : false,
  //     //   ranges: zip(this.currentStats.mins, this.currentStats.maxs),
  //       round
  //   // });
  // }



  // warp result
  const { data: out_data } = geowarp({
    cutline,
    cutline_srs,
    cutline_forward: cutline ? proj4fullyloaded("EPSG:" + cutline_srs, "EPSG:" + tile_srs) : undefined,
    debug_level: debug_level > 1 ? debug_level - 1 : 0,
    forward,
    inverse,
    in_data: readResult.data,
    in_bbox: readResult.read_bbox,
    in_layout: "[band][row,column]",
    in_srs: geotiff_srs,
    in_width: readResult.width,
    in_height: readResult.height,
    method,
    // out_bands: should use if repeated bands in output
    out_bbox: bbox_in_tile_srs.map(it => Number(it)),
    out_height: tile_height,
    out_layout: tile_layout,
    out_srs: tile_srs,
    out_width: tile_width,
    round,
    theoretical_max,
    theoretical_min,
    expr: _expr
  });

  if (debug_level >= 1) console.log("[geotiff-tile] took " + (performance.now() - start_time) + "ms")
 
  return {
    height: tile_height,
    tile: out_data,
    width: tile_width
  };
}

if (typeof window === "object") {
  (window as any).geotiff_tile = { createTile };
}

if (typeof self === "object") {
  (self as any).geotiff_tile = { createTile };
}