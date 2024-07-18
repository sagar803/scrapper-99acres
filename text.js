import puppeteer from "puppeteer";

const scrapePropertyDetails = async (propertyLink) => {
  let browser = await puppeteer.launch({
    headless: false,
    args: ["--disable-http2"],
  });
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
  );

  await page.goto(propertyLink, { waitUntil: "networkidle2" });
  let scroll = 500;
  while (scroll < 3000) {
    await page.evaluate(`window.scrollTo(0, ${scroll})`);
    scroll += 500;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  await page.waitForSelector("#societyRatingsandReviews");

  const propertyDetails = await page.evaluate(() => {
    const property = {
      meta: {},
      images: [],
      ratings: {},
    };
    //      "#societyRatingsandReviews > div:nth-child(2) > div.review__topWrapper > div.review__rightSide > div > ul > li > div  > .ratingByFeature__circleWrap > div:nth-child(2)"
    const ratingElements = document.querySelectorAll(
      "#societyRatingsandReviews > div:nth-child(2) > div.review__topWrapper > div.review__rightSide > div > ul > li > div  > .ratingByFeature__circleWrap > div:nth-child(2)"
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
  await browser.close();
  return propertyDetails;
};

const start = async () => {
  const link =
    "https://www.99acres.com/4-bhk-bedroom-apartment-flat-for-sale-in-dlf-the-camellias-sector-42-gurgaon-7400-sq-ft-r3-spid-P70331394";
  const data = await scrapePropertyDetails(link);
  console.log(data);
};

start();
