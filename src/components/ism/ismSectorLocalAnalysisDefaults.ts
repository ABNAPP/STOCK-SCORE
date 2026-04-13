/** ISM sector detail — local analysis only (never persisted; overview unchanged). */

export type IsmLocalParamSettings = {
  slopeLookback: number;
  sectorSmaLength: number;
  rsMaLength: number;
  breadthThreshold: number;
};

export const ISM_DETAIL_LOCAL_PARAM_DEFAULTS: IsmLocalParamSettings = {
  slopeLookback: 20,
  sectorSmaLength: 200,
  rsMaLength: 252,
  breadthThreshold: 60,
};

export const ISM_LOCAL_SLOPE_RANGE = { min: 5, max: 60 } as const;
export const ISM_LOCAL_SECTOR_SMA_RANGE = { min: 50, max: 300 } as const;
export const ISM_LOCAL_RS_MA_RANGE = { min: 100, max: 300 } as const;
export const ISM_LOCAL_BREADTH_RANGE = { min: 40, max: 80 } as const;

export function clampLocalParams(p: IsmLocalParamSettings): IsmLocalParamSettings {
  return {
    slopeLookback: Math.min(ISM_LOCAL_SLOPE_RANGE.max, Math.max(ISM_LOCAL_SLOPE_RANGE.min, Math.round(p.slopeLookback))),
    sectorSmaLength: Math.min(
      ISM_LOCAL_SECTOR_SMA_RANGE.max,
      Math.max(ISM_LOCAL_SECTOR_SMA_RANGE.min, Math.round(p.sectorSmaLength))
    ),
    rsMaLength: Math.min(ISM_LOCAL_RS_MA_RANGE.max, Math.max(ISM_LOCAL_RS_MA_RANGE.min, Math.round(p.rsMaLength))),
    breadthThreshold: Math.min(
      ISM_LOCAL_BREADTH_RANGE.max,
      Math.max(ISM_LOCAL_BREADTH_RANGE.min, Math.round(p.breadthThreshold))
    ),
  };
}

export function localParamsEqual(a: IsmLocalParamSettings, b: IsmLocalParamSettings): boolean {
  return (
    a.slopeLookback === b.slopeLookback &&
    a.sectorSmaLength === b.sectorSmaLength &&
    a.rsMaLength === b.rsMaLength &&
    a.breadthThreshold === b.breadthThreshold
  );
}
