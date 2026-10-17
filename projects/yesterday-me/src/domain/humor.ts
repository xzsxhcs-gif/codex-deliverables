const remarks = {
  sealed: [
    '被告已于今日悄悄离场，明日再议。',
    '你有权保持沉默，但今天的你已经写得很清楚了。',
    '时间正在押送证据，请勿催促。',
    '本庭不接受来自平行宇宙的补充材料。',
  ],
  judged: [
    '昨天的你已离线，无法接受申诉。',
    '由于时间不可逆，本次审判无法传唤被告。',
    '系统尝试联系昨天的你……连接失败。',
    '被告已于昨日离开现场。请今天的你继续生活。',
  ],
};

/** Pick once per meaningful action, never on every render or countdown tick. */
export function pickRemark(scene: keyof typeof remarks): string {
  const pool = remarks[scene];
  return pool[Math.floor(Math.random() * pool.length)]!;
}
