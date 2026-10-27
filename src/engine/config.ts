// 世界常量 —— 数值与旧版完全一致
export const WORLD = {
  size: 1500,
  half: 750,
  R: 575,
  seaLevel: 0,
  roadRadius: 452,
  heightRes: 513,
  seg: 512,
} as const;

export interface Site {
  x: number;
  z: number;
  r: number;
  h: number;
}

export const SITE_CAMP: Site = { x: 168, z: 316, r: 62, h: 7.2 };
export const SITE_VILLAGE: Site = { x: 318, z: 46, r: 74, h: 9.4 };
export const SITE_DOCK: Site = { x: 596, z: -26, r: 46, h: 1.4 };
export const SITES = { CAMP: SITE_CAMP, VILLAGE: SITE_VILLAGE, DOCK: SITE_DOCK };

/** 灯塔位置（旧版 M4） */
export const LIGHTHOUSE_POS = { x: 458, z: -384 };

/** 越野小径折线（旧版 dw） */
export const TRAIL: Array<[number, number]> = [
  [-236, -158],
  [-196, -150],
  [-150, -132],
  [-104, -112],
  [-52, -92],
  [-8, -60],
  [30, -26],
  [58, 18],
  [74, 66],
  [92, 112],
  [120, 154],
  [166, 186],
  [214, 204],
  [250, 238],
  [286, 270],
  [322, 300],
  [358, 330],
  [400, 362],
  [446, 396],
  [500, 434],
  [556, 470],
];

/** 车漆列表（旧版 Dg，十进制色值原样保留） */
export const PAINTS = [
  { name: "远山青", color: 9348257 },
  { name: "火山灰", color: 5790558 },
  { name: "曜石黑", color: 1316378 },
  { name: "珍珠白", color: 14211542 },
  { name: "暮光金", color: 11901550 },
  { name: "深海蓝", color: 2835296 },
];

/** GLB 内饰贴图映射（键 → 资产文件，顺序即旧版 base64 出现顺序） */
export const INTERIOR_TEXTURES: Record<string, string> = {
  carInternal_Frame_Top_MT_Pottery_MP: "tex00",
  carInternal_Frame_Bottom_MT_Pottery_MP: "tex01",
  carInternal_DoorFront_MT_Pottery_MP: "tex02",
  carInternal_DoorBack_MT_Pottery_MP: "tex03",
  carInternal_Dashboard_MT_Pottery_MP: "tex04",
  carInternal_CenterConsole_MT_Pottery_MP: "tex05",
  carInternal_PassengerSeatFront_MT_Pottery_MP: "tex06",
  carInternal_PassengerSeatMid_MT_Pottery_MP: "tex07",
  carInternal_PassengerSeatBack_MT_Pottery_MP: "tex08",
  carInternal_SteeringWheel_MT_Pottery_MP: "tex09",
  carInternal_TrunkExternal_MT_Pottery_MP: "tex10",
  carInternal_PassengerSeatSafetyBelt_MT_Pottery_MP: "tex11",
  carInternal_TopTent_MT_Pottery_MP: "tex12",
  carLight_bulb_MP: "tex13",
  carWheelRim_ACAL25: "tex14",
  carTyre_01_ao: "tex15",
  carPlastic_BrilliantBlackShape: "tex16",
  carPlastic_MatteBlackShape: "tex17",
  carCaliper_1Shape: "tex18",
  carPaint_Shape1: "tex19",
  carWheelLogoShape: "tex20",
  aluminum_MP: "tex21",
  carInternal_Frame_Top_MT_CreamBrown_MP: "tex22",
  carInternal_Frame_Bottom_MT_CreamBrown_MP: "tex23",
  carInternal_DoorFront_MT_CreamBrown_MP: "tex24",
  carInternal_DoorBack_MT_CreamBrown_MP: "tex25",
  carInternal_Dashboard_MT_CreamBrown_MP: "tex26",
  carInternal_CenterConsole_MT_CreamBrown_MP: "tex27",
  carInternal_PassengerSeatFront_MT_CreamBrown_MP: "tex28",
  carInternal_PassengerSeatMid_MT_CreamBrown_MP: "tex29",
  carInternal_PassengerSeatBack_MT_CreamBrown_MP: "tex30",
  carInternal_SteeringWheel_MT_CreamBrown_MP: "tex31",
  carInternal_TrunkExternal_MT_CreamBrown_MP: "tex32",
  carInternal_PassengerSeatSafetyBelt_MT_CreamBrown_MP: "tex33",
};

/** 车模型网格名 → 材质类别（旧版 M6） */
export const CAR_MATERIAL_RULES: Array<[string, RegExp]> = [
  ["paint", /^carPaint/i],
  ["glass", /glass/i],
  ["tyre", /^carTyre/i],
  ["rim", /WheelRim|WheelHub|WheelScrew|WheelLogo|WheelGlass/i],
  ["brake", /Brake/i],
  ["caliper", /Caliper/i],
  ["chrome", /Chroming|carChrome/i],
  ["glossBlack", /BrilliantBlack/i],
  ["matteBlack", /MatteBlack/i],
  ["silver", /BrilliantSilver|Aluminum|Aluminium/i],
  ["light", /bulb|HeaterStrip|LightGlass|LightPlastic/i],
  ["plate", /carPlate/i],
  ["leather", /internal.*(Seat|Door|Dashboard|CenterConsole|SteeringWheel|Frame|SafetyBelt|TrunkExternal|TopTent)/i],
  ["trim", /internal/i],
  ["bodyTrim", /Bumper|Fender|WindowTrim|Versatile|doorLock|Logo|XiaoMi|asist/i],
];

/** 昼夜预设（旧版 AT） */
export const TIME_PRESETS = [7.2, 12.5, 16, 18.6, 21.5];
