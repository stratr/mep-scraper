const cheerio = require('cheerio')
const axios = require("axios");

const siteUrl = "https://www.eduskunta.fi/FI/kansanedustajat/Sivut/Kansanedustajat-aakkosjarjestyksessa.aspx";

const fetchData = async () => {
    const result = await axios.get(siteUrl);
    return cheerio.load(result.data);
};

const getMeps = async () => {
    const $ = await fetchData();
    const linkItems = $('#maincontent #WebPartWPQ2 div.link-item');
    if (linkItems && linkItems.length > 190) {
        const meps = [];
        linkItems.each((i, elem) => {
            const name = $(elem).find('a').text();
            const party = $(elem).find('div.description').text();
            meps[i] = { name: name, party: party };
        });

        console.log(meps);

        // TODO: store meps somewhere, BigQuery?
        // how to map the meps who misspelled their name in twitter to
    }
}
// https://levelup.gitconnected.com/web-scraping-with-node-js-c93dcf76fe2b
getMeps();