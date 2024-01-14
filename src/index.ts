import geowarp from "geowarp";
import readBoundingBox from "geotiff-read-bbox";
import get_geotiff_epsg_code from "geotiff-epsg-code";
import get_geotiff_no_data_number from "geotiff-no-data";
import GT from "geotiff-geotransform";
import Geotransform from "geoaffine/Geotransform.js";
// import { rawToRgb } from "pixel-utils";
import proj4fullyloaded from "proj4-fully-loaded";
import bboxfns_reproject from "bbox-fns/reproject.js";
import reproject_bbox from "reproject-bbox";
// import snap_bbox from "snap-bbox";

export default async function createTile({
  // bands,
  bbox,
  bbox_srs = 4326,
  cutline,
  cutline_srs = 4326,
  debug_level = 0,
  density = 100,
  geotiff,
  geotiff_srs,
  expr: _expr,
  // fit = false,
  method,
  pixel_depth,
  round,
  tile_array_types,
  tile_height = 256,
  tile_srs = 3857, // epsg code of the output tile
  tile_array_types_strategy = "auto",
  tile_layout = "[band][row,column]",
  tile_resolution = [1, 1],
  tile_width = 256,
  timed = false,
  use_overview = true,
  turbo = false
}: {
  bands?: number[];
  bbox: [number, number, number, number] | Readonly<[number, number, number, number]> | Readonly<[string, string, string, string]>;
  bbox_srs: number | string;
  cutline?: any;
  cutline_srs?: number;
  debug_level?: number;
  density?: number | undefined;
  geotiff: any;
  geotiff_srs?: number | string | undefined;
  expr?: ({ pixel }: { pixel: number[] }) => number[];
  // fit?: boolean | undefined;
  method: string | (({ values }: { values: number[] }) => number);
  round?: boolean;
  pixel_depth?: number;
  tile_array_types?:
    | ReadonlyArray<
        | "Array"
        | "Int8Array"
        | "Uint8Array"
        | "Uint8ClampedArray"
        | "Int16Array"
        | "Uint16Array"
        | "Float32Array"
        | "Float64Array"
        | "BigInt64Array"
        | "BigUint64Array"
      >
    | undefined;
  tile_array_types_strategy?: "auto" | "geotiff" | "untyped" | undefined;
  tile_srs?: number | string;
  tile_height: number;
  tile_layout?: string;
  tile_resolution?: number | number[] | [number, number] | Readonly<[number, number]> | undefined;
  tile_width: number;
  timed?: boolean | undefined;
  use_overview?: boolean;
  turbo?: boolean | undefined;
}) {
  let bbox_in_tile_srs;

  try {
    const start_time = timed ? performance.now() : 0;

    if (!bbox) throw new Error("[geotiff-tile] you must provide bbox");
    if (isNaN(tile_height)) throw new Error("[geotiff-tile] tile_height is NaN");
    if (isNaN(tile_width)) throw new Error("[geotiff-tile] tile_width is NaN");

    const image = await geotiff.getImage(0);
    const image_height = image.getHeight();

    const bbox_nums = [Number(bbox[0]), Number(bbox[1]), Number(bbox[2]), Number(bbox[3])] as const;
    if (debug_level >= 1) console.log("bbox_nums:", bbox_nums);

    if (!geotiff_srs) {
      const start_get_geotiff_epsg_code = timed ? performance.now() : 0;
      geotiff_srs = await get_geotiff_epsg_code(geotiff);
      if (timed) console.log("[geotiff-tile] parsing epsg code took " + Math.round(performance.now() - start_get_geotiff_epsg_code) + "ms");
    }
    if (debug_level >= 1) console.log("[geotiff-tile] geotiff_srs:", geotiff_srs);

    if (!geotiff_srs) {
      throw new Error(
        "[geotiff-tile] unfortunately we weren't able to parse an EPSG code from the GeoTIFF metadata. " +
          "Unfortunately, this library does not currently support reading tiles from GeoTIFF files with custom projections. " +
          "We hope to add this support in the future, per time and funding."
      );
    }

    // const image = await geotiff.getImage();

    const start_bbox_in_tile_srs = timed ? performance.now() : 0;
    bbox_in_tile_srs = (() => {
      if (tile_srs === bbox_srs) {
        return bbox;
      } else if (bbox_srs === "simple") {
        // if bbox_srs is simple, use srs of geotiff
        const geotransform = GT(image);
        const affine = Geotransform(geotransform);

        const [xmin, ymin, xmax, ymax] = bbox_nums;

        // flip y-axis
        const image_bbox = [xmin, image_height - ymax, xmax, image_height - ymin];

        const bbox_in_geotiff_srs = bboxfns_reproject(image_bbox, affine.forward, {
          async: false,
          density: 0 // standard 6-param geoaffine transformations won't lead to curved lines
        });
        if (debug_level >= 1) console.log("bbox_in_geotiff_srs:", bbox_in_geotiff_srs);

        if (geotiff_srs === tile_srs) {
          return bbox_in_geotiff_srs;
        } else {
          return reproject_bbox({
            bbox: bbox_in_geotiff_srs,
            density,
            from: geotiff_srs,
            to: tile_srs
          });
        }
      } else {
        if (debug_level >= 1) console.log(`reprojecting bbox from "${bbox_srs}" to "${tile_srs}"`);
        return reproject_bbox({
          bbox: bbox_nums,
          density,
          from: bbox_srs,
          to: tile_srs
        });
      }
    })();
    if (debug_level >= 1) console.log("bbox_in_tile_srs:", bbox_in_tile_srs);
    if (timed) console.log("[geotiff-tile] getting bbox_in_tile_srs took " + Math.round(performance.now() - start_bbox_in_tile_srs) + "ms");

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
    const readBoundingBoxOptions = (() => {
      if (bbox_srs === "simple" && tile_srs === geotiff_srs) {
        // not reprojecting the bbox, so just use the simple image coordinates
        // this helps avoid floating point arithmetic imprecision with using
        // the result from the affine transformation
        return {
          bbox: bbox_nums,
          debugLevel: debug_level,
          srs: "simple",
          geotiff,
          use_overview,
          target_height: tile_height,
          target_width: tile_width
        };
      } else {
        return {
          bbox: bbox_in_tile_srs,
          debugLevel: debug_level,
          srs: tile_srs,
          geotiff,
          use_overview,
          target_height: tile_height,
          target_width: tile_width
        };
      }
    })();

    if (debug_level >= 2) console.log("[geotiff-tile] calling readBoundingBox with:\n", readBoundingBoxOptions);
    const start_read_bbox = timed ? performance.now() : 0;
    const readResult = await readBoundingBox(readBoundingBoxOptions);
    if (debug_level >= 2) console.log("[geotiff-tile] geotiff-read-bbox result is:\n", readResult);
    if (timed) console.log("[geotiff-tile] reading bounding box took " + Math.round(performance.now() - start_read_bbox) + "ms");

    const sourceArrayType = readResult.data[0].constructor.name;
    if (debug_level >= 2) console.log("[geotiff-tile] sourceArrayType:\n", sourceArrayType);

    const [theoretical_min, theoretical_max] = (() => {
      switch (sourceArrayType) {
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

    let forward, inverse;
    if (geotiff_srs !== tile_srs) {
      ({ forward, inverse } = proj4fullyloaded(
        typeof geotiff_srs === "number" ? "EPSG:" + geotiff_srs : geotiff_srs,
        typeof tile_srs === "number" ? "EPSG:" + tile_srs : tile_srs
      ));
    }

    // if (fit && !_expr) {
    //   _expr = rawToRgb({
    //       format: "array",
    //       // flip: this.currentStats.mins.length === 1 ? true : false,
    //     //   ranges: zip(this.currentStats.mins, this.currentStats.maxs),
    //       round
    //   // });
    // }

    if (timed) console.log("[geotiff-tile] time elapsed before warping " + Math.round(performance.now() - start_time) + "ms");

    // warp result
    const start_geowarp = timed ? performance.now() : 0;

    const array_depth = tile_layout.match(/\[/g)!.length;

    tile_array_types = (() => {
      if (tile_array_types) {
        return tile_array_types;
      } else if (tile_array_types_strategy === "auto") {
        if (_expr) {
          // ex: [row,column,band] -> ["Array"]
          // ex: [band][row,column] -> ["Array", "Array"]
          return new Array(array_depth).fill("Array");
        } else {
          return new Array(array_depth - 1).fill("Array").concat([sourceArrayType]);
        }
      } else if (tile_array_types_strategy === "geotiff") {
        return new Array(array_depth - 1).fill("Array").concat([sourceArrayType]);
      } else if (tile_array_types_strategy === "untyped") {
        return new Array(array_depth - 1).fill("Array");
      }
      return new Array(array_depth - 1).fill("Array");
    })();
    if (debug_level >= 2) console.log("[geotiff-tile] tile_array_types:\n", tile_array_types);

    const bbox_in_tile_srs_num = bbox_in_tile_srs.map((it: number | string) => Number(it));

    const out_srs = tile_srs;

    const geowarp_options = {
      cutline,
      cutline_srs,
      cutline_forward: cutline ? proj4fullyloaded("EPSG:" + cutline_srs, "EPSG:" + tile_srs).forward : undefined,
      debug_level: debug_level > 1 ? debug_level - 1 : 0,
      forward,
      inverse,
      in_data: readResult.data,
      in_bbox: out_srs === "simple" ? readResult.simple_bbox : readResult.bbox,
      // in_geotransform is only necessary if using skewed or rotated in_data
      in_geotransform: out_srs === "simple" ? null : readResult.geotransform,
      in_layout: "[band][row,column]",
      in_no_data: get_geotiff_no_data_number(image),
      in_srs: geotiff_srs,
      in_width: readResult.width,
      in_height: readResult.height,
      method,
      // out_bands: should use if repeated bands in output
      out_array_types: tile_array_types,
      out_bbox: bbox_in_tile_srs_num,
      out_height: tile_height,
      out_layout: tile_layout,
      out_pixel_depth: pixel_depth,
      out_resolution: typeof tile_resolution === "number" ? [tile_resolution, tile_resolution] : tile_resolution,
      out_srs,
      out_width: tile_width,
      round,
      theoretical_max,
      theoretical_min,
      expr: _expr,
      turbo
    };
    if (debug_level >= 2) console.log("[geotiff-tile] geowarp_options:\n", geowarp_options);

    const { data: out_data, ...extra } = await geowarp(geowarp_options);
    if (timed) console.log("[geotiff-tile] geowarp took " + Math.round(performance.now() - start_geowarp) + "ms");

    if (timed) console.log("[geotiff-tile] took " + Math.round(performance.now() - start_time) + "ms");

    // @ts-ignore
    if (debug_level >= 1) extra.readResult = readResult;

    return {
      height: tile_height,
      tile: out_data,
      width: tile_width,
      extra // extra metadata from geowarp
    };
  } catch (error) {
    console.log("[geotiff-tile] failed to create tile");
    console.log("[geotiff-tile] bbox_in_tile_srs: ", bbox_in_tile_srs);
    console.log("[geotiff-tile] tile_height:", tile_height);
    console.log("[geotiff-tile] tile_width;", tile_width);
    console.log("[geotiff-tile] tile_srs:", tile_srs);
    console.log("[geotiff-tile] use_overview:", use_overview);
    console.error("[geotiff-tile] error:", error);
    throw error;
  }
}

if (typeof window === "object") {
  (window as any).geotiff_tile = { createTile };
}

if (typeof self === "object") {
  (self as any).geotiff_tile = { createTile };
}
