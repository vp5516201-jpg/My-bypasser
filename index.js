const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
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

// Helper function: Wait
const wait = (ms) => new Promise(res => setTimeout(res, ms));

async function bypassLink(url) {
    let browser = null;
    const proxy = proxyList[Math.floor(Math.random() * proxyList.length)];
    
    if (!proxy) return { error: "Server Busy. Try Again." };

    try {
        // MEMORY SAVING MODE ON ⚡
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage', // Memory full issue fix
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process', // Important for Free Tier
                '--disable-gpu',
                `--proxy-server=http://${proxy}`
            ]
        });

        const page = await browser.newPage();
        
        // Resource block karo taaki load kam pade (Images/Fonts)
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        page.setDefaultNavigationTimeout(60000);
        await page.goto(url, { waitUntil: 'domcontentloaded' });

        // Scroll Logic (Human)
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                const distance = 100;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    if (totalHeight >= scrollHeight || totalHeight > 2000) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 200);
            });
        });

        await wait(15000); // 15 sec wait

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
