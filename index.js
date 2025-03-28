const express = require("express");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const cors = require("cors");
const randomUserAgent = require("user-agents");

puppeteer.use(StealthPlugin());

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

console.log(`Server starting on port ${PORT}...`);

app.get("/", (req, res) => {
    res.send("Tracking API is running.");
});

app.get("/api/track", async (req, res) => {
    const trackingNumber = req.query.num;
    if (!trackingNumber) {
        return res.status(400).json({ error: "Tracking number is required" });
    }

    const url = `https://parcelsapp.com/en/tracking/${trackingNumber}`;
    let browser;

    try {
        console.log(`Launching Puppeteer for tracking: ${trackingNumber}...`);

const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/usr/bin/google-chrome-stable',
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-software-rasterizer',
        '--proxy-server=direct://', // Removed extra quotes
        '--proxy-bypass-list=*',
    ],
});


        const page = await browser.newPage();
        console.log(`Navigating to ${url}...`);

        await page.setUserAgent(new randomUserAgent().toString());
        await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });

        await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

        // Wait for tracking details to load properly
        await page.waitForFunction(() => {
            return document.querySelector(".event") && !document.body.innerText.includes("No information about your package.");
        }, { timeout: 60000 }).catch(() => console.log("Tracking info not found or blocked."));

        console.log("Extracting tracking details...");

        let trackingEvents = await page.evaluate(() => {
            return Array.from(document.querySelectorAll(".event")).map(event => ({
                date: event.querySelector(".event-time strong")?.innerText.trim() || "N/A",
                time: event.querySelector(".event-time span")?.innerText.trim() || "N/A",
                status: event.querySelector(".event-content strong")?.innerText.trim() || "N/A",
                courier: event.querySelector(".carrier")?.innerText.trim() || "N/A"
            }));
        });

        if (!trackingEvents.length || trackingEvents.some(e => e.status === "No information about your package.")) {
            console.warn("Tracking data not found, retrying...");
            await page.reload({ waitUntil: "networkidle2" });
            await page.waitForTimeout(3000);

            trackingEvents = await page.evaluate(() => {
                return Array.from(document.querySelectorAll(".event")).map(event => ({
                    date: event.querySelector(".event-time strong")?.innerText.trim() || "N/A",
                    time: event.querySelector(".event-time span")?.innerText.trim() || "N/A",
                    status: event.querySelector(".event-content strong")?.innerText.trim() || "N/A",
                    courier: event.querySelector(".carrier")?.innerText.trim() || "N/A"
                }));
            });
        }

        if (!trackingEvents.length) {
            console.warn("No tracking information found.");
            return res.status(404).json({ error: "Tracking information not found." });
        }

        console.log("Tracking details successfully extracted!");
        res.json({ tracking_details: trackingEvents });

    } catch (error) {
        console.error("Scraping error:", error);
        res.status(500).json({ error: "Scraping blocked by site" });
    } finally {
        if (browser) {
            console.log("Closing Puppeteer...");
            await browser.close();
        }
    }
});

app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});
