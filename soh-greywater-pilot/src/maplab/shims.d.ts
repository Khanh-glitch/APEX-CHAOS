declare module "polylabel" {
  const polylabel: (polygon: number[][][], precision?: number, debug?: boolean) => number[] & { distance: number };
  export default polylabel;
}
