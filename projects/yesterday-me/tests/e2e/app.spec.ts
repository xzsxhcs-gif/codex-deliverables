import { chromium, expect, test, type BrowserContext, type Page } from '@playwright/test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TODAY = new Date('2026-10-17T15:59:30.000Z');
const TOMORROW = new Date('2026-10-17T16:00:01.000Z');
let uncaught: string[] = [];

test.beforeEach(async ({ page, context }) => {
  uncaught = [];
  page.on('pageerror', error => uncaught.push(error.message));
  context.on('page', tab => tab.on('pageerror', error => uncaught.push(error.message)));
});

test.afterEach(() => {
  expect(uncaught, '页面不应出现未捕获的 JavaScript 异常').toEqual([]);
});

async function start(page: Page) {
  await page.clock.install({ time: TODAY });
  await page.clock.setFixedTime(TODAY);
  await page.goto('/');
  await page.getByRole('button', { name: '开启第一份档案', exact: true }).click();
}

async function seal(page: Page, title: string, prediction: 'forgive' | 'hiss' | 'unsure' = 'forgive') {
  await page.getByRole('navigation').getByRole('button', { name: /^封存/ }).click();
  await page.getByLabel('标题').fill(title);
  await page.getByLabel('留言').fill(`${title}的原始留言：今天休息一下也很好。`);
  await page.getByLabel('昨日辩护词').fill(`${title}的辩护：我当时确实需要休息。`);
  const names = { forgive: /一定会原谅我/, hiss: /肯定会对我哈气/, unsure: /不好说/ };
  await page.getByRole('radio', { name: names[prediction] }).check();
  await page.getByRole('button', { name: '封存证据', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '证据已封存。被告暂时安全。' })).toBeVisible();
  await expect(page.getByLabel('标题')).toHaveValue('');
}

async function midnight(page: Page) {
  await page.clock.setFixedTime(TOMORROW);
  await page.clock.runFor(1200);
}

async function settings(page: Page) {
  await page.getByRole('button', { name: /设置/ }).click();
}

