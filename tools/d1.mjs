export default async (page) => {
  await page.evaluate(() => { __ty.clearOverlays(true); __ty.start(); __ty.quality('medium'); __ty.tp(0, -48); __ty.reveal(); __ty.step(4); });
  await page.waitForFunction(() => __ty.idle(), null, { timeout: 300000 });
  await page.evaluate(() => __ty.renderer.getContext().finish()); await page.waitForTimeout(2500);
  await page.screenshot({ path: 'shots/dbg_reveal_med.png' });
  await page.evaluate(() => { __ty.tp(0, 68); __ty.follow(); __ty.step(4); });
  await page.waitForFunction(() => __ty.idle(), null, { timeout: 300000 });
  await page.evaluate(() => __ty.renderer.getContext().finish()); await page.waitForTimeout(2500);
  await page.screenshot({ path: 'shots/dbg_blossom_med.png' });
};
