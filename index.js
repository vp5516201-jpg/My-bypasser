const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const chromium = require("@sparticuz/chromium");
const axios = require('axios');
const cors = require('cors');

puppeteer.use(StealthPlugin());

const app = express();
app.use(cors());
app.use(express.json());

const PROXY_API = 'https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=5000&country=all&ssl=all&anonymity=all';
let proxyList = [];

async function updateProxies() {
    try {
        const response = await axios.get(PROXY_API);
        proxyList = response.data.split('\r\n').filter(p => p);
        console.log(`Updated: ${proxyList.length} proxies.`);
    } catch (e) { console.log("Proxy update failed"); }
}
updateProxies();
setInterval(updateProxies, 600000);

const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Linux; Android 10; SM-A205U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36'
];

async function bypassLink(url) {
    let browser = null;
    const proxy = proxyList[Math.floor(Math.random() * proxyList.length)];
    const agent = userAgents[Math.floor(Math.random() * userAgents.length)];

    if (!proxy) return { error: "Server Busy. Try Again." };

    try {
        // LITE BROWSER LAUNCH CONFIG
        browser = await puppeteer.launch({
            args: [...chromium.args, `--proxy-server=http://${proxy}`],
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            ignoreHTTPSErrors: true
        });

        const page = await browser.newPage();
        await page.setUserAgent(agent);
        page.setDefaultNavigationTimeout(60000);

        await page.goto(url, { waitUntil: 'domcontentloaded' });

        // Auto Scroll (Human Behavior)
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                const distance = 50;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    if (totalHeight >= scrollHeight || totalHeight > 1000) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 200);
            });
        });

        await new Promise(r => setTimeout(r, 15000));
        const finalUrl = page.url();
        await browser.close();
        return { originalUrl: finalUrl };

    } catch (error) {
        if(browser) await browser.close();
        return { error: "Proxy Failed. Retry." };
    }
}

app.get('/api/bypass', async (req, res) => {
    const url = req.query.url;
    if(!url) return res.json({ error: "No URL" });
    const result = await bypassLink(url);
    res.json(result);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Running on ${PORT}`));
