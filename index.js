const { Storage } = require('@google-cloud/storage');
const storage = new Storage();
const bucket = storage.bucket('mep-details');

const fs = require('fs');
const fsPromises = require("fs").promises;

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

        const jsonData = JSON.stringify(meps, null, 2)
        /*
                fs.writeFile('meps.json', jsonData, (err) => {
                    if (err) throw err;
                    console.log('Data written to file');
                });
        */

        // download the previously collected data from Storage
        const mepsLocation = bucket.file('meps.json');
        const oldMepsFile = await downloadFile(mepsLocation);

        fs.writeFile('meps_old.json', oldMepsFile, (err) => {
            if (err) throw err;
            console.log('Data written to file');
        });

        // read into json
        const mepsOld = await fsPromises.readFile('meps_old.json', 'utf8');
        const mepsOldJson = JSON.parse(mepsOld);


        console.log(mepsOldJson[0]);
        /*
                bucket.upload('meps.json').then(function(data) {
                    const file = data[0];
                    //console.log(file);
                });
        */
        // TODO: store meps somewhere, BigQuery?
        // how to map the meps who misspelled their name in twitter to
    }
}
// https://levelup.gitconnected.com/web-scraping-with-node-js-c93dcf76fe2b
getMeps();


const downloadFile = async (file) => {
    return file.download();
}