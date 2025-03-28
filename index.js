const express = require("express");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const cors = require("cors");

puppeteer.use(StealthPlugin());

const app = express();
app.use(cors());

app.get("/api/track", async (req, res) => {
    const trackingNumber = req.query.num;
    if (!trackingNumber) {
        return res.status(400).json({ error: "Tracking number is required" });
    }

    const url = `https://parcelsapp.com/en/tracking/${trackingNumber}`;
    let browser;

    try {
        console.log(`Starting to scrape tracking number: ${trackingNumber}`);
        
        browser = await puppeteer.launch({
            headless: false, // Run with UI for debugging
            executablePath: '/opt/render/project/.render/chrome/opt/google/chrome/chrome',
            args: ["--no-sandbox", "--disable-setuid-sandbox"]
        });

        const page = await browser.newPage();

        await page.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
        );

        await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });

        console.log(`Navigating to ${url}`);
        await page.goto(url, { waitUntil: "networkidle2", timeout: 120000 }); // Increased timeout

        console.log("Waiting for page elements to load...");
        await page.waitForSelector(".parcel-attributes", { timeout: 120000 }); // Wait for a specific element

        const trackingEvents = await page.evaluate(() => {
            return Array.from(document.querySelectorAll(".event")).map(event => ({
                date: event.querySelector(".event-time strong")?.innerText.trim() || "N/A",
                time: event.querySelector(".event-time span")?.innerText.trim() || "N/A",
                status: event.querySelector(".event-content strong")?.innerText.trim() || "N/A",
                courier: event.querySelector(".carrier")?.innerText.trim() || "N/A"
            }));
        });

        const parcelInfo = await page.evaluate(() => {
            const getText = (selector) => document.querySelector(selector)?.innerText.trim() || "N/A";

            return {
                tracking_number: getText(".parcel-attributes tr:nth-child(1) .value span"),
                origin: getText(".parcel-attributes tr:nth-child(2) .value span:nth-child(2)"),
                destination: getText(".parcel-attributes tr:nth-child(3) .value span:nth-child(2)"),
                courier: getText(".parcel-attributes tr:nth-child(4) .value a"),
                days_in_transit: getText(".parcel-attributes tr:nth-child(6) .value span"),
                tracking_link: getText(".tracking-link input")
            };
        });

        if (!trackingEvents.length) {
            console.log("No tracking information found.");
            return res.status(404).json({ error: "Tracking information not found." });
        }

        console.log("Scraping successful!");
        res.json({ tracking_details: trackingEvents, parcel_info: parcelInfo });

    } catch (error) {
        console.error("Scraping error:", error);
        res.status(500).json({ error: error.message });
    } finally {
        if (browser) {
            console.log("Closing the browser.");
            await browser.close();
        }
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
