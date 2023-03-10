const puppeteer = require( 'puppeteer-extra' );

const chromePaths = require( 'chrome-paths' );
// const {executablePath} = require( 'puppeteer' );
 
// https://stackoverflow.com/questions/55678095/bypassing-captchas-with-headless-chrome-using-puppeteer
const StealthPlugin = require( 'puppeteer-extra-plugin-stealth' );
puppeteer.use( StealthPlugin() );

// https://github.com/intoli/user-agents
// var userAgent = require('user-agents'); // NOT USED

var rn = require( 'random-number' );
require( 'dotenv' ).config();

// ----------------------------------------------------------------------


const login = async ( page ) => {

    await page.goto( 'https://www.healthsherpa.com/sessions/new' );

    await page.waitForSelector( '#username_or_email' );
    await page.type( '#username_or_email', process.env.USER );

    await page.waitForSelector( '#password' );
    await page.type( '#password', process.env.PASSWORD );

    await page.waitForSelector( '#login-submit-button' );
    await page.click( '#login-submit-button' );
}

const setAgency = async ( page, dir ) => {

    const agency_url = process.env.WEBSITE_URL + `&page=1&per_page=50&exchange=onEx&include_shared_applications=true&include_all_applications=true&${dir}[]=ffm_effective_date`;
    await page.goto( agency_url );

    return process.env.AGENT_NAME;
}

const findFfmError = async ( puppet_object ) => {

    try {

        await puppet_object.waitForSelector( '.fade.modal-backdrop', { timeout: 3000 } );

        console.log( 'FFM Renew Alert Detected..' );

        const closeButton = await puppet_object.$x( "//div[@style='position: absolute; top: 0px; right: 0px;']//button[contains(@aria-label,'Close') and text()-'X']" );
        await closeButton[ 0 ].click();

    } catch( e ) {

        // fail silently..
    }
}

