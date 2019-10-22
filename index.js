const cheerio = require('cheerio')
const axios = require("axios");

const siteUrl = "https://www.eduskunta.fi/FI/kansanedustajat/Sivut/Kansanedustajat-aakkosjarjestyksessa.aspx";

const fetchData = async () => {
  const result = await axios.get(siteUrl);
  return cheerio.load(result.data);
};

const getMeps = async () => {
    const $ = await fetchData();
    console.log($('#WebPartWPQ1 > div.ms-rtestate-field > h1').text());
}
// https://levelup.gitconnected.com/web-scraping-with-node-js-c93dcf76fe2b
getMeps();