test('首次引导、空状态、窄屏布局、主题和减少动态效果', async ({ page }) => {
  await start(page);
  await expect(page.getByRole('link', { name: '昨日的我，返回封存', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^待审/ }).click();
  await expect(page.getByText('今日休庭，昨日尚无证据。', { exact: true })).toBeVisible();
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  const longAnimations = await page.evaluate(() => [...document.querySelectorAll('*')].filter(element => {
    const style = getComputedStyle(element);
    return style.animationName !== 'none' && Number.parseFloat(style.animationDuration) > 0.001;
  }).length);
  expect(longAnimations).toBe(0);
  await settings(page);
  await page.getByRole('button', { name: '切换浅色', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('button', { name: '开启第一份档案', exact: true })).toHaveCount(0);
});

test('封存内容和预测保密，午夜后揭晓、不可重判、档案筛选与真实统计', async ({ page }) => {
  await start(page);
  await seal(page, '给自己放个假', 'forgive');
  await seal(page, '晚上又想买杯茶', 'hiss');
  await page.getByRole('button', { name: /^待审/ }).click();
  await expect(page.getByText('给自己放个假', { exact: true })).toHaveCount(0);
  await expect(page.getByText('晚上又想买杯茶', { exact: true })).toHaveCount(0);
  await expect(page.getByText(/的原始留言/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /解封|打开证据/ })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(/的原始留言/)).toHaveCount(0);
  await midnight(page);
  await page.getByRole('button', { name: /给自己放个假/ }).click();
  await expect(page.getByText('给自己放个假的原始留言：今天休息一下也很好。', { exact: true })).toBeVisible();
  await expect(page.getByText('给自己放个假的辩护：我当时确实需要休息。', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '昨日的预测' })).toHaveCount(0);
  await page.getByRole('button', { name: /辩护/ }).click();
  await expect(page.getByText('被告的辩护材料已提交。', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /无罪释放/ }).click();
  await expect(page.getByText('本庭宣布，被告无罪。', { exact: true })).toBeVisible();
  await expect(page.getByRole('dialog').getByText('预测成功', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /对自己哈气/ })).toHaveCount(0);
  await page.getByRole('button', { name: '关闭对话框', exact: true }).click();
  await page.getByRole('button', { name: /晚上又想买杯茶/ }).click();
  await page.getByRole('button', { name: /辩护/ }).click();
  await page.getByRole('button', { name: /对自己哈气/ }).click();
  await expect(page.getByText('昨日的你已被严厉警告。', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '关闭对话框', exact: true }).click();
  await page.getByRole('navigation').getByRole('button', { name: /^档案/ }).click();
  await expect(page.getByText('给自己放个假', { exact: true })).toBeVisible();
  await expect(page.getByText('晚上又想买杯茶', { exact: true })).toBeVisible();
  await expect(page.locator('.archive-row').first()).toContainText('晚上又想买杯茶');
  await page.getByLabel('归档日期排序').selectOption('oldest');
  await expect(page.locator('.archive-row').first()).toContainText('给自己放个假');
  await page.getByRole('button', { name: /给自己放个假.*查看档案/ }).click();
  await expect(page.getByText('本庭宣布，被告无罪。', { exact: true })).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('button', { name: /无罪释放|对自己哈气/ })).toHaveCount(0);
  await page.getByRole('button', { name: '关闭对话框', exact: true }).click();
  await page.getByRole('group', { name: '按判决筛选' }).getByRole('button', { name: /对自己哈气/ }).click();
  await expect(page.getByText('给自己放个假', { exact: true })).toHaveCount(0);
  await expect(page.getByText('晚上又想买杯茶', { exact: true })).toBeVisible();
  await page.getByRole('navigation').getByRole('button', { name: /^统计/ }).click();
  await expect(page.getByText('100%', { exact: true })).toBeVisible();
  await expect(page.getByText(/本月已对自己哈气 1 次/)).toBeVisible();
  await expect(page.locator('dl[aria-label="累计记录"] > div').filter({ hasText: '累计封存' }).locator('dd')).toHaveText('2份');
  await expect(page.locator('dl[aria-label="累计记录"] > div').filter({ hasText: '累计审判' }).locator('dd')).toHaveText('2次');
  await expect(page.getByRole('listitem', { name: '星期日，2 次审判' })).toBeVisible();
});

test('表单校验、可选标题和辩护、错过次日仍可阅读、不确定预测不计分', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: '封存证据', exact: true }).click();
  await expect(page.getByText('先给明天的自己留句话吧。', { exact: true })).toBeVisible();
  await expect(page.getByText('选一个预测。拿不准，也是一种答案。', { exact: true })).toBeVisible();
  await page.getByLabel('留言').fill('这是给几天后的留言。');
  await page.getByRole('radio', { name: /不好说/ }).check();
  await page.getByRole('button', { name: '封存证据', exact: true }).click();
  await expect(page.getByLabel('留言')).toHaveValue('');
  await page.clock.setFixedTime(new Date('2026-10-19T16:00:01.000Z'));
  await page.clock.runFor(1200);
  await page.getByRole('button', { name: /^待审/ }).click();
  await page.getByRole('button', { name: /未命名证据/ }).click();
  await expect(page.getByText('这是给几天后的留言。', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /展开昨日辩护词/ }).click();
  await expect(page.getByText(/昨日的你没有留下辩护词/)).toBeVisible();
  await page.getByRole('button', { name: /无罪释放/ }).click();
  await expect(page.getByText(/这次不计入准确率/)).toBeVisible();
  await page.getByRole('button', { name: '关闭对话框', exact: true }).click();
  await page.getByRole('navigation').getByRole('button', { name: /^统计/ }).click();
  await expect(page.getByRole('region', { name: '预测准确率' }).getByText('—', { exact: true })).toBeVisible();
});

