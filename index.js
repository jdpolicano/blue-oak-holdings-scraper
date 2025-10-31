import { chromium } from "playwright";

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();

await page.goto(
  "https://bbms.info/cgi-bin/a-bus2ff.asp?folder=bbf-4110&src=bus-price1MMp&pricemin=1000000",
);

const locs = await page.locator(".catdisplay").all();

console.log(locs.length);

await browser.close();
