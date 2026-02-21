import oriYunDict from "./oriYunDict.json";

export type YunDict = Record<string, string>;

export type RhythmConfig = {
  id: string;
  label: string;
  description: string;
  dict: YunDict;
};

export const rhythmConfigs: RhythmConfig[] = [
  {
    id: "pingshui-yun",
    label: "平水韵",
    description: "基于平水韵部进行标注。",
    dict: oriYunDict as YunDict,
  },
];