test('JSON 备份、重复合并、损坏备份错误、清空二次确认及恢复', async ({ page }) => {
  await start(page);
  await seal(page, '备份证据', 'unsure');
  await settings(page);
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: /导出.*(备份|JSON)/ }).click();
  const download = await downloaded;
  const backupPath = await download.path();
  expect(backupPath).toBeTruthy();
  const backup = JSON.parse(await readFile(backupPath!, 'utf8'));
  expect(backup.app).toBe('yesterday-me');
  expect(backup.capsules).toHaveLength(1);
  expect(backup.capsules[0].prediction).toBe('unsure');
  await page.locator('input[type=file]').setInputFiles(backupPath!);
  await page.getByRole('button', { name: '确认合并导入', exact: true }).click();
  await expect(page.getByText(/新增 0 条，重复 1 条/)).toBeVisible();
  await page.locator('input[type=file]').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{oops') });
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: '删除全部数据', exact: true }).click();
  await page.getByRole('button', { name: /取消|保留/ }).click();
  await page.getByRole('button', { name: '删除全部数据', exact: true }).click();
  await expect(page.getByRole('button', { name: '确认删除全部数据', exact: true })).toBeDisabled();
  await page.getByLabel('输入「删除」以确认').fill('删除');
  await page.getByRole('button', { name: '确认删除全部数据', exact: true }).click();
  await expect(page.getByText(/本机档案已清空/)).toBeVisible();
  await settings(page);
  await page.locator('input[type=file]').setInputFiles(backupPath!);
  await page.getByRole('button', { name: '确认合并导入', exact: true }).click();
  await expect(page.getByText(/新增.*1|导入.*1|1.*新增/)).toBeVisible();
});

test('新标签页持久化，离线刷新可封存，PWA 静态缓存不含私人记录', async ({ page, context }) => {
  await start(page);
  await seal(page, '离线保留证据', 'unsure');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  const manifestURL = await page.locator('link[rel=manifest]').getAttribute('href');
  expect(manifestURL).toBeTruthy();
  const manifest = await (await page.request.get(manifestURL!)).json();
  expect(manifest.name).toContain('昨日的我');
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.some((icon: { sizes: string }) => icon.sizes.includes('512'))).toBe(true);
  const cacheURLs = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const key of await caches.keys()) {
      const cache = await caches.open(key);
      urls.push(...(await cache.keys()).map(request => request.url));
    }
    return urls;
  });
  expect(cacheURLs.length).toBeGreaterThan(3);
  expect(cacheURLs.every(url => new URL(url).origin === 'http://127.0.0.1:4175')).toBe(true);
  expect(cacheURLs.every(url => /\.(js|css|html|svg|png|webmanifest)$/.test(new URL(url).pathname))).toBe(true);
  const newTab = await context.newPage();
  await newTab.clock.install({ time: TODAY });
  await newTab.clock.setFixedTime(TODAY);
  await newTab.goto('/');
  await expect(newTab.getByRole('button', { name: '开启第一份档案', exact: true })).toHaveCount(0);
  await context.setOffline(true);
  await newTab.reload();
  await settings(newTab);
  await expect(newTab.getByText('离线文件已就绪', { exact: true })).toBeVisible();
  await newTab.getByRole('button', { name: '关闭对话框', exact: true }).click();
  await seal(newTab, '断网也能封存', 'hiss');
  await newTab.getByRole('navigation').getByRole('button', { name: /^统计/ }).click();
  await expect(newTab.locator('dl[aria-label="累计记录"] > div').filter({ hasText: '累计封存' }).locator('dd')).toHaveText('2份');
  await context.setOffline(false);
});

test('浏览器存储不可用时显示可恢复的错误状态', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', {
      get() { throw new Error('模拟：浏览器禁止本地存储'); },
    });
  });
  await page.goto('/');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: '重新连接本地存储', exact: true })).toBeVisible();
});

