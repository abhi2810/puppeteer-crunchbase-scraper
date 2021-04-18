const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
const csv = require('fast-csv');
const { format } = require('@fast-csv/format');

let input = [];
let output = [];
let failed = [];
const headers = ['Entry Name', 'Image URL', 'Return Company Name', 'Funding Type', 'Announced Date', 'Money Raised', 'Money Raised Sanitised', 'Total Funding Raised', 'Total Funding Raised Sanitised', 'Lead Investor', 'Pre-Money Evaluation', 'investors', 'Number of Investors'];

fs.createReadStream(path.resolve(__dirname, 'input.csv'))
    .pipe(csv.parse({ headers: true }))
    .on('error', error => console.error(error))
    .on('data', row => input.push(row));

const outputFileStream = fs.createWriteStream("output.csv");
const failedFileStream = fs.createWriteStream("failed.csv");

puppeteer.use(StealthPlugin())

puppeteer.launch({ headless: process.env.PUPPETEER_HEADLESS ? true : false }).then(async browser => {
    console.log('Running scrapper..')
    let outputCount = 0;
    for (var k = 0; k < input.length; k++) {
        try {
            const page = await browser.newPage();
            await page.goto(`https://www.crunchbase.com/textsearch?q=${input[k]['Name']}`);
            await page.waitForTimeout(1000)
            await page.click('.ng-star-inserted:nth-child(2) > .sticky-column-2 .flex-no-grow');
            const url = await page.url();
            console.log(`${url}/company_financials`);
            await page.goto(`${url}/company_financials`);
            await page.waitForTimeout(2000);
            let fundingText = await page.$eval('.one-of-many-section:nth-child(2)', e => e.innerText);
            console.log(fundingText);
            let totalFund = await page.$eval('.ng-star-inserted:nth-child(2) > field-formatter > .field-type-money', e => e.innerText);
            console.log(totalFund);
            const fundingCountElem = await page.$x('//div/field-formatter/a');
            var fundingCount = await fundingCountElem[0].evaluate(e => e.innerText);
            console.log(fundingCount);
            var imageURL = await page.$eval('.ng-star-inserted > .provide-styling > img', e => e.src);
            console.log(imageURL);
            const fundingAvailable = fundingCount > 10 ? 10 : fundingCount
            for (var i = 1; i <= fundingAvailable; i++) {
                let fundingDate = await page.$eval(`.full-width:nth-child(5) tbody > .ng-star-inserted:nth-child(${i}) > .ng-star-inserted:nth-child(1)`, e => e.innerText);
                let fundingName = await page.$eval(`.full-width:nth-child(5) tbody > .ng-star-inserted:nth-child(${i}) > .ng-star-inserted:nth-child(2)`, e => e.innerText);
                let fundingType = fundingName.split('-')[0];
                let numberOfInvestors = await page.$eval(`.full-width:nth-child(5) tbody > .ng-star-inserted:nth-child(${i}) > .ng-star-inserted:nth-child(3)`, e => e.innerText);
                let moneyRaised = await page.$eval(`.full-width:nth-child(5) tbody > .ng-star-inserted:nth-child(${i}) > .ng-star-inserted:nth-child(4)`, e => e.innerText);
                let leadInvestor = await page.$eval(`.full-width:nth-child(5) tbody > .ng-star-inserted:nth-child(${i}) > .ng-star-inserted:nth-child(5)`, e => e.innerText);
                console.log(`${fundingDate} ${fundingName} ${fundingType} ${numberOfInvestors} ${moneyRaised} ${leadInvestor}`);
                output.push({
                    'Entry Name': input[k]['Name'],
                    'Image URL': `=Image("${imageURL}")`,
                    'Return Company Name': fundingName.split('-')[1],
                    'Funding Type': fundingType,
                    'Announced Date': fundingDate,
                    'Money Raised': moneyRaised,
                    'Money Raised Sanitised': '',
                    'Total Funding Raised': totalFund,
                    'Total Funding Raised Sanitised': '',
                    'Lead Investor': leadInvestor,
                    'Pre-Money Evaluation': '',
                    'investors': '',
                    'Number of Investors': numberOfInvestors,
                });
            }
            await page.close();
            outputCount++;
        } catch (e) {
            failed.push(input[k]);
            console.log(`There was an error while serching for this Organisation: ${input[k]['Name']}`);
            console.error(e);
        }
    }
    await browser.close();
    csv.write(output, { headers: headers }).pipe(outputFileStream);
    csv.write(failed, { headers: true }).pipe(failedFileStream);
    console.log(`Output results: ${outputCount}, Failed results: ${failed.length}`);
    console.log(`All done, check the CSV files. ✨`);
})