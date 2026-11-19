export default async (page) => {
  await page.waitForTimeout(9000);
  await page.screenshot({ path: 'shots/play_o.png' });
};