test('回拨日期重新锁定，其他标签页的判决和删除同步到已打开的详情', async ({ page, context }) => {
  await start(page);
  await seal(page, '时空同步证据', 'forgive');
  await midnight(page);
  await page.getByRole('button', { name: /^待审/ }).click();
  await page.getByRole('button', { name: /时空同步证据/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.clock.setFixedTime(TODAY);
  await page.clock.runFor(1200);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('时空同步证据', { exact: true })).toHaveCount(0);
  await midnight(page);
  await page.getByRole('button', { name: /时空同步证据/ }).click();
  await page.getByRole('button', { name: /展开昨日辩护词/ }).click();

  const other = await context.newPage();
  await other.clock.install({ time: TOMORROW });
  await other.clock.setFixedTime(TOMORROW);
  await other.goto('/#trial');
  await other.getByRole('button', { name: /时空同步证据/ }).click();
  await other.getByRole('button', { name: /展开昨日辩护词/ }).click();
  await page.getByRole('button', { name: /无罪释放/ }).click();
  await expect(other.getByText('本庭宣布，被告无罪。', { exact: true })).toBeVisible();
  await expect(other.getByRole('dialog').getByRole('button', { name: /无罪释放|对自己哈气/ })).toHaveCount(0);

  await page.getByRole('button', { name: '关闭对话框', exact: true }).click();
  await settings(page);
  await page.getByRole('button', { name: '删除全部数据', exact: true }).click();
  await page.getByLabel('输入「删除」以确认').fill('删除');
  await page.getByRole('button', { name: '确认删除全部数据', exact: true }).click();
  await expect(other.getByRole('dialog')).toHaveCount(0);
  await expect(other.getByText('时空同步证据', { exact: true })).toHaveCount(0);
  await expect(other.getByText('今日休庭，昨日尚无证据。', { exact: true })).toBeVisible();
});

test('完全退出浏览器再以同一真实磁盘配置启动，证据与偏好仍保留且跨日可读', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'yesterday-me-persistence-'));
  let active: BrowserContext | undefined;
  const launch = () => chromium.launchPersistentContext(profile, {
    ...test.info().project.use.launchOptions,
    headless: true,
    baseURL: test.info().project.use.baseURL,
    viewport: { width: 390, height: 844 },
    timezoneId: 'Asia/Shanghai',
    locale: 'zh-CN',
    serviceWorkers: 'allow',
  });
  try {
    active = await launch();
    const first = active.pages()[0] ?? await active.newPage();
    first.on('pageerror', error => uncaught.push(error.message));
    await start(first);
    await seal(first, '浏览器关门之后', 'forgive');
    await first.getByRole('button', { name: '切换浅色模式', exact: true }).click();
    await expect(first.locator('html')).toHaveAttribute('data-theme', 'light');

    // Closing a persistent context terminates its browser. No storageState or DB seeding is used.
    await active.close();
    active = undefined;
    active = await launch();
    const reopened = active.pages()[0] ?? await active.newPage();
    reopened.on('pageerror', error => uncaught.push(error.message));
    await reopened.clock.install({ time: TODAY });
    await reopened.clock.setFixedTime(TODAY);
    await reopened.goto('/');
    await expect(reopened.getByText('1 份封存中', { exact: true })).toBeVisible();
    await expect(reopened.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(reopened.getByRole('button', { name: '开启第一份档案', exact: true })).toHaveCount(0);
    await reopened.getByRole('button', { name: /^待审/ }).click();
    await expect(reopened.getByText('浏览器关门之后', { exact: true })).toHaveCount(0);
    await expect(reopened.getByRole('heading', { name: '尚未解锁', exact: true })).toBeVisible();
    await midnight(reopened);
    await reopened.getByRole('button', { name: /浏览器关门之后/ }).click();
    await expect(reopened.getByText('浏览器关门之后的原始留言：今天休息一下也很好。', { exact: true })).toBeVisible();
    await reopened.getByRole('button', { name: '展开昨日辩护词', exact: true }).click();
    await expect(reopened.getByText('浏览器关门之后的辩护：我当时确实需要休息。', { exact: true })).toBeVisible();
    await expect(reopened.getByRole('heading', { name: '昨日的预测', exact: true })).toHaveCount(0);
  } finally {
    await active?.close();
    await rm(profile, { recursive: true, force: true });
  }
});
