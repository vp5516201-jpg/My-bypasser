const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');
const cors = require('cors');

puppeteer.use(StealthPlugin());

const app = express();
app.use(cors());
app.use(express.json());

// Free Proxy List
const PROXY_API = 'https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=5000&country=all&ssl=all&anonymity=all';
let proxyList = [];

// 1. Proxies Fetch Karo
async function updateProxies() {
    try {
        const response = await axios.get(PROXY_API);
        proxyList = response.data.split('\r\n').filter(p => p);
        console.log(`Updated: ${proxyList.length} proxies.`);
    } catch (e) { console.log("Proxy update failed"); }
}
updateProxies();
setInterval(updateProxies, 600000); // Har 10 min me refresh

// 2. Random User Agent (Mobile/PC Mix)
const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Linux; Android 10; SM-A205U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1'
];

async function bypassLink(url) {
    let browser = null;
    // Proxy & Agent Pick Karo
    const proxy = proxyList[Math.floor(Math.random() * proxyList.length)];
    const agent = userAgents[Math.floor(Math.random() * userAgents.length)];

    if (!proxy) return { error: "Server Busy (No Proxy). Try Again." };

    try {
        browser = await puppeteer.launch({
            headless: true, // "new"
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                `--proxy-server=http://${proxy}`
            ]
        });

        const page = await browser.newPage();
        await page.setUserAgent(agent);
        page.setDefaultNavigationTimeout(60000); // 60s timeout

        console.log(`Visiting: ${url} with Proxy: ${proxy}`);
        
        // Website Open
        await page.goto(url, { waitUntil: 'domcontentloaded' });

        // === HUMAN BEHAVIOR SIMULATION (Zaroori for View Count) ===
        
        // Step A: Mouse Hilana (Fake Mouse)
        await page.mouse.move(100, 100);
        await page.mouse.move(200, 200);
        await page.mouse.down();
        await page.mouse.up();

        // Step B: Dheere Dheere Scroll Karna
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                const distance = 50; // Chota scroll
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;

                    // Thoda randomness add kiya
                    if (totalHeight >= scrollHeight || totalHeight > 1500) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 200);
            });
        });

        // Step C: 15 Second Wait
        await new Promise(r => setTimeout(r, 15000));

        const finalUrl = page.url();
        await browser.close();
        
        if(finalUrl === url) return { error: "Bypass stuck. Try again." };
        return { originalUrl: finalUrl };

    } catch (error) {
        if(browser) await browser.close();
        return { error: "Proxy Failed or Timeout. Please Retry." };
    }
}

app.get('/', (req, res) => res.send("Server Running... Use Frontend."));

app.get('/api/bypass', async (req, res) => {
    const url = req.query.url;
    if(!url) return res.json({ error: "No URL" });
    const result = await bypassLink(url);
    res.json(result);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Running on ${PORT}`));
