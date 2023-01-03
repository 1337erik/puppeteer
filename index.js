const puppeteer = require('puppeteer-extra');
const chromePaths = require('chrome-paths');
var rn = require('random-number');
require('dotenv').config();

const pages = 10000;
const options = {
    min: 1000,
    max: 3000,
    integer: true,
};
const optionsLonger = {
    min: 10000,
    max: 13000,
    integer: true,
};

const delay = () => new Promise((resolve) => setTimeout(resolve, rn(options)));
const longDelay = () =>
    new Promise((resolve) => setTimeout(resolve, rn(optionsLonger)));

const sherpaRefresh = async () => {
    const browser = await puppeteer.launch({
        headless: false,
        executablePath: chromePaths.chrome,
        args: [`--window-size=${1080},${720}`],
    });
    const page = await browser.newPage();

    await page.goto('https://www.healthsherpa.com/sessions/new');
    await delay();
    await page.setViewport({ width: 1440, height: 789 });
    await page.waitForSelector('#username_or_email');
    await page.click('#username_or_email');
    await delay();
    await page.type('#username_or_email', process.env.USERNAME);
    await delay();
    await page.waitForSelector('#password');
    await page.click('#password');
    await page.type('#password', process.env.PASSWORD);
    await delay();
    await page.waitForSelector('#login-submit-button');
    await page.click('#login-submit-button');
    await delay();

    await page.waitForSelector(
        'div > .row > .filters__section___wcsNX:nth-child(5) > .btn-group > .buttons__smallButton___LA6zk-default'
    );
    await page.click(
        'div > .row > .filters__section___wcsNX:nth-child(5) > .btn-group > .buttons__smallButton___LA6zk-default'
    );

    await page.waitForSelector(
        'div > .row > .filters__section___wcsNX:nth-child(8) > .btn-group > .buttons__smallButton___LA6zk-default'
    );
    await page.click(
        'div > .row > .filters__section___wcsNX:nth-child(8) > .btn-group > .buttons__smallButton___LA6zk-default'
    );
    await delay();

    for (let l = 1; l < pages; l++) {
        for (let i = 1; i < 10; i++) {
            await page.waitForSelector(
                'tr:nth-child(' +
                    i +
                    ') > td > div > .effects__hoverUnderline___mLcpo > .colors__royal____4_PV'
            );
            await page.click(
                'tr:nth-child(' +
                    i +
                    ') > td > div > .effects__hoverUnderline___mLcpo > .colors__royal____4_PV'
            );
            await longDelay(2000);
            await page.goBack();
            await delay();
        }

        await delay();
        await page.waitForSelector(
            'td > .flex > .pagination > .pagination-link:nth-child(8) > a'
        );
        await page.click(
            'td > .flex > .pagination > .pagination-link:nth-child(8) > a'
        );
        await delay();
    }
};

sherpaRefresh();