const sherpaRefresh = async () => {

    const browser = await puppeteer.launch({
        headless: false,
        executablePath: chromePaths.chrome,
        // executablePath: executablePath(),
        defaultViewport: false
    });
    const page = await browser.newPage();

    // -- THINGS TO AVOID DETECTION --------------------

    // page.setUserAgent( userAgent.random().toString() ) // LEMON

    // Add Headers 
    await page.setExtraHTTPHeaders({

        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
        'upgrade-insecure-requests': '1',
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'accept-encoding': 'gzip, deflate, br',
        'accept-language': 'en-US,en;q=0.9,en;q=0.8'
    }); 

    // -- Only load text to make this go faster --------

    await page.setRequestInterception( true );
    page.on( 'request', async ( request ) => {

        if( request.resourceType() == 'image' ){

            await request.abort();

        } else {

            await request.continue();
        }
    });

    // -- Login -------------------------------------------------------------

    await login( page );

    await page.waitForTimeout( 2000 );

    await findFfmError( page ); // optionally close the "integrate your ffm" modal

    // -- Variables for Settings --------------------------------------------

    // const dir = 'asc';
    const dir = 'desc';

    const starting_page = 1;

    // -- Part 1, setup for either ondeck or mli --------------------------------------------------

    const agent = await setAgency( page, dir );

    // --------------------------------------------------------------------------------------------
    // -- Part 2, select each link ----------------------------------------------------------------

    // Wait for the table to be present on the page
    await page.waitForSelector( 'table' );

    let current_page = 1;
    let current_link = 0;

    while( true ){

        await page.waitForTimeout( 2000 );

        if( current_page >= starting_page ){

            console.log( '------------------------------' );
            console.log( `Processing Page #${current_page}..` );
            console.log( '' );

            // Get all links from the current page
            const links = await page.$$( `table a[href*="/agents/${agent}"][target="_blank"]` );

            // Open each link in a new tab
            for( const link of links ){

                const linkHref = await page.evaluate( link => link.href, link );
                const newTab = await browser.newPage();
                await newTab.goto( linkHref );

                current_link++;

                console.log( '------------------------------' );
                console.log( `Processing Link #${current_link}: ${linkHref}..` );

                await findFfmError( newTab ); // optionally close the "integrate your ffm" modal

                let passed_exception = false;

                try {
                    // The sporadic continue checkbox to grant permission

                    await newTab.waitForSelector( '#application-access-grant-checkbox', { timeout: 5000 });
                    await newTab.click( '#application-access-grant-checkbox' );

                    console.log( 'Optional Permission Checkbox Detected..' );

                    await newTab.waitForXPath( "//button[contains(text(), 'Continue')]" );

                    const continueButton = await newTab.$x( "//button[contains(text(), 'Continue')]" );
                    await continueButton[ 0 ].click();

                    passed_exception = true;

                } catch ( e ){

                    // console.log( 'No Permission Step Detected..' ); // fail silently
                }

                if( !passed_exception ){

                    try {
                        // The enable-ede step with the yellow-background

                        await newTab.waitForXPath( "//button[contains(text(), 'Enable EDE')]", { timeout: 250 });

                        const continueButton = await newTab.$x( "//button[contains(text(), 'Enable EDE')]" );
                        await continueButton[ 0 ].click();

                        console.log( 'Optional EDE Sync Enable Detected..' );

                        await page.waitForTimeout( 6000 );

                    } catch ( e ){

                        // console.log( 'No Enable EDE Step Detected..' ); // fail silently
                    }
                }

                setTimeout( async () => {
                    // Close the new tab after waiting, throw into a setTimeout in hopes of running async

                    // try {
                    //     // Finding something on the page that implies the page is loaded..

                    //     const foundCaptcha = await newTab.$x( "//div[contains(text(), 'Recaptcha failed. Contact HealthSherpa for assistance')]", { timeout: 500 } );
                    //     if( foundCaptcha ){ console.log( `-- Page #${current_page}, Link #${current_link} Had Captcha --` ); }

                    // } catch( e ){

                    //     // console.log( `-- Page #${current_page}, Link# ${current_link} Had Captcha --` );
                    // }

                    try {
                        // Finding something on the page that implies the page is loaded..

                        // await newTab.$x( "//span[contains(text(), 'Application')]", { timeout: 20000 } );
                        await newTab.waitForSelector( '#aca-app-coverage-details', { timeout: 20000 });
                        console.log( `-- Page #${current_page} Link #${current_link} Loaded Successfully --` );
                        await newTab.close();

                    } catch( e ){

                        console.log( `-- Page #${current_page}, Link #${current_link} Failed to Load --` );
                        // await newTab.close();
                    }

                    console.log( '------------------------------' );

                }, 500 );
            }

        } else{

            console.log( `Skipping Page #${current_page}..` );
        }

        current_page++;

        // -- Pagination ------------------------------------------------------------------------------

        try {
            // attempt to paginate..

            const nextButton = await page.waitForSelector( '.pagination-link.last', { timeout: 10000 })

            const isDisabled = await page.evaluate( nextButton => nextButton.classList.contains( 'disabled' ), nextButton );
            if( isDisabled ){
                // if the button also is disabled, we are at the end and can break..

                console.log( `Next Button Disabled on Page #${current_page}..` );
                break;
            }

            // else continue to next page..
            await page.evaluate( selector => {
                document.querySelector( selector ).scrollIntoView({ block: 'center', inline: 'center', behavior: 'auto' });
            }, '.pagination-link.last' );

            await nextButton.click();

        } catch ( e ){

            console.log( `No Next Button Found on Page #${current_page}..` );
            break;
        }
    };
};


// -- Unused snippets for selecting filters --------------------------------------------------

const selectArchived = async ( page ) => {

    // Wait for the div element with text 'Yes'
    await page.waitForXPath("//div[contains(text(), 'Yes')]");

    // Select the "Yes" div using the xpath
    const yesDiv = await page.$x("//div[contains(text(), 'Yes')]");

    // Click the "Yes" div
    await yesDiv[0].click();
}

const selectAgency = async ( page ) => {

    // Wait for the div element with text 'Yes'
    await page.waitForXPath("//div[contains(text(), 'Agency')]");

    // Select the "Yes" div using the xpath
    const agencyDiv = await page.$x("//div[contains(text(), 'Agency')]");

    // Click the "Yes" div
    await agencyDiv[0].click();
}

const selectShared = async ( page ) => {

    // Wait for the div element with text 'Yes'
    await page.waitForXPath("//div[contains(text(), 'Shared')]");

    // Select the "Yes" div using the xpath
    const sharedDiv = await page.$x("//div[contains(text(), 'Shared')]");

    // Click the "Yes" div
    await sharedDiv[0].click();
}


sherpaRefresh();