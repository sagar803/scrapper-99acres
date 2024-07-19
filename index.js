import puppeteer from "puppeteer-extra";
import path from "path";
import fs from "fs";
import util from "util";
import { fileURLToPath } from "url";
import { areas } from "./input.js";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import UserAgent from "user-agents";

puppeteer.use(StealthPlugin());

const writeFileAsync = util.promisify(fs.writeFile);
const mkdirAsync = util.promisify(fs.mkdir);

const getPropertyLinks = async (searchArea) => {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: false,
      args: ["--disable-http2"], // Disable HTTP/2 to avoid protocol error
    });
    const searchUrl = `https://www.99acres.com/search/property/buy/${searchArea}?city=8&keyword=${searchArea}&preference=S&area_unit=1&res_com=R`;

    const page = await browser.newPage();
    const userAgent = new UserAgent({ deviceCategory: "desktop" });
    await page.setUserAgent(userAgent.toString());

    await page.goto(searchUrl);
    let scroll = 500;
    while (scroll < 7000) {
      await page.evaluate(`window.scrollTo(0, ${scroll})`);
      scroll += 500;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Get the links of each listing
    const propertyLinks = await page.evaluate(() => {
      const propertyElements = document.querySelectorAll(
        "#app > div > div > div.r_srp__mainWrapper > div.r_srp__rightSection > div:nth-child(2) section"
      );
      const links = [];

      propertyElements.forEach((elem, index) => {
        if (index >= 15) return; // Limit to 15 properties
        const link = elem.querySelector("a")?.href;
        if (link) {
          links.push(link);
        }
      });

      return links;
    });

    return propertyLinks;
  } catch (error) {
    console.error("Error scraping property links:", error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

const scrapePropertyDetails = async (propertyLink) => {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--disable-http2"],
      defaultViewport: { width: 1920, height: 1080 },
    });
    const page = await browser.newPage();
    // await page.setDefaultNavigationTimeout(60000);
    const userAgent = new UserAgent({ deviceCategory: "desktop" });
    await page.setUserAgent(userAgent.toString());

    await page.goto(propertyLink);

    let scroll = 500;
    while (scroll < 7000) {
      await page.evaluate(`window.scrollTo(0, ${scroll})`);
      scroll += 500;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    const propertyDetails = await page.evaluate(() => {
      const property = {
        meta: {},
        images: [],
        ratings: {},
      };

      // Parse location
      property.meta.location = document
        .querySelector(
          "#FloatingHeaderComponentTop > div > div.component__pdbasicDetailWrap.pd__contentInnerWrap.pd__pdbasicDetailWrap > div.component__pdMainDetail.component__rentMainDetail.pd__rentMainDetail > h1 > div.component__pdPropSocietyDetail.pd__pdPropEmi > span"
        )
        ?.innerText.trim();

      // Parse area
      property.meta.builtUpArea = document
        .querySelector("#factArea > span:nth-child(3)")
        ?.innerText.trim();
      property.meta.areaUnit = document
        .querySelector(".component__details > span:nth-child(2)")
        ?.innerText.trim();

      // Parse configuration
      property.meta.bedrooms = document
        .querySelector("#bedRoomNum")
        ?.innerText.trim();
      property.meta.bathrooms = document
        .querySelector("#bathroomNum")
        ?.innerText.trim();
      property.meta.balconies = document
        .querySelector("#balconyNum")
        ?.innerText.trim();
      property.meta.additionalRooms = document
        .querySelector("#additionalRooms")
        ?.innerText.trim();

      // Parse price
      property.meta.price = document
        .querySelector("#pdPrice2")
        ?.innerText.trim();
      property.meta.pricePerSqFt = document
        .querySelector(
          ".component__details > .component__priceToolTip > .component__tableTooltip > div:nth-child(1) > div:nth-child(2)"
        )
        ?.innerText.trim();

      // Parse address
      property.meta.address = document
        .querySelector(".component__details > br + span")
        ?.innerText.trim();

      // Parse floor details
      property.meta.floorNumber = document
        .querySelector("#floorNumLabel")
        ?.innerText.trim();
      property.meta.totalFloors = document
        .querySelector("#floorNumLabel")
        ?.innerText.trim();

      // Parse facing
      property.meta.facing = document
        .querySelector("#facingLabel")
        ?.innerText.trim();

      // Parse overlooking
      property.meta.overlooking = document
        .querySelector("#overlooking")
        ?.innerText.trim();

      // Parse possession
      property.meta.possessionDate = document
        .querySelector("#agePossessionLbl")
        ?.innerText.trim();

      // Furnish details
      const furnishDetails = document
        .querySelector("#FurnishDetails")
        ?.innerText.trim();
      if (furnishDetails) {
        property.furnishingDetails = furnishDetails;
      }

      // Features
      const featureElements = document.querySelectorAll("#features li");
      const features = [];
      featureElements.forEach((elem) => {
        const featureText = elem.querySelector("div")?.innerText.trim();
        if (featureText) {
          features.push(featureText);
        }
      });
      property.features = features;
      //#overviewCarousel > div.component__overviewCarousel > div > div > div.carousel__CarouselBoxNew > div > div.carousel__fadeInOut > picture > img
      const imageElements = document.querySelectorAll(
        "#overviewCarousel > div.component__overviewCarousel > div > div img"
      );

      imageElements.forEach((img) => {
        const src = img.getAttribute("src");
        if (src) {
          property.images.push(src);
        }
      });

      // Extract ratings
      let ratingElements = document.querySelectorAll(
        "#societyRatingsandReviews > div:nth-child(2) > div.review__topWrapper > div.review__rightSide > div > ul > li > div  > .ratingByFeature__circleWrap > div:nth-child(2)"
      );
      if (ratingElements.length == 0)
        ratingElements = document.querySelectorAll(
          "#LocalityInsights > div:nth-child(2) > div.review__topWrapper > div.review__rightSide > div > ul > li > div > .ratingByFeature__circleWrap > div:nth-child(2)"
        );

      ratingElements.forEach((element) => {
        const category = element
          .querySelector(".ratingByFeature__contWrap .list_header_semiBold")
          ?.textContent.trim();
        console.log(category);
        const rating = element
          .querySelector(".ratingByFeature__contWrap .caption_subdued_medium")
          ?.textContent.trim();
        console.log(rating);
        if (category && rating) {
          property.ratings[category.toLowerCase()] = rating;
        }
      });

      return property;
    });
    return propertyDetails;
    // console.log("Property Details:", propertyDetails);
  } catch (error) {
    console.error("Error scraping property details:", error);
    return null;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

const start = async (area) => {
  const links = await getPropertyLinks(area);
  if (!links) return;
  console.log(links);

  const timestamp = new Date().toISOString().replace(/:/g, "-");
  const filename = `${area}_${timestamp}.txt`;

  // Convert __dirname for ES modules
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const dir = path.join(__dirname, "scraped_data");
  const filepath = path.join(dir, filename);

  await mkdirAsync(dir, { recursive: true });
  await writeFileAsync(filepath, JSON.stringify([], null, 2), "utf8");
  console.log(`Writing data on File: ${filename}`);

  for (const link of links) {
    const data = await scrapePropertyDetails(link);
    // console.log(data);
    const currentData = await fs.promises.readFile(filepath, "utf8");
    const jsonData = JSON.parse(currentData);
    jsonData.push(data);
    const dataToSave = JSON.stringify(jsonData, null, 2);
    await writeFileAsync(filepath, dataToSave, "utf8");
    console.log(`Appended data for video: ${link}`);
  }
};

for (let area of areas) {
  await start(area);
